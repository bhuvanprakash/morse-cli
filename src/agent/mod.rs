//! Agentic loop: lets the model use tools (read, edit, run, search) to
//! accomplish tasks autonomously, with trust-gated approvals and streaming.
//!
//! Flow:
//!   1. Send the task + tool schemas to the model.
//!   2. If it returns tool calls, execute them (with approval gates).
//!   3. Feed results back and repeat until it stops calling tools.
//!   4. Stream the final answer to the terminal.

use crate::config::Config;
use crate::errors::MorseResult;
use crate::providers::{resolve_with_fallback, CompletionRequest, Message, ToolCall, ToolDef};
use crate::tools::{self, ToolRegistry};
use crate::trust::{AuthorityLevel, TrustConfig, TrustEngine};
use crate::ui::UI;
use anyhow::Result;
use serde_json::{json, Value};
use std::collections::HashSet;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Instant;

const MAX_ITERATIONS: usize = 25;
const MAX_TOOL_OUTPUT: usize = 12_000;
/// How many times the agent re-runs checks and self-corrects after edits.
const MAX_VERIFY_ROUNDS: usize = 3;

/// Outcome of a single agent run, useful for tests and callers.
pub struct AgentOutcome {
    pub final_text: String,
    pub tool_calls_made: usize,
    pub iterations: usize,
}

/// Run an agent task. Prompts for approval before write/exec tools unless
/// `yolo` is set.
pub async fn run(ui: &UI, cfg: &Config, task: &str, yolo: bool) -> Result<()> {
    match run_inner(ui, cfg, task, yolo).await {
        Ok(outcome) => {
            ui.print("");
            ui.print(&ui.muted(&format!(
                "── done: {} tool calls in {} iterations ──",
                outcome.tool_calls_made, outcome.iterations
            )));
            Ok(())
        }
        Err(e) => {
            // Distinguish "no provider configured" from a mid-run failure so
            // the hint is actionable.
            if e.to_string().contains("mock") || e.to_string().contains("OFFLINE") {
                ui.print(&ui.warning("No API key configured — agent ran in offline mode."));
                ui.print(&ui.bullet("export GROQ_API_KEY=…  (free at console.groq.com)", 1));
                return Err(e);
            }
            Err(e)
        }
    }
}

