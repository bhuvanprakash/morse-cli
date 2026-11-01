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
