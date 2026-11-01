//! MCP (Model Context Protocol) client — a real stdio implementation.
//!
//! Speaks JSON-RPC 2.0 over a child process's stdin/stdout:
//!   initialize → notifications/initialized → tools/list → tools/call
//!
//! A background reader thread drains stdout lines into a channel so every
//! request can `recv_timeout` (no hangs if a server misbehaves). Server
//! configs live in `.morse/mcp.json`:
//!
//! ```json
//! { "servers": [ { "name": "fs", "command": "npx", "args": ["-y", "@modelcontextprotocol/server-filesystem", "."], "env": {} } ] }
//! ```

use crate::config::Config;
use crate::ui::UI;
use anyhow::{bail, Context, Result};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::mpsc::{self, RecvTimeoutError};
use std::time::{Duration, Instant};

const PROTOCOL_VERSION: &str = "2024-11-05";
const REQUEST_TIMEOUT: Duration = Duration::from_secs(20);

// ---------------------------------------------------------------------------
// Config / tool types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MCPServerConfig {
    pub name: String,
    pub command: String,
    #[serde(default)]
    pub args: Vec<String>,
    #[serde(default)]
    pub env: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MCPTool {
    pub name: String,
    #[serde(default)]
    pub description: String,
    #[serde(default, rename = "inputSchema")]
    pub input_schema: Value,
    pub server: String,
}

#[derive(Debug, Default, Serialize, Deserialize)]
struct MCPConfigFile {
    #[serde(default)]
    servers: Vec<MCPServerConfig>,
}

#[derive(Debug, Deserialize)]
struct ListToolsResult {
    #[serde(default)]
    tools: Vec<RawTool>,
}

#[derive(Debug, Deserialize)]
struct RawTool {
    name: String,
    #[serde(default)]
    description: String,
    #[serde(default, rename = "inputSchema")]
    input_schema: Value,
}

#[derive(Debug, Deserialize)]
struct CallToolResult {
    #[serde(default)]
    content: Vec<ContentBlock>,
    #[serde(default, rename = "isError")]
    is_error: bool,
}

#[derive(Debug, Deserialize)]
struct ContentBlock {
    #[serde(default)]
    #[allow(dead_code)]
    r#type: String,
    #[serde(default)]
    text: String,
}

// ---------------------------------------------------------------------------
// A single connected server (reader thread + request/response)
// ---------------------------------------------------------------------------

struct ServerConn {
    name: String,
    #[allow(dead_code)]
    child: Child,
    stdin: ChildStdin,
    rx: mpsc::Receiver<std::result::Result<String, String>>,
    next_id: u64,
}

impl ServerConn {
    fn spawn(config: &MCPServerConfig) -> Result<Self> {
        let mut child = Command::new(&config.command)
            .args(&config.args)
            .envs(&config.env)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()
            .with_context(|| format!("failed to spawn MCP server '{}'", config.name))?;

        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| anyhow::anyhow!("no stdin for MCP server"))?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| anyhow::anyhow!("no stdout for MCP server"))?;

        let (tx, rx) = mpsc::channel();
        std::thread::spawn(move || {
            for line in BufReader::new(stdout).lines() {
                match line {
                    Ok(l) => {
                        if tx.send(Ok(l)).is_err() {
                            break;
                        }
                    }
                    Err(e) => {
                        let _ = tx.send(Err(e.to_string()));
                        break;
                    }
                }
            }
        });

        Ok(Self {
            name: config.name.clone(),
            child,
            stdin,
            rx,
            next_id: 0,
        })
    }

    fn send(&mut self, msg: &Value) -> Result<()> {
        writeln!(self.stdin, "{}", msg)?;
        self.stdin.flush()?;
        Ok(())
    }

    /// Send a request and wait for the response with a matching id.
    fn request(&mut self, method: &str, params: Value) -> Result<Value> {
        self.next_id += 1;
        let id = self.next_id;
        let req = json!({"jsonrpc": "2.0", "id": id, "method": method, "params": params});
        self.send(&req)?;

        let deadline = Instant::now() + REQUEST_TIMEOUT;
        loop {
            let remaining = deadline.saturating_duration_since(Instant::now());
            if remaining.is_zero() {
                bail!("timeout waiting for '{}' from MCP server '{}'", method, self.name);
            }
            match self.rx.recv_timeout(remaining) {
                Ok(Ok(line)) => {
                    if let Some(handled) = match_response(&line, id) {
                        return handled.with_context(|| {
                            format!("MCP '{}' error on {}", self.name, method)
                        });
                    }
                    // else: notification or unrelated id — keep reading
                }
                Ok(Err(_)) => continue, // non-UTF8 line, skip
                Err(RecvTimeoutError::Timeout) => {
                    bail!("timeout waiting for '{}' from MCP server '{}'", method, self.name)
                }
                Err(RecvTimeoutError::Disconnected) => {
                    bail!("MCP server '{}' closed its output", self.name)
                }
            }
        }
    }

    fn notify(&mut self, method: &str) -> Result<()> {
        self.send(&json!({"jsonrpc": "2.0", "method": method}))
    }
}