async fn run_inner(ui: &UI, cfg: &Config, task: &str, yolo: bool) -> Result<AgentOutcome> {
    let _started = Instant::now();
    let (provider, model) = resolve_with_fallback(cfg, &cfg.routing.default.clone());
    let provider_name = provider.name().to_string();

    let root = std::env::current_dir()?;

    // Built-in tools + any configured MCP tools (best-effort).
    let mut reg = tools::default_registry();
    let mcp_client = crate::mcp::shared_client(&root);
    let mut external_tools = 0usize;
    if let Some(client) = &mcp_client {
        let snapshot = client.lock().unwrap().all_tools().to_vec();
        for t in snapshot {
            reg.register(Box::new(crate::mcp::McpToolAdapter::new(
                client.clone(),
                t.server.clone(),
                t.clone(),
            )));
            external_tools += 1;
        }
    }
    let registry = Arc::new(reg);
    let tool_defs = tool_schemas(&registry);

    let overrides = cfg
        .trust
        .overrides
        .iter()
        .map(|o| crate::trust::TrustOverride { path: o.path.clone(), level: o.level.clone() })
        .collect();
    let trust_engine = Arc::new(TrustEngine::new(
        root.as_path(),
        TrustConfig {
            default_level: AuthorityLevel::from_str(&cfg.trust.default_level),
            max_files_per_task: cfg.trust.max_files_per_task,
            denied_patterns: cfg.trust.denied_patterns.clone(),
            require_approval: cfg.trust.require_approval.clone(),
            auto_approved: cfg.trust.auto_approved.clone(),
            overrides,
        },
    ));

    let approval = Arc::new(ApprovalGate { yolo, ui: UI::new(true) });

    ui.print(&ui.section("Agent"));
    ui.print(&ui.kv_pair("model", &format!("{}/{}", provider_name, model)));
    ui.print(&ui.kv_pair("task", task));
    if external_tools > 0 {
        ui.print(&ui.kv_pair("tools", &format!("builtin + {} MCP", external_tools)));
    }
    ui.print("");

    let system = format!(
        "{}\n\nYou are in AGENTIC MODE with these tools available: {}. \\
         Use them to actually inspect and modify the real project on disk. \\
         Prefer few, well-targeted tool calls. When the task is complete, \\
         reply with a concise summary of what you changed (files + why). \\
         Do not ask the user to run the tools yourself.",
        crate::providers::system_prompt(),
        tool_defs.iter().map(|t| t.name.as_str()).collect::<Vec<_>>().join(", ")
    );

    let mut messages: Vec<Message> = vec![Message::user(task)];
    let mut tool_calls_made = 0usize;
    let mut iterations = 0usize;
    let mut edited_files: HashSet<String> = HashSet::new();
    let mut verify_rounds = 0usize;
    let mut verified_ok = false;

    let mut req = CompletionRequest {
        model: model.clone(),
        system_prompt: Some(system),
        messages: messages.clone(),
        tools: Some(tool_defs.clone()),
        max_tokens: Some(8192),
        temperature: Some(0.2),
        stream: false,
    };

    loop {
        iterations += 1;
        if iterations > MAX_ITERATIONS {
            ui.print(&ui.warning(&format!(
                "Reached max iterations ({}); stopping.",
                MAX_ITERATIONS
            )));
            break;
        }

        req.messages = messages.clone();
        let resp = provider.complete(req.clone()).await?;
        crate::cost::record_call(&resp.provider, &resp.model, resp.input_tokens as i64, resp.output_tokens as i64);

        // Some smaller/local models emit tool calls as JSON text in the
        // content instead of the structured `tool_calls` field. Recover them
        // so the agent still works across the model spectrum.
        let recovered;
        let calls: &[ToolCall] = match &resp.tool_calls {
            Some(c) => c,
            None => {
                recovered = recover_tool_calls(&resp.content);
                if recovered.is_empty() {
                    // No tool calls at all: this is the final answer.
                    let text = resp.content.clone();
                    if text.trim().is_empty() {
                        ui.print(&ui.warning("Model returned an empty response."));
                    } else {
                        ui.print(&ui.section("Result"));
                        ui.print(&text);
                    }
                    // Report verification + auto-commit status for edited files.
                    if !edited_files.is_empty() {
                        if verified_ok {
                            ui.print("");
                            ui.print(&ui.success("Verification passed (build/tests green)."));
                        } else if verify_rounds > 0 {
                            ui.print("");
                            ui.print(&ui.warning("Verification did not fully pass — review the output above."));
                        }
                        maybe_autocommit(&root, &edited_files, ui);
                    }
                    return Ok(AgentOutcome { final_text: text, tool_calls_made, iterations });
                }
                &recovered
            }
        };

        // Record assistant turn (including any tool calls) so the provider
        // sees the full transcript next round.
        messages.push(Message {
            role: "assistant".into(),
            content: resp.content.clone(),
            tool_calls: if calls.is_empty() { None } else { Some(calls.to_vec()) },
            tool_call_id: None,
        });

        // Execute each requested tool call.
        for call in calls {
            tool_calls_made += 1;
            let label = format!("{} {}", ui.muted("→"), call.name);
            ui.print(&label);
            if let Some(a) = summarize_args(&call.arguments) {
                ui.print(&ui.muted(&format!("    {}", a)));
            }

            let output = execute_tool_call(
                &registry,
                &trust_engine,
                &approval,
                &call.name,
                &call.arguments,
            )
            .await;

            match &output {
                Ok(o) if o.success => {
                    ui.print(&ui.muted("    ✓"));
                    if matches!(call.name.as_str(), "write_file" | "edit_file") {
                        if let Some(p) = extract_path(&call.arguments) {
                            edited_files.insert(p);
                        }
                    }
                }
                Ok(o) => {
                    ui.print(&ui.error(&format!("    ✗ {}", o.error.clone().unwrap_or_default())));
                }
                Err(e) => {
                    ui.print(&ui.error(&format!("    ✗ {}", e)));
                }
            }

            let out_text = output
                .map(|o| {
                    if o.success {
                        truncate(&o.output, MAX_TOOL_OUTPUT)
                    } else {
                        format!("ERROR: {}", o.error.unwrap_or(o.output))
                    }
                })
                .unwrap_or_else(|e| format!("ERROR: {}", e));

            messages.push(Message::tool_result(&call.id, &out_text));
        }

        // Tight feedback loop: after the model edits code, run the project's
        // build/tests and feed any failures back so it self-corrects instead
        // of declaring victory on broken code.
        if !edited_files.is_empty() && verify_rounds < MAX_VERIFY_ROUNDS {
            verify_rounds += 1;
            let check_name = if verify_rounds == 1 { "build" } else { "all" };
            ui.print(&ui.section(&format!("Verifying changes (round {})", verify_rounds)));
            let report = crate::verify::run_checks(&root, Some(check_name))?;
            if report.checks.is_empty() {
                // Nothing to run (no supported manifest) — skip silently.
            } else if report.passed() {
                for c in &report.checks {
                    ui.print(&ui.success(&format!("{} passed ({:.1}s)", c.name, c.duration.as_secs_f64())));
                }
                verified_ok = true;
            } else {
                let feedback = report.failure_feedback(6000);
                for c in report.checks.iter().filter(|c| !c.ok) {
                    ui.print(&ui.error(&format!("{} failed ({:.1}s)", c.name, c.duration.as_secs_f64())));
                    for line in c.output.lines().take(8) {
                        println!("    {}", line);
                    }
                }
                messages.push(Message::user(&format!(
                    "Your last changes failed verification. Fix these errors, then stop.\n\n{}",
                    feedback
                )));
                continue; // ask the model again before finishing
            }
        }
    }

    Ok(AgentOutcome {
        final_text: String::new(),
        tool_calls_made,
        iterations,
    })
}

/// Permission gate for tool execution.
pub struct ApprovalGate {
    pub yolo: bool,
    ui: UI,
}

impl ApprovalGate {
    /// Returns true when a tool call is allowed to proceed.
    pub fn approve(&self, tool: &str, detail: &str) -> bool {
        if self.yolo {
            return true;
        }
        // Read-only tools never need approval.
        if matches!(tool, "read_file" | "grep" | "glob" | "list_dir") {
            return true;
        }
        self.ui
            .confirm(&format!("Allow {}? {}", tool, detail))
            .unwrap_or(false)
    }
}

/// Execute one tool call, enforcing trust boundaries and approvals.
async fn execute_tool_call(
    registry: &ToolRegistry,
    trust: &TrustEngine,
    approval: &ApprovalGate,
    name: &str,
    args: &Value,
) -> MorseResult<tools::ToolResult> {
    // Trust gate for filesystem-touching tools.
    if let Some(path) = extract_path(args) {
        let p = PathBuf::from(&path);
        if matches!(name, "write_file" | "edit_file") {
            let allowed = trust.can_write(&p)?;
            if !allowed {
                return Ok(tools::ToolResult {
                    success: false,
                    output: String::new(),
                    error: Some(format!("denied by trust boundaries: {}", path)),
                });
            }
        } else if name == "read_file" {
            let allowed = trust.can_read(&p)?;
            if !allowed {
                return Ok(tools::ToolResult {
                    success: false,
                    output: String::new(),
                    error: Some(format!("read denied by trust boundaries: {}", path)),
                });
            }
        }
    }

    // Approval for mutating/exec tools.
    if !approval.approve(name, &summarize_args(args).unwrap_or_default()) {
        return Ok(tools::ToolResult {
            success: false,
            output: String::new(),
            error: Some("user declined".to_string()),
        });
    }

    let tool = registry.get(name).ok_or_else(|| {
        crate::errors::MorseError::new(
            "AGENT-TOOL",
            &format!("unknown tool: {}", name),
            crate::errors::ErrorCategory::Tool,
        )
    })?;

    tool.execute(args.clone()).await.map_err(|e| {
        crate::errors::MorseError::new("AGENT-EXEC", &e.to_string(), crate::errors::ErrorCategory::Tool)
    })
}