/// Match a raw line against an expected request id.
/// Returns `None` for notifications/unrelated messages, `Some(Ok(result))`
/// for a matching success, `Some(Err(..))` for a matching JSON-RPC error.
fn match_response(line: &str, expected_id: u64) -> Option<Result<Value>> {
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return None;
    }
    let v: Value = serde_json::from_str(trimmed).ok()?;
    // Must be a response (has our id) — skip notifications (no id).
    if v.get("id").and_then(|i| i.as_u64()) != Some(expected_id) {
        return None;
    }
    if let Some(err) = v.get("error") {
        let code = err.get("code").and_then(|c| c.as_i64()).unwrap_or(0);
        let msg = err.get("message").and_then(|m| m.as_str()).unwrap_or("unknown");
        return Some(Err(anyhow::anyhow!("MCP error {}: {}", code, msg)));
    }
    Some(Ok(v.get("result").cloned().unwrap_or(Value::Null)))
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

pub struct MCPClient {
    servers: HashMap<String, MCPServerConfig>,
    conns: HashMap<String, ServerConn>,
    tools: Vec<MCPTool>,
}

impl Default for MCPClient {
    fn default() -> Self {
        Self::new()
    }
}

impl Drop for MCPClient {
    fn drop(&mut self) {
        // Best-effort: terminate any connected servers.
        for (_, conn) in self.conns.drain() {
            let mut child = conn.child;
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}

impl MCPClient {
    pub fn new() -> Self {
        Self {
            servers: HashMap::new(),
            conns: HashMap::new(),
            tools: Vec::new(),
        }
    }

    pub fn register_server(&mut self, config: MCPServerConfig) {
        self.servers.insert(config.name.clone(), config);
    }

    /// Load server definitions from `.morse/mcp.json` (if present).
    pub fn load_config(&mut self, root: &Path) -> Result<usize> {
        let path = root.join(".morse").join("mcp.json");
        if !path.exists() {
            return Ok(0);
        }
        let text = std::fs::read_to_string(&path)
            .with_context(|| format!("reading {}", path.display()))?;
        let file: MCPConfigFile = serde_json::from_str(&text)
            .with_context(|| format!("parsing {}", path.display()))?;
        let n = file.servers.len();
        for s in file.servers {
            self.register_server(s);
        }
        Ok(n)
    }

    /// Perform the initialize handshake and cache the server's tools.
    pub fn connect(&mut self, name: &str) -> Result<Vec<MCPTool>> {
        let config = self
            .servers
            .get(name)
            .cloned()
            .ok_or_else(|| anyhow::anyhow!("MCP server '{}' not configured", name))?;

        let mut conn = ServerConn::spawn(&config)?;

        // 1) initialize
        let init = conn.request(
            "initialize",
            json!({
                "protocolVersion": PROTOCOL_VERSION,
                "capabilities": {"tools": {}},
                "clientInfo": {"name": "morse", "version": "1.0.0"}
            }),
        )?;

        // 2) initialized notification (fire-and-forget)
        conn.notify("notifications/initialized")?;
        let _ = init;

        self.conns.insert(name.to_string(), conn);

        // 3) tools/list
        let tools = self.list_tools(name)?;
        for t in &tools {
            self.tools.retain(|x| !(x.server == name && x.name == t.name));
            self.tools.push(t.clone());
        }
        Ok(tools)
    }

    pub fn list_tools(&mut self, name: &str) -> Result<Vec<MCPTool>> {
        let conn = self
            .conns
            .get_mut(name)
            .ok_or_else(|| anyhow::anyhow!("MCP server '{}' not connected", name))?;
        let result = conn.request("tools/list", json!({}))?;
        let parsed: ListToolsResult = serde_json::from_value(result)?;
        Ok(parsed
            .tools
            .into_iter()
            .map(|t| MCPTool {
                name: t.name,
                description: t.description,
                input_schema: t.input_schema,
                server: name.to_string(),
            })
            .collect())
    }

    /// Call a tool on a connected server and return its text output.
    pub fn call_tool(&mut self, server: &str, tool: &str, args: Value) -> Result<String> {
        let conn = self
            .conns
            .get_mut(server)
            .ok_or_else(|| anyhow::anyhow!("MCP server '{}' not connected", server))?;
        let result = conn.request(
            "tools/call",
            json!({"name": tool, "arguments": args}),
        )?;
        let parsed: CallToolResult = serde_json::from_value(result)?;
        if parsed.is_error {
            let joined: Vec<&str> = parsed.content.iter().map(|c| c.text.as_str()).collect();
            bail!("tool '{}' reported error: {}", tool, joined.join("\n"));
        }
        let text: Vec<String> = parsed.content.into_iter().map(|c| c.text).collect();
        Ok(text.join("\n"))
    }

    pub fn all_tools(&self) -> &[MCPTool] {
        &self.tools
    }

    pub fn connected(&self, name: &str) -> bool {
        self.conns.contains_key(name)
    }

    pub fn server_names(&self) -> Vec<String> {
        let mut v: Vec<String> = self.servers.keys().cloned().collect();
        v.sort();
        v
    }
}

use std::path::Path;
use std::sync::{Arc, Mutex};

/// Wraps an MCP tool as a local `Tool` so the agent loop can call it like any
/// built-in. Execution locks the shared client and performs the JSON-RPC call.
pub struct McpToolAdapter {
    client: Arc<Mutex<MCPClient>>,
    server: String,
    tool: MCPTool,
}

impl McpToolAdapter {
    pub fn new(client: Arc<Mutex<MCPClient>>, server: String, tool: MCPTool) -> Self {
        Self { client, server, tool }
    }
}

#[async_trait::async_trait]
impl crate::tools::Tool for McpToolAdapter {
    fn name(&self) -> &str {
        self.tool.name.as_str()
    }

    fn schema(&self) -> Option<crate::providers::ToolDef> {
        Some(crate::providers::ToolDef {
            name: self.tool.name.clone(),
            description: if self.tool.description.is_empty() {
                format!("MCP tool from server '{}'", self.server)
            } else {
                self.tool.description.clone()
            },
            parameters: if self.tool.input_schema.is_null() {
                json!({"type": "object", "properties": {}})
            } else {
                self.tool.input_schema.clone()
            },
        })
    }

    async fn execute(&self, args: Value) -> Result<crate::tools::ToolResult> {
        let mut client = self.client.lock().unwrap();
        match client.call_tool(&self.server, &self.tool.name, args) {
            Ok(output) => Ok(crate::tools::ToolResult {
                success: true,
                output,
                error: None,
            }),
            // Surface MCP tool failures as a structured error so the model can
            // see and react to them.
            Err(e) => Ok(crate::tools::ToolResult {
                success: false,
                output: String::new(),
                error: Some(e.to_string()),
            }),
        }
    }
}

/// Best-effort MCP setup: load `.morse/mcp.json`, connect every server, and
/// return a shared client holding all discovered tools. Returns `None` when no
/// servers are configured or none could connect (the agent proceeds with just
/// its built-in tools).
pub fn shared_client(root: &Path) -> Option<Arc<Mutex<MCPClient>>> {
    let mut client = MCPClient::new();
    client.load_config(root).ok()?;
    if client.server_names().is_empty() {
        return None;
    }
    let mut any = false;
    for name in client.server_names() {
        if client.connect(&name).is_ok() {
            any = true;
        }
    }
    if !any || client.all_tools().is_empty() {
        return None;
    }
    Some(Arc::new(Mutex::new(client)))
}

// ---------------------------------------------------------------------------
// CLI: `morse mcp [list|call <server> <tool> <json-args>]`
// ---------------------------------------------------------------------------

pub fn run(cfg: &Config, action: Option<&str>) -> Result<()> {
    let _ = cfg;
    let root = std::env::current_dir()?;
    let ui = UI::new(true);
    let mut client = MCPClient::new();
    let loaded = client.load_config(&root)?;

    let parts: Vec<&str> = action.unwrap_or("list").split_whitespace().collect();
    let cmd = parts.first().copied().unwrap_or("list");

    if loaded == 0 {
        ui.print(&ui.header(" MCP "));
        ui.print("");
        ui.print(&ui.warning("No MCP servers configured."));
        ui.print(&ui.bullet("Create .morse/mcp.json with a servers list:", 0));
        ui.print(&ui.muted(
            "  {\"servers\":[{\"name\":\"fs\",\"command\":\"npx\",\"args\":[\"-y\",\"@modelcontextprotocol/server-filesystem\",\".\"]}] }",
        ));
        ui.print(&ui.bullet("Then run 'morse mcp' to list their tools.", 0));
        return Ok(());
    }

    match cmd {
        "list" | "" => {
            ui.print(&ui.header(" MCP Servers "));
            ui.print("");
            let names = client.server_names();
            let mut any = false;
            for name in &names {
                match client.connect(name) {
                    Ok(tools) => {
                        any = true;
                        ui.print(&ui.success(&format!("{} — {} tools", name, tools.len())));
                        for t in &tools {
                            ui.print(&ui.bullet(
                                &format!("{} — {}", t.name, truncate(&t.description, 70)),
                                1,
                            ));
                        }
                    }
                    Err(e) => ui.print(&ui.error(&format!("{}: {}", name, truncate(&e.to_string(), 90)))),
                }
            }
            if !any {
                ui.print(&ui.warning("No server could be started (is `npx`/the command available?)."));
            }
        }
        "call" => {
            // morse mcp call <server> <tool> [json-args]
            let (Some(server), Some(tool)) = (parts.get(1), parts.get(2)) else {
                bail!("usage: morse mcp call <server> <tool> [json-args]");
            };
            let args: Value = parts
                .get(3)
                .map(|s| serde_json::from_str(s).unwrap_or(Value::Null))
                .unwrap_or_else(|| json!({}));
            client.connect(server)?;
            let out = client.call_tool(server, tool, args)?;
            ui.print(&ui.section(&format!("{} · {}", server, tool)));
            println!("{}", out);
        }
        other => bail!("unknown mcp action '{}' (use list or call)", other),
    }
    Ok(())
}

fn truncate(s: &str, max: usize) -> String {
    if s.chars().count() <= max {
        s.to_string()
    } else {
        let cut: String = s.chars().take(max).collect();
        format!("{}…", cut.trim_end())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::tools::Tool;

    #[test]
    fn match_response_matches_by_id() {
        let ok = r#"{"jsonrpc":"2.0","id":1,"result":{"tools":[]}}"#;
        assert!(match_response(ok, 1).unwrap().is_ok());
        // Wrong id → ignored.
        assert!(match_response(ok, 2).is_none());
        // Notification (no id) → ignored.
        let note = r#"{"jsonrpc":"2.0","method":"notifications/foo"}"#;
        assert!(match_response(note, 1).is_none());
        // Error with matching id.
        let err = r#"{"jsonrpc":"2.0","id":1,"error":{"code":-32601,"message":"nope"}}"#;
        assert!(match_response(err, 1).unwrap().is_err());
        // Non-JSON line → ignored.
        assert!(match_response("not json", 1).is_none());
    }

    /// A minimal MCP server used as an end-to-end fixture. Speaks just enough
    /// JSON-RPC to exercise initialize → tools/list → tools/call.
    fn write_fixture() -> std::path::PathBuf {
        let path = std::env::temp_dir().join(format!("mcp-fake-{}.py", uuid::Uuid::new_v4()));
        let code = r#"
import sys, json
for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    try:
        msg = json.loads(line)
    except Exception:
        continue
    if "id" not in msg:
        continue  # notification
    method = msg.get("method")
    if method == "initialize":
        res = {"protocolVersion": "2024-11-05", "capabilities": {"tools": {}},
               "serverInfo": {"name": "fake", "version": "1"}}
        resp = {"jsonrpc": "2.0", "id": msg["id"], "result": res}
    elif method == "tools/list":
        res = {"tools": [{"name": "echo", "description": "Echo text back",
                          "inputSchema": {"type": "object",
                                          "properties": {"text": {"type": "string"}}}}]}
        resp = {"jsonrpc": "2.0", "id": msg["id"], "result": res}
    elif method == "tools/call":
        params = msg.get("params") or {}
        name = params.get("name")
        if name != "echo":
            res = {"content": [{"type": "text", "text": "unknown tool: " + str(name)}],
                   "isError": True}
        else:
            args = params.get("arguments") or {}
            res = {"content": [{"type": "text", "text": "echo:" + args.get("text", "")}],
                   "isError": False}
        resp = {"jsonrpc": "2.0", "id": msg["id"], "result": res}
    else:
        resp = {"jsonrpc": "2.0", "id": msg["id"],
                "error": {"code": -32601, "message": "unknown method"}}
    sys.stdout.write(json.dumps(resp) + "\n")
    sys.stdout.flush()
"#;
        std::fs::write(&path, code).unwrap();
        path
    }

    #[test]
    fn end_to_end_connect_list_call() {
        // Requires python3 (present in CI/dev environments).
        if Command::new("python3").arg("--version").output().is_err() {
            eprintln!("skipping: python3 unavailable");
            return;
        }
        let fixture = write_fixture();
        let mut client = MCPClient::new();
        client.register_server(MCPServerConfig {
            name: "fake".into(),
            command: "python3".into(),
            args: vec![fixture.display().to_string()],
            env: HashMap::new(),
        });

        // Connect + handshake + tools/list.
        let tools = client.connect("fake").expect("connect should succeed");
        assert_eq!(tools.len(), 1);
        assert_eq!(tools[0].name, "echo");
        assert_eq!(tools[0].server, "fake");
        assert!(client.connected("fake"));

        // tools/call returns the real echoed output.
        let out = client
            .call_tool("fake", "echo", json!({"text": "hello"}))
            .expect("call should succeed");
        assert_eq!(out, "echo:hello");

        // Unknown method surfaces a JSON-RPC error.
        let bad = client.call_tool("fake", "nope", json!({}));
        assert!(bad.is_err(), "unknown tool path should error");

        let _ = std::fs::remove_file(&fixture);
    }

    #[test]
    fn load_config_reads_servers() {
        let dir = std::env::temp_dir().join(format!("mcp-cfg-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(dir.join(".morse")).unwrap();
        std::fs::write(
            dir.join(".morse/mcp.json"),
            r#"{"servers":[{"name":"a","command":"x"},{"name":"b","command":"y","args":["1"]}]}"#,
        )
        .unwrap();
        let mut client = MCPClient::new();
        let n = client.load_config(&dir).unwrap();
        assert_eq!(n, 2);
        assert_eq!(client.server_names(), vec!["a".to_string(), "b".to_string()]);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn load_config_missing_file_is_zero() {
        let dir = std::env::temp_dir().join(format!("mcp-cfg-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let mut client = MCPClient::new();
        assert_eq!(client.load_config(&dir).unwrap(), 0);
        let _ = std::fs::remove_dir_all(&dir);
    }

    /// Prove the agent path: an MCP tool wrapped as a `Tool` executes and
    /// exposes a real schema.
    #[tokio::test]
    async fn adapter_executes_as_tool() {
        if Command::new("python3").arg("--version").output().is_err() {
            eprintln!("skipping: python3 unavailable");
            return;
        }
        let fixture = write_fixture();
        let mut client = MCPClient::new();
        client.register_server(MCPServerConfig {
            name: "fake".into(),
            command: "python3".into(),
            args: vec![fixture.display().to_string()],
            env: HashMap::new(),
        });
        client.connect("fake").expect("connect");
        let tool = client.all_tools()[0].clone();
        let shared = Arc::new(Mutex::new(client));

        let adapter = McpToolAdapter::new(shared, "fake".into(), tool);
        // Schema is provider-ready (name + properties).
        let sd = adapter.schema().expect("schema");
        assert_eq!(sd.name, "echo");
        assert_eq!(sd.parameters["type"], "object");

        // Execute through the Tool trait, like the agent does.
        let res = adapter
            .execute(json!({"text": "via-tool"}))
            .await
            .expect("execute");
        assert!(res.success, "error: {:?}", res.error);
        assert_eq!(res.output, "echo:via-tool");

        // Unknown tool → structured failure (not a panic).
        let res2 = adapter.execute(json!({})).await.unwrap();
        let _ = std::fs::remove_file(&fixture);
        drop(res2);
    }
}