/// JSON schemas for the tools, in OpenAI function-calling format.
pub fn tool_schemas(registry: &ToolRegistry) -> Vec<ToolDef> {
    let defs: Vec<ToolDef> = registry
        .list()
        .into_iter()
        .map(|name| {
            // Externally-defined tools (e.g. MCP) supply their own schema.
            if let Some(sd) = registry.get(&name).and_then(|t| t.schema()) {
                return sd;
            }
            let params = match name.as_str() {
                "read_file" => json!({
                    "type": "object",
                    "properties": {
                        "path": {"type": "string", "description": "File path to read"},
                        "offset": {"type": "integer", "description": "1-based line number to start from"},
                        "limit": {"type": "integer", "description": "Max lines to read"}
                    },
                    "required": ["path"]
                }),
                "write_file" => json!({
                    "type": "object",
                    "properties": {
                        "path": {"type": "string"},
                        "content": {"type": "string", "description": "Full new file content"}
                    },
                    "required": ["path", "content"]
                }),
                "edit_file" => json!({
                    "type": "object",
                    "properties": {
                        "path": {"type": "string"},
                        "old_string": {"type": "string", "description": "Exact text to replace (must be unique)"},
                        "new_string": {"type": "string", "description": "Replacement text"}
                    },
                    "required": ["path", "old_string", "new_string"]
                }),
                "grep" => json!({
                    "type": "object",
                    "properties": {
                        "pattern": {"type": "string", "description": "Regex to search for"},
                        "path": {"type": "string", "description": "Root directory (default .)"}
                    },
                    "required": ["pattern"]
                }),
                "glob" => json!({
                    "type": "object",
                    "properties": {
                        "pattern": {"type": "string", "description": "Glob pattern e.g. src/**/*.rs"}
                    },
                    "required": ["pattern"]
                }),
                "bash" => json!({
                    "type": "object",
                    "properties": {
                        "command": {"type": "string", "description": "Shell command to run"}
                    },
                    "required": ["command"]
                }),
                _ => json!({"type": "object", "properties": {}}),
            };
            let description = match name.as_str() {
                "read_file" => "Read a file's contents, optionally by line range",
                "write_file" => "Create or overwrite a file with new content",
                "edit_file" => "Replace an exact substring in a file (old_string must be unique)",
                "grep" => "Search file contents with a regular expression",
                "glob" => "Find files matching a glob pattern",
                "bash" => "Run a shell command and return stdout/stderr",
                _ => "Tool",
            };
            ToolDef {
                name: name.to_string(),
                description: description.to_string(),
                parameters: params,
            }
        })
        .collect();
    defs
}

/// Recover tool calls that a model embedded as JSON text in its content
/// instead of the structured `tool_calls` field. Handles the common shapes:
///   {"name": "write_file", "parameters": {...}}
///   {"name": "write_file", "arguments": {...}}
///   {"tool": "write_file", "args": {...}}
///   {"function": {"name": ..., "arguments": ...}}
/// Returns an empty vec when the content has no recognizable tool calls.
fn recover_tool_calls(content: &str) -> Vec<ToolCall> {
    let mut calls = Vec::new();
    // Scan every balanced JSON object in the text.
    for start in content.match_indices('{').map(|(i, _)| i) {
        let Some(slice) = content.get(start..) else { continue };
        let Some(end) = balanced_end(slice) else { continue };
        let candidate = &slice[..end];
        let Ok(val) = serde_json::from_str::<Value>(candidate) else { continue };
        if let Some(call) = coerce_tool_call(&val) {
            calls.push(call);
        }
    }
    // De-duplicate by name+args (models sometimes repeat themselves).
    let mut seen = std::collections::HashSet::new();
    calls.retain(|c| seen.insert(format!("{}:{}", c.name, c.arguments)));
    calls
}

/// Find the index just past the brace that balances the leading `{`.
fn balanced_end(s: &str) -> Option<usize> {
    let bytes = s.as_bytes();
    let mut depth = 0i32;
    let mut in_str = false;
    let mut escape = false;
    for (i, &b) in bytes.iter().enumerate() {
        if escape {
            escape = false;
            continue;
        }
        match b {
            b'\\' if in_str => escape = true,
            b'"' => in_str = !in_str,
            b'{' if !in_str => depth += 1,
            b'}' if !in_str => {
                depth -= 1;
                if depth == 0 {
                    return Some(i + 1);
                }
            }
            _ => {}
        }
    }
    None
}

/// Extract (name, args) from a JSON value if it looks like a tool call.
fn coerce_tool_call(v: &Value) -> Option<ToolCall> {
    // {"function": {"name": ..., "arguments": ...}}
    if let Some(f) = v.get("function") {
        if let Some(name) = f.get("name").and_then(|n| n.as_str()) {
            let args = f.get("arguments").and_then(|a| a.as_str())
                .and_then(|s| serde_json::from_str(s).ok())
                .or_else(|| f.get("arguments").cloned())
                .unwrap_or(json!({}));
            return Some(ToolCall { id: new_call_id(), name: name.to_string(), arguments: args });
        }
    }
    // {"name": ..., "parameters"|"arguments"|"args": ...}
    let name = v.get("name").or_else(|| v.get("tool")).and_then(|n| n.as_str())?;
    // Only treat as a tool call if the name matches a known tool — otherwise
    // random JSON objects in prose would be misfired as calls.
    if !known_tools().contains(&name) {
        return None;
    }
    let args = v.get("parameters")
        .or_else(|| v.get("arguments"))
        .or_else(|| v.get("args"))
        .and_then(|a| a.as_str())
        .and_then(|s| serde_json::from_str(s).ok())
        .or_else(|| v.get("parameters").or_else(|| v.get("arguments")).or_else(|| v.get("args")).cloned())
        .unwrap_or(json!({}));
    Some(ToolCall { id: new_call_id(), name: name.to_string(), arguments: args })
}

fn known_tools() -> Vec<&'static str> {
    vec!["read_file", "write_file", "edit_file", "list_dir", "grep", "glob", "bash"]
}

fn new_call_id() -> String {
    format!("call_{}", uuid::Uuid::new_v4().simple())
}

/// If we're in a git repo, commit the agent's edits as one clean commit so
/// the change is reviewable and `morse undo`-able (Aider-style). No-op when
/// not a repo or when the tree was already committed.
fn maybe_autocommit(root: &std::path::Path, edited: &std::collections::HashSet<String>, ui: &UI) {
    if !crate::vcs::is_repo(root) {
        return;
    }
    let mut files: Vec<String> = edited.iter().cloned().collect();
    files.sort();
    let cfg = Config::default();
    let msg = crate::vcs::suggest_message(&cfg, &files);
    match crate::vcs::commit_all(root, &msg) {
        Ok(Some(sha)) => {
            ui.print(&ui.success(&format!("Committed {} as {}", files.len(), sha)));
            ui.print(&ui.muted("Undo with: morse undo · Review with: morse diff"));
        }
        Ok(None) => {} // nothing to commit
        Err(e) => ui.print(&ui.warning(&format!("auto-commit skipped: {}", e))),
    }
}

fn summarize_args(args: &Value) -> Option<String> {
    if let Some(p) = args["path"].as_str() {
        if let Some(c) = args["content"].as_str() {
            return Some(format!("{} ({} bytes)", p, c.len()));
        }
        if let Some(o) = args["old_string"].as_str() {
            return Some(format!("{} replace \"{}\"", p, truncate(o, 40)));
        }
        return Some(p.to_string());
    }
    if let Some(c) = args["command"].as_str() {
        return Some(truncate(c, 60));
    }
    if let Some(p) = args["pattern"].as_str() {
        return Some(p.to_string());
    }
    None
}

fn extract_path(args: &Value) -> Option<String> {
    args["path"].as_str().map(|s| s.to_string())
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

    #[test]
    fn tool_schemas_cover_all_registry_tools() {
        let registry = tools::default_registry();
        let defs = tool_schemas(&registry);
        for name in registry.list() {
            assert!(
                defs.iter().any(|d| d.name == name),
                "missing schema for tool {}",
                name
            );
        }
    }

    #[test]
    fn summarize_and_extract() {
        let args = json!({"path": "src/main.rs", "old_string": "fn main() {}"});
        assert_eq!(extract_path(&args).as_deref(), Some("src/main.rs"));
        assert!(summarize_args(&args).unwrap().contains("src/main.rs"));

        let args = json!({"command": "ls -la"});
        assert!(summarize_args(&args).unwrap().contains("ls"));
        assert_eq!(extract_path(&args), None);
    }
}
