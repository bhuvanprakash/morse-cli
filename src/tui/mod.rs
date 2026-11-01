//! Interactive TUI chat with markdown rendering, streaming, and a clean
//! ratatui-based layout.

use crate::config::Config;
use crate::providers::{resolve_with_fallback, system_prompt, CompletionRequest, Message};
use crate::ui::UI;
use anyhow::Result;
use crossterm::{
    event::{self, Event, KeyCode, KeyEvent, KeyEventKind, KeyModifiers},
    execute,
    terminal::{disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen},
};
use ratatui::{
    backend::{Backend, CrosstermBackend},
    layout::{Constraint, Direction, Layout, Rect},
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::{Block, BorderType, Borders, Clear, List, ListItem, ListState, Paragraph, Wrap},
    Frame, Terminal,
};
use std::io;

#[derive(PartialEq, Clone, Copy)]
enum InputMode {
    Normal,
    Editing,
}

struct ChatState {
    input: String,
    messages: Vec<ChatMessage>,
    input_mode: InputMode,
    scroll_offset: u16,
    /// When true, keep the view pinned to the newest message.
    follow: bool,
    /// Highest reachable scroll offset (set during render).
    max_scroll: u16,
    model_label: String,
    pending: bool,
    /// Sent-message history for up/down recall.
    history: Vec<String>,
    /// Current position in `history` (None = editing a new line).
    history_idx: Option<usize>,
    /// Draft preserved while browsing history.
    draft: String,
    /// Persisted session backing this conversation (for resume/save).
    session_id: Option<String>,
    /// Files explicitly added with /add — injected into every request.
    context_files: Vec<String>,
    /// Snippets (e.g. /run output) prepended to the next sent message.
    pending_context: Vec<String>,
    /// Set when state changed and a redraw is needed (perf: avoid busy redraws).
    dirty: bool,
    /// Provider/model spec that last worked — reused so we don't re-try dead
    /// providers on every message.
    working_spec: Option<String>,
    /// What we're waiting on right now (shown in the status bar while pending).
    pending_label: String,
    /// Live suggestion popup for "/" commands and "@file" paths.
    palette: Option<Palette>,
}

/// Floating suggestion list above the input.
#[derive(Clone)]
struct Palette {
    kind: PaletteKind,
    /// (text to insert on accept, label to display, description)
    items: Vec<(String, String, String)>,
    selected: usize,
}

#[derive(PartialEq, Clone, Copy)]
enum PaletteKind {
    Slash,
    AtFile,
}

/// All slash commands with one-line descriptions (drives the palette + /help).
const SLASH_INFO: &[(&str, &str)] = &[
    ("/help", "show all commands and keys"),
    ("/add <file>", "keep a file in every request"),
    ("/drop <file>", "remove a file from context"),
    ("/ls", "list files in context"),
    ("/models", "list models for configured providers"),
    ("/model <p/m>", "switch model"),
    ("/run <cmd>", "run shell; output joins next message"),
    ("/undo", "revert the last AI commit"),
    ("/diff", "show working-tree changes"),
    ("/graph <q>", "search the code knowledge graph"),
    ("/rag <q>", "semantic search over indexed code"),
    ("/memory …", "persistent notes: add/get/search"),
    ("/mcp", "list external MCP tools"),
    ("/test", "run project tests; failures attach to next message"),
    ("/lint", "run build/vet checks; failures attach"),
    ("/commit", "generate a commit message from changes"),
    ("/save [name]", "save this conversation"),
    ("/resume", "list saved conversations"),
    ("/export [file]", "write transcript to markdown"),
    ("/copy", "copy last reply to clipboard"),
    ("/tokens", "context usage report"),
    ("/retry", "regenerate the last response"),
    ("/compact", "trim history to fit the budget"),
    ("/clear", "clear the transcript"),
    ("/reset", "clear transcript AND context files"),
    ("/cost", "cost dashboard summary"),
    ("/exit", "quit"),
];

struct ChatMessage {
    role: Role,
    content: String,
    /// Rendered meta line (e.g. "1.2s · ~350 tok · cached") for assistant replies.
    meta: Option<String>,
}

#[derive(PartialEq, Clone, Copy)]
enum Role {
    User,
    Assistant,
    System,
    Error,
}

impl Role {
    fn as_str(&self) -> &'static str {
        match self {
            Role::User => "user",
            Role::Assistant => "assistant",
            Role::System => "system",
            Role::Error => "error",
        }
    }
}

impl ChatState {
    fn new(model_label: String) -> Self {
        Self {
            input: String::new(),
            messages: Vec::new(),
            input_mode: InputMode::Editing,
            scroll_offset: 0,
            follow: true,
            max_scroll: 0,
            model_label,
            pending: false,
            history: Vec::new(),
            history_idx: None,
            draft: String::new(),
            session_id: None,
            context_files: Vec::new(),
            pending_context: Vec::new(),
            dirty: true,
            working_spec: None,
            pending_label: String::new(),
            palette: None,
        }
    }

    fn push(&mut self, role: Role, content: impl Into<String>) {
        self.messages.push(ChatMessage { role, content: content.into(), meta: None });
    }


    /// Record a sent message (dedup consecutive) for history recall.
    fn record_history(&mut self, text: &str) {
        if self.history.last().map(String::as_str) != Some(text) {
            self.history.push(text.to_string());
        }
        self.history_idx = None;
        self.draft.clear();
    }

    /// Move back (older) through history.
    fn history_prev(&mut self) {
        if self.history.is_empty() {
            return;
        }
        match self.history_idx {
            None => {
                self.draft = self.input.clone();
                self.history_idx = Some(self.history.len() - 1);
                self.input = self.history[self.history.len() - 1].clone();
            }
            Some(i) if i > 0 => {
                self.history_idx = Some(i - 1);
                self.input = self.history[i - 1].clone();
            }
            Some(_) => {} // already at oldest
        }
    }

    /// Move forward (newer) through history; returns to the draft at the end.
    fn history_next(&mut self) {
        match self.history_idx {
            Some(i) if i + 1 < self.history.len() => {
                self.history_idx = Some(i + 1);
                self.input = self.history[i + 1].clone();
            }
            Some(_) => {
                self.history_idx = None;
                self.input = std::mem::take(&mut self.draft);
            }
            None => {}
        }
    }
}

// ---------------------------------------------------------------------------
// Entry points
// ---------------------------------------------------------------------------

pub async fn async_chat(cfg: &Config, initial_prompt: Option<&str>) -> Result<()> {
    let (provider, model) = resolve_with_fallback(cfg, &cfg.routing.quick_chat.clone());
    let model_label = format!("{}/{}", provider.name(), model);

    let mut state = ChatState::new(model_label.clone());
    // Resume the most recent conversation so you pick up where you left off.
    if !resume_latest_session(&mut state) {
        state.push(
            Role::System,
            "Welcome to Morse ◆\nJust type naturally — I can read files (@path), run commands (/run), and edit code.\n\n  /help         all commands\n  Tab           complete @paths and commands\n  ↑ / ↓         message history\n\nCtrl+C quits.",
        );
    }

    // Recall sent-message history from previous sessions (↑ works across runs).
    load_persisted_history(&mut state);

    // Handle an initial one-shot prompt before entering the loop.
    if let Some(prompt) = initial_prompt {
        state.push(Role::User, prompt.to_string());
        answer(&mut state, cfg, prompt).await;
    }

    let mut stdout = io::stdout();
    enable_raw_mode()?;
    execute!(stdout, EnterAlternateScreen, crossterm::event::EnableBracketedPaste)?;
    let backend = CrosstermBackend::new(io::stdout());
    let mut terminal: Terminal<CrosstermBackend<io::Stdout>> = Terminal::new(backend)?;

    let result = run_loop(&mut terminal, cfg, &mut state).await;

    disable_raw_mode()?;
    execute!(io::stdout(), crossterm::event::DisableBracketedPaste, LeaveAlternateScreen)?;
    terminal.show_cursor()?;

    // Persist the conversation so the next launch resumes it.
    if result.is_ok() {
        persist_session(&state);
    }
    result
}

/// Load the most recent persisted session into `state`. Returns true when a
/// non-empty conversation was restored.
fn resume_latest_session(state: &mut ChatState) -> bool {
    let Ok(store) = crate::session::SessionStore::new() else {
        return false;
    };
    let Some(sess) = store.latest() else { return false };
    if sess.messages.is_empty() {
        return false;
    }
    let restored: Vec<ChatMessage> = sess
        .messages
        .iter()
        .map(|m| ChatMessage {
            role: match m.role.as_str() {
                "user" => Role::User,
                "assistant" => Role::Assistant,
                "system" => Role::System,
                _ => Role::Error,
            },
            content: m.content.clone(),
            meta: None,
        })
        .collect();
    let n = restored.len();
    state.messages.extend(restored);
    state.session_id = Some(sess.id.clone());
    // Replay history so ↑ recalls what you sent before.
    let sent: Vec<String> = state
        .messages
        .iter()
        .filter(|m| m.role == Role::User)
        .map(|m| m.content.clone())
        .collect();
    for s in sent {
        state.record_history(&s);
    }
    state.push(
        Role::System,
        format!("Resumed session '{}' ({} messages). /clear to start fresh.", sess.name, n),
    );
    true
}

// ---------------------------------------------------------------------------
// Persistent input history (↑ recalls messages from previous sessions)
// ---------------------------------------------------------------------------

fn history_file() -> Option<std::path::PathBuf> {
    std::env::current_dir()
        .ok()
        .map(|r| r.join(".morse/history.json"))
}

const MAX_PERSISTED_HISTORY: usize = 200;

/// Load sent-message history from disk into the session.
fn load_persisted_history(state: &mut ChatState) {
    let Some(path) = history_file() else { return };
    let Ok(text) = std::fs::read_to_string(&path) else { return };
    let Ok(items) = serde_json::from_str::<Vec<String>>(&text) else { return };
    for item in items {
        state.history.push(item);
    }
    // Keep the newest MAX entries.
    if state.history.len() > MAX_PERSISTED_HISTORY {
        let drop = state.history.len() - MAX_PERSISTED_HISTORY;
        state.history.drain(..drop);
    }
    state.history_idx = None;
}

/// Append a sent message to the persisted history (bounded).
fn append_persisted_history(text: &str) {
    let Some(path) = history_file() else { return };
    let mut items: Vec<String> = std::fs::read_to_string(&path)
        .ok()
        .and_then(|t| serde_json::from_str(&t).ok())
        .unwrap_or_default();
    if items.last().map(String::as_str) == Some(text) {
        return; // dedup consecutive
    }
    items.push(text.to_string());
    if items.len() > MAX_PERSISTED_HISTORY {
        let drop = items.len() - MAX_PERSISTED_HISTORY;
        items.drain(..drop);
    }
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let _ = std::fs::write(&path, serde_json::to_string(&items).unwrap_or_default());
}

/// Save the current transcript now, optionally (re)named. Returns a message.
fn save_session_named(state: &ChatState, name: Option<String>) -> anyhow::Result<String> {
    let mut store = crate::session::SessionStore::new()?;
    if state.messages.iter().all(|m| m.role != Role::User) {
        return Ok("Nothing to save yet — send a message first.".to_string());
    }
    let id = match &state.session_id {
        Some(id) => id.clone(),
        None => {
            let auto = state
                .messages
                .iter()
                .find(|m| m.role == Role::User)
                .map(|m| m.content.chars().take(32).collect::<String>())
                .unwrap_or_else(|| "chat".into());
            store.create(name.clone().unwrap_or(auto))
        }
    };
    if let Ok(Some(mut existing)) = store.load(&id) {
        if let Some(n) = name {
            existing.name = n;
        }
        existing.messages.clear();
        for m in &state.messages {
            if m.role == Role::System && m.content.starts_with("Resumed session") {
                continue;
            }
            existing.messages.push(crate::session::SessionMessage {
                role: m.role.as_str().to_string(),
                content: m.content.clone(),
                timestamp: chrono::Utc::now(),
                tokens: None,
            });
        }
        existing.updated_at = chrono::Utc::now();
        store.replace(&id, existing)?;
    }
    Ok(format!("Saved conversation '{}'", id))
}

/// Write the current transcript back to its session (creating one if needed).
fn persist_session(state: &ChatState) {
    let Ok(mut store) = crate::session::SessionStore::new() else {
        return;
    };
    let id = match &state.session_id {
        Some(id) => id.clone(),
        None => {
            // Name the session after the first user message (truncated).
            let name = state
                .messages
                .iter()
                .find(|m| m.role == Role::User)
                .map(|m| {
                    let t: String = m.content.chars().take(32).collect();
                    t
                })
                .unwrap_or_else(|| "chat".to_string());
            store.create(name)
        }
    };
    // Rebuild the stored messages from the current transcript.
    if let Ok(Some(mut existing)) = store.load(&id) {
        existing.messages.clear();
        for m in &state.messages {
            if m.role == Role::System && m.content.starts_with("Resumed session") {
                continue;
            }
            existing.messages.push(crate::session::SessionMessage {
                role: m.role.as_str().to_string(),
                content: m.content.clone(),
                timestamp: chrono::Utc::now(),
                tokens: None,
            });
        }
        let _ = store.replace(&id, existing);
    }
}


/// Synchronous wrapper kept for callers that don't await.
pub fn chat(cfg: &Config) -> Result<()> {
    let rt = tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()?;
    rt.block_on(async_chat(cfg, None))
}

pub fn tui_chat(cfg: &Config) -> Result<()> {
    chat(cfg)
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

async fn run_loop<B: Backend + Send>(
    terminal: &mut Terminal<B>,
    cfg: &Config,
    state: &mut ChatState,
) -> Result<()> {
    loop {
        // Perf: only redraw when something changed (or while streaming) —
        // ratatui diffs buffers, but waking + redrawing every 120ms while idle
        // still burns CPU for no visual benefit.
        if state.dirty || state.pending {
            terminal.draw(|f| render(f, state))?;
            state.dirty = false;
        }

        if !event::poll(std::time::Duration::from_millis(120))? {
            continue;
        }
        match event::read()? {
            Event::Paste(text) => {
                // Developers paste code: keep newlines in the message, don't
                // treat them as Enter. The input box shows the first line.
                let cleaned = text.replace("\r\n", "\n").replace('\r', "\n");
                let n_lines = cleaned.lines().count();
                state.input.push_str(&cleaned);
                if n_lines > 1 {
                    state.push(Role::System, format!("Pasted {} lines — Enter to send.", n_lines));
                }
                update_palette(state);
                state.dirty = true;
            }
            Event::Key(KeyEvent { code, kind, modifiers, .. }) => {
                if kind != KeyEventKind::Press {
                    continue;
                }
                // Any key press may change state; redraw after handling.
                state.dirty = true;

                // Global: Ctrl+C always quits.
                if modifiers.contains(KeyModifiers::CONTROL) && matches!(code, KeyCode::Char('c')) {
                    break;
                }

                match state.input_mode {
            InputMode::Editing => match code {
                KeyCode::Enter => {
                    // Palette open? Enter picks the highlighted suggestion
                    // (the natural behavior — Claude Code does the same).
                    if state.palette.is_some() {
                        accept_palette(state);
                        update_palette(state);
                        continue;
                    }
                    let input = state.input.trim().to_string();
                    state.input.clear();
                    if input.is_empty() {
                        continue;
                    }
                    state.record_history(&input);
                    append_persisted_history(&input);
                    if matches!(input.as_str(), "/exit" | "/quit" | "exit" | "quit") {
                        state.push(Role::System, "Goodbye!");
                        terminal.draw(|f| render(f, state))?;
                        break;
                    }
                    // /retry: drop the last response and regenerate it.
                    if input == "/retry" {
                        retry_last(terminal, state, cfg).await?;
                        continue;
                    }
                    // Async slash commands (may take seconds) — handled here so
                    // they can await without freezing the sync dispatcher.
                    if input == "/mcp" || input.starts_with("/mcp ") {
                        state.push(Role::System, "Connecting to MCP servers…".to_string());
                        terminal.draw(|f| render(f, state))?;
                        let lines = tokio::task::spawn_blocking(|| {
                            let root = std::env::current_dir().unwrap_or_default();
                            let mut client = crate::mcp::MCPClient::new();
                            match client.load_config(&root) {
                                Ok(0) => vec![
                                    "No MCP servers configured.".to_string(),
                                    "Create .morse/mcp.json:".to_string(),
                                    "  {\"servers\":[{\"name\":\"fs\",\"command\":\"npx\",\"args\":[\"-y\",\"@modelcontextprotocol/server-filesystem\",\".\"]}]}".to_string(),
                                ],
                                Ok(_) => {
                                    let mut out = vec![format!("{} server(s) configured:", client.server_names().len())];
                                    for name in client.server_names() {
                                        match client.connect(&name) {
                                            Ok(tools) => {
                                                out.push(format!("  ✓ {} — {} tools", name, tools.len()));
                                                for t in tools.iter().take(6) {
                                                    out.push(format!("      {} — {}", t.name, t.description.chars().take(60).collect::<String>()));
                                                }
                                            }
                                            Err(e) => out.push(format!("  ✗ {} — {}", name, e)),
                                        }
                                    }
                                    out
                                }
                                Err(e) => vec![format!("Failed to read .morse/mcp.json: {}", e)],
                            }
                        })
                        .await
                        .unwrap_or_else(|e| vec![format!("/mcp failed: {}", e)]);
                        state.messages.pop(); // remove "Connecting…"
                        state.push(Role::System, lines.join("\n"));
                        update_palette(state);
                        continue;
                    }
                    if input == "/commit" || input.starts_with("/commit ") {
                        let root = std::env::current_dir().unwrap_or_default();
                        if !crate::vcs::is_repo(&root) {
                            state.push(Role::Error, "/commit: not a git repository".to_string());
                            continue;
                        }
                        let stat = crate::vcs::status_porcelain(&root).unwrap_or_default();
                        if stat.trim().is_empty() {
                            state.push(Role::System, "Working tree clean — nothing to commit.".to_string());
                            continue;
                        }
                        state.push(Role::User, "/commit".to_string());
                        state.pending = true;
                        state.pending_label = "generating commit message".into();
                        terminal.draw(|f| render(f, state))?;
                        let diff = crate::vcs::diff(&root, false).unwrap_or_default();
                        let prompt = format!(
                            "Write a conventional commit message (type(scope): summary + body) for these changes.\n\nChanged files:\n{}\n\nDiff (truncated):\n{}",
                            stat,
                            diff.chars().take(6000).collect::<String>()
                        );
                        let (provider, model) = crate::providers::resolve_with_fallback(cfg, &cfg.routing.default.clone());
                        let req = CompletionRequest::new(&model, &prompt).with_system(&system_prompt());
                        let result = provider.complete(req).await;
                        state.pending = false;
                        state.pending_label.clear();
                        match result {
                            Ok(resp) => {
                                crate::cost::record_call(&resp.provider, &resp.model, resp.input_tokens as i64, resp.output_tokens as i64);
                                state.push(Role::Assistant, format!("Suggested commit:\n\n{}\n\n(use: git commit -m \"…\")", resp.content.trim()));
                                state.working_spec = Some(cfg.routing.default.clone());
                            }
                            Err(e) => state.push(Role::Error, format!("/commit failed: {}", e.display())),
                        }
                        state.follow = true;
                        terminal.draw(|f| render(f, state))?;
                        continue;
                    }
                    // Only route slash-prefixed input to the command handler —
                    // plain messages must go to the model (regression: "hi"
                    // used to hit the catch-all and never reach the AI).
                    // /model with no arg: show REAL model lists (fetched from
                    // each configured provider, TTL-cached on disk).
                    if input == "/model" {
                        state.push(Role::System, "Fetching model lists…".to_string());
                        terminal.draw(|f| render(f, state))?;
                        let mut lines = vec![format!("Current: {}", state.model_label), String::new()];
                        let cfg2 = cfg.clone();
                        let providers_cfg = cfg2.providers.clone();
                        let pairs: Vec<(&str, Option<String>)> = [
                            ("groq", providers_cfg.groq.clone()),
                            ("openai", providers_cfg.openai.clone()),
                            ("anthropic", providers_cfg.anthropic.clone()),
                            ("gemini", providers_cfg.gemini.clone()),
                            ("deepseek", providers_cfg.deepseek.clone()),
                            ("mistral", providers_cfg.mistral.clone()),
                        ]
                        .iter()
                        .filter(|(_, k)| !k.is_empty())
                        .map(|(p, k)| (*p, Some(k.clone())))
                        .collect();
                        for (prov, key) in pairs {
                            let models =
                                crate::providers::cached_models(prov, key.as_deref(), false).await;
                            if models.is_empty() {
                                lines.push(format!("  {} (unavailable)", prov));
                            } else {
                                lines.push(format!("  {}:", prov));
                                for m in models.iter().take(5) {
                                    lines.push(format!("    /model {}/{}", prov, m));
                                }
                                if models.len() > 5 {
                                    lines.push(format!("    … +{} more", models.len() - 5));
                                }
                            }
                        }
                        state.messages.pop(); // remove "Fetching…"
                        state.push(
                            Role::System,
                            format!("{}\n\nCopy a /model line to switch. Lists cached 6h.", lines.join("\n")),
                        );
                        update_palette(state);
                        continue;
                    }
                    // /test + /lint: run real project checks; on failure the
                    // output is attached to the next message so the AI fixes it.
                    if input == "/test" || input == "/lint" {
                        let is_test = input == "/test";
                        let which = if is_test { "test" } else { "build" };
                        state.push(
                            Role::System,
                            format!("Running project {}…", if is_test { "tests" } else { "build/vet checks" }),
                        );
                        terminal.draw(|f| render(f, state))?;
                        let lines = tokio::task::spawn_blocking(move || {
                            let root = std::env::current_dir().unwrap_or_default();
                            match crate::verify::run_checks(&root, Some(which)) {
                                Ok(report) => {
                                    let mut out = vec![format!(
                                        "{} checks on {} project:",
                                        if is_test { "Test" } else { "Build" },
                                        report.toolchain.as_str()
                                    )];
                                    for c in &report.checks {
                                        out.push(format!(
                                            "  {} {} ({:.1}s)",
                                            if c.ok { "✓" } else { "✗" },
                                            c.name,
                                            c.duration.as_secs_f64()
                                        ));
                                    }
                                    if report.passed() {
                                        out.push("All checks passed ✓".to_string());
                                    } else {
                                        out.push(String::new());
                                        out.push("Failures:".to_string());
                                        out.push(report.failure_feedback(4000));
                                    }
                                    out
                                }
                                Err(e) => vec![format!("verify failed: {}", e)],
                            }
                        })
                        .await
                        .unwrap_or_else(|e| vec![format!("{} failed: {}", cmd_name(&input), e)]);
                        state.messages.pop(); // remove "Running…"
                        let joined = lines.join("\n");
                        if joined.contains("✗") {
                            state.pending_context.push(format!(
                                "Project checks failed:\n{}\n\n(Fix these.)",
                                joined
                            ));
                            state.push(Role::Error, joined);
                            state.push(Role::System, "Failure output attached — say \"fix it\" or describe the fix.".to_string());
                        } else {
                            state.push(Role::System, joined);
                        }
                        update_palette(state);
                        continue;
                    }
                    if input.starts_with('/') && handle_slash(state, &input, cfg) {
                        continue;
                    }
                    // Display the original text (with the @mention shorthand),
                    // but expand file contents for the model before sending.
                    state.push(Role::User, input.clone());
                    let root = std::env::current_dir().unwrap_or_default();
                    let expanded0 = if input.contains('@') {
                        crate::context::expand_mentions(&input, &root)
                    } else {
                        input.clone()
                    };
                    // Prepend /run output and persistent /add files.
                    let pending = std::mem::take(&mut state.pending_context);
                    let ctx_files = state.context_files.clone();
                    let expanded =
                        build_prompt_with_context(&expanded0, &ctx_files, &pending, &root, 8_000);
                    answer_streaming(terminal, state, cfg, &expanded).await?;
                }
                KeyCode::Up => {
                    if state.palette.is_some() {
                        palette_up(state);
                    } else {
                        state.history_prev();
                    }
                }
                KeyCode::Down => {
                    if state.palette.is_some() {
                        palette_down(state);
                    } else {
                        state.history_next();
                    }
                }
                KeyCode::Tab => {
                    // Palette open? Accept the highlighted suggestion.
                    if state.palette.is_some() {
                        accept_palette(state);
                        update_palette(state);
                        continue;
                    }
                    // Complete a trailing @path against the filesystem.
                    if let Some((completed, candidates)) =
                        complete_at(&state.input, &std::env::current_dir().unwrap_or_default(), 12)
                    {
                        let (at_idx, partial) = trailing_at_token(&state.input).unwrap();
                        let candidate = if candidates.len() == 1 {
                            candidates[0].clone()
                        } else {
                            completed
                        };
                        // Replace the partial token (after '@') with the completion.
                        let head = state.input[..at_idx + 1].to_string();
                        let tail = state.input[at_idx + 1 + partial.len()..].to_string();
                        state.input = format!("{}{}{}", head, candidate, tail);
                        if candidates.len() > 1 {
                            state.push(
                                Role::System,
                                format!("Completions: {}", candidates.join("  ")),
                            );
                        }
                    }
                }
                KeyCode::Backspace => {
                    state.input.pop();
                    update_palette(state);
                }
                KeyCode::Esc => {
                    if state.palette.take().is_some() {
                        state.dirty = true;
                    } else {
                        state.input_mode = InputMode::Normal;
                    }
                }
                KeyCode::Left => {}
                KeyCode::Char('u') if modifiers.contains(KeyModifiers::CONTROL) => {
                    state.input.clear();
                    update_palette(state);
                }
                KeyCode::Char('w') if modifiers.contains(KeyModifiers::CONTROL) => {
                    pop_word(&mut state.input);
                    update_palette(state);
                }
                KeyCode::Char('a') if modifiers.contains(KeyModifiers::CONTROL) => {}
                KeyCode::Char('l') if modifiers.contains(KeyModifiers::CONTROL) => {
                    // Ctrl+L clears the transcript view (keeps input).
                    state.scroll_offset = 0;
                }
                KeyCode::Char(c) => {
                    state.input.push(c);
                    update_palette(state);
                }
                _ => {}
            },
            InputMode::Normal => match code {
                KeyCode::Char('q') | KeyCode::Char('Q') => break,
                KeyCode::Char('/') => state.input_mode = InputMode::Editing,
                KeyCode::Char('i') => state.input_mode = InputMode::Editing,
                // Scroll up (toward older content): leave follow mode.
                KeyCode::Char('k') | KeyCode::Up => {
                    state.follow = false;
                    state.scroll_offset = state.scroll_offset.saturating_sub(3);
                }
                // Scroll down (toward newest): re-enter follow at the bottom.
                KeyCode::Char('j') | KeyCode::Down => {
                    state.scroll_offset = state.scroll_offset.saturating_add(3);
                    if state.scroll_offset >= state.max_scroll {
                        state.follow = true;
                    }
                }
                // Jump straight back to the newest message.
                KeyCode::Char('G') => {
                    state.follow = true;
                }
                KeyCode::Esc => state.input_mode = InputMode::Editing,
                _ => {}
            },
                } // match state.input_mode
                } // Event::Key arm
            _ => {} // other crossterm events
        } // match event::read
    }
    Ok(())
}

/// Refresh the palette from the current input. Slash palette while typing a
/// bare command; file palette while typing an @path.
fn update_palette(state: &mut ChatState) {
    let root = std::env::current_dir().unwrap_or_default();
    let input = state.input.clone();

    state.palette = if input.starts_with('/') && !input.contains(' ') {
        // If the input is already an exact command, let Enter execute it —
        // no palette in the way (e.g. "/model" should run, not select "/models").
        let exact = SLASH_INFO
            .iter()
            .any(|(cmd, _)| cmd.split_whitespace().next() == Some(input.as_str()));
        if exact {
            None
        } else {
            let matches: Vec<(String, String, String)> = SLASH_INFO
                .iter()
                .filter(|(cmd, _)| cmd.starts_with(&input))
                .map(|(label, desc)| {
                    let insert = label.split_whitespace().next().unwrap_or(label).to_string();
                    (insert, label.to_string(), desc.to_string())
                })
                .collect();
            if matches.is_empty() {
                None
            } else {
                Some(Palette { kind: PaletteKind::Slash, items: matches, selected: 0 })
            }
        }
    } else if trailing_at_token(&input).is_some() {
        match complete_at(&input, &root, 9) {
            Some((_, cands)) => {
                let items: Vec<(String, String, String)> = cands
                    .into_iter()
                    .map(|c| {
                        let desc = if c.ends_with('/') {
                            "directory — Tab to descend".to_string()
                        } else {
                            "Tab to insert".to_string()
                        };
                        (c.clone(), c, desc)
                    })
                    .collect();
                if items.is_empty() {
                    None
                } else {
                    Some(Palette { kind: PaletteKind::AtFile, items, selected: 0 })
                }
            }
            None => None,
        }
    } else {
        None
    };
}

/// Apply the palette's selected item to the input line.
fn accept_palette(state: &mut ChatState) {
    let Some(palette) = state.palette.clone() else { return };
    let Some((insert, _, _)) = palette.items.get(palette.selected) else { return };
    let insert = insert.clone();
    match palette.kind {
        PaletteKind::Slash => {
            state.input = format!("{} ", insert);
        }
        PaletteKind::AtFile => {
            if let Some((at_idx, partial)) = trailing_at_token(&state.input) {
                let head = state.input[..at_idx + 1].to_string();
                let tail = state.input[at_idx + 1 + partial.len()..].to_string();
                let sep = if insert.ends_with('/') { "" } else { " " };
                state.input = format!("{}{}{}{}", head, insert, sep, tail);
            }
        }
    }
    state.palette = None;
    state.dirty = true;
}

fn palette_up(state: &mut ChatState) {
    if let Some(p) = state.palette.as_mut() {
        p.selected = p.selected.saturating_sub(1);
        state.dirty = true;
    }
}

fn palette_down(state: &mut ChatState) {
    if let Some(p) = state.palette.as_mut() {
        if p.selected + 1 < p.items.len() {
            p.selected += 1;
            state.dirty = true;
        }
    }
}

fn pop_word(s: &mut String) {
    while s.ends_with(' ') {
        s.pop();
    }
    if let Some(idx) = s.rfind(' ') {
        s.truncate(idx);
    } else {
        s.clear();
    }
}


/// Human label for a slash command (used in error messages).
fn cmd_name(input: &str) -> String {
    input.split_whitespace().next().unwrap_or(input).to_string()
}

/// Non-blocking check for a cancel key (Esc or Ctrl+C) while a generation is
/// streaming. Consumes the event so it doesn't leak into the main loop.
fn cancel_pressed() -> bool {
    use crossterm::event::{self, Event, KeyCode, KeyEventKind};
    while let Ok(true) = event::poll(std::time::Duration::from_millis(0)) {
        if let Ok(Event::Key(k)) = event::read() {
            if k.kind != KeyEventKind::Press {
                continue;
            }
            if k.code == KeyCode::Esc {
                return true;
            }
            if k.modifiers.contains(crossterm::event::KeyModifiers::CONTROL)
                && k.code == KeyCode::Char('c')
            {
                return true;
            }
            // Ignore other queued keys during streaming.
        }
    }
    false
}

/// Copy text to the system clipboard (macOS/Linux; best-effort).
fn copy_to_clipboard(text: &str) -> bool {
    let cmds: &[(&str, &[&str])] = &[
        ("pbcopy", &[]),
        ("xclip", &["-selection", "clipboard"]),
        ("wl-copy", &[]),
    ];
    for (cmd, args) in cmds {
        let child = std::process::Command::new(*cmd)
            .args(*args)
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .spawn();
        if let Ok(mut child) = child {
            if let Some(stdin) = child.stdin.as_mut() {
                use std::io::Write;
                if stdin.write_all(text.as_bytes()).is_ok() {
                    drop(child.stdin.take());
                    if child.wait().map(|s| s.success()).unwrap_or(false) {
                        return true;
                    }
                }
            }
            let _ = child.kill();
            let _ = child.wait();
        }
    }
    false
}

/// Returns true if the slash command was handled (so caller skips model call).
fn handle_slash(state: &mut ChatState, input: &str, cfg: &Config) -> bool {
    let mut parts = input.splitn(2, ' ');
    let cmd = parts.next().unwrap_or("");
    let arg = parts.next().unwrap_or("").trim();
    match cmd {
        "/help" => {
            state.push(
                Role::System,
                "COMMANDS\n  /add <file>       keep a file in every request\n  /drop <file>       remove from context\n  /ls                files in context\n  /run <cmd>         run shell; output joins next message\n  /graph <q>         search the code graph\n  /rag <q>           semantic code search\n  /memory …          add/get/search persistent notes\n  /mcp               external MCP tools\n  /commit            AI commit message from changes\n  /undo · /diff      git in-chat\n\nSESSION\n  /save [name]       save this conversation\n  /resume            list saved conversations\n  /export [file]     transcript → markdown\n\nMODEL & MISC\n  /models · /model   switch model\n  /cache            toggle/clear the response cache\n  /copy · /tokens · /cost · /retry · /compact\n  /clear (chat) · /reset (chat + context) · /exit\n\nINPUT\n  / or @             live palette · Tab accepts\n  ↑ / ↓              navigate palette, then history\n  Esc                dismiss palette · normal mode\n  Ctrl+U / Ctrl+W    clear line / delete word\n  Esc (streaming)    cancel generation",
            );
            true
        }
        "/add" => {
            if arg.is_empty() {
                state.push(Role::System, format!("Usage: /add <file>  (in context: {})", state.context_files.len()));
            } else {
                let root = std::env::current_dir().unwrap_or_default();
                let p = std::path::PathBuf::from(arg);
                let full = if p.is_absolute() { p } else { root.join(&p) };
                if !full.is_file() {
                    state.push(Role::Error, format!("/add: no such file: {}", arg));
                } else if state.context_files.iter().any(|f| f == arg) {
                    state.push(Role::System, format!("Already in context: {}", arg));
                } else {
                    state.context_files.push(arg.to_string());
                    state.push(Role::System, format!("Added to context: {} (now {} file(s))", arg, state.context_files.len()));
                }
            }
            true
        }
        "/drop" => {
            if let Some(pos) = state.context_files.iter().position(|f| f == arg) {
                state.context_files.remove(pos);
                state.push(Role::System, format!("Removed from context: {}", arg));
            } else {
                state.push(Role::System, format!("Not in context: {} (use /ls)", arg));
            }
            true
        }
        "/ls" => {
            if state.context_files.is_empty() {
                state.push(Role::System, "No files in context. Add with /add <file> or @path per message.".to_string());
            } else {
                let mut lines = vec![format!("Files in context ({}):", state.context_files.len())];
                for f in &state.context_files {
                    lines.push(format!("  {}", f));
                }
                state.push(Role::System, lines.join("\n"));
            }
            true
        }
        "/run" => {
            if arg.is_empty() {
                state.push(Role::System, "Usage: /run <command> — output joins your next message".to_string());
            } else {
                state.push(Role::User, format!("$ {}", arg));
                let output = std::process::Command::new("sh").arg("-c").arg(arg).output();
                match output {
                    Ok(o) => {
                        let mut text = String::from_utf8_lossy(&o.stdout).to_string();
                        let err = String::from_utf8_lossy(&o.stderr).to_string();
                        if !err.is_empty() {
                            if !text.is_empty() { text.push('\n'); }
                            text.push_str(&err);
                        }
                        let status = if o.status.success() { "ok" } else { "non-zero exit" };
                        let truncated: String = text.chars().take(4000).collect();
                        state.pending_context.push(format!(
                            "Output of `{}` ({}):\n```\n{}\n```",
                            arg, status, truncated
                        ));
                        state.push(Role::System, format!("Captured output ({} bytes) — it will be attached to your next message.", truncated.len()));
                    }
                    Err(e) => state.push(Role::Error, format!("/run failed: {}", e)),
                }
            }
            true
        }
        "/undo" => {
            let cfg2 = Config::default();
            match crate::rollback::rollback_last_change(&cfg2) {
                Ok(msg) => state.push(Role::System, format!("undo: {}", msg)),
                Err(e) => state.push(Role::Error, format!("undo failed: {}", e)),
            }
            true
        }
        "/diff" => {
            let root = std::env::current_dir().unwrap_or_default();
            match crate::vcs::diff(&root, false) {
                Ok(d) if d.trim().is_empty() => state.push(Role::System, "No uncommitted changes.".to_string()),
                Ok(d) => {
                    let shown: String = d.chars().take(4000).collect();
                    state.push(Role::System, format!("Working-tree diff:\n```\n{}\n```", shown));
                }
                Err(e) => state.push(Role::Error, format!("diff failed: {}", e)),
            }
            true
        }
        "/copy" => {
            let last = state.messages.iter().rev().find(|m| m.role == Role::Assistant);
            match last {
                Some(m) if !m.content.is_empty() => {
                    let copied = copy_to_clipboard(&m.content);
                    if copied {
                        state.push(Role::System, "Last response copied to clipboard.".to_string());
                    } else {
                        state.push(Role::Error, "No clipboard tool found (pbcopy/xclip/wl-copy).".to_string());
                    }
                }
                _ => state.push(Role::System, "No assistant response to copy yet.".to_string()),
            }
            true
        }
        "/tokens" => {
            let total_chars: usize = state.messages.iter().map(|m| m.content.len()).sum();
            let est = total_chars / 4;
            let ctx_files: usize = state.context_files.len();
            state.push(Role::System, format!(
                "~{}k tokens in transcript ({} msgs) + {} file(s) in context.\nGauge in the status bar shows the 128k budget.",
                est / 1000,
                state.messages.len(),
                ctx_files
            ));
            true
        }
        "/save" => {
            let name = if arg.is_empty() { None } else { Some(arg.to_string()) };
            match save_session_named(state, name) {
                Ok(msg) => state.push(Role::System, msg),
                Err(e) => state.push(Role::Error, format!("/save failed: {}", e)),
            }
            true
        }
        "/resume" => {
            match crate::session::SessionStore::new() {
                Ok(store) => {
                    let sessions = store.scan_disk();
                    if sessions.is_empty() {
                        state.push(Role::System, "No saved conversations yet.".to_string());
                    } else {
                        let mut lines = vec!["Saved conversations (newest first):".to_string()];
                        for s in sessions.iter().take(8) {
                            let when = s.updated_at.format("%m-%d %H:%M");
                            lines.push(format!(
                                "  {}  {:<24} {} msgs  {}",
                                &s.id[..8.min(s.id.len())],
                                s.name,
                                s.messages.len(),
                                when
                            ));
                        }
                        lines.push("Open in a new session: morse sessions resume <id>".to_string());
                        state.push(Role::System, lines.join("\n"));
                    }
                }
                Err(e) => state.push(Role::Error, format!("/resume failed: {}", e)),
            }
            true
        }
        "/graph" => {
            if arg.is_empty() {
                state.push(Role::System, "Usage: /graph <symbol or query>".to_string());
            } else {
                let root = std::env::current_dir().unwrap_or_default();
                let mut g = crate::graph::CodeGraph::new(&root);
                let gp = root.join(".morse").join("graph.json");
                let loaded = if gp.exists() { g.import(&gp).is_ok() && !g.get_all_symbols().is_empty() } else { false };
                if !loaded {
                    state.push(Role::System, "Building graph first (one moment)…".to_string());
                    if g.build().is_err() {
                        state.push(Role::Error, "/graph: failed to build".to_string());
                        return true;
                    }
                    let _ = g.export(&gp);
                }
                let results = g.query(arg).unwrap_or_default();
                if results.is_empty() {
                    state.push(Role::System, format!("No graph matches for '{}'", arg));
                } else {
                    let mut lines = vec![format!("Graph matches for '{}':", arg)];
                    for n in results.iter().take(6) {
                        lines.push(format!(
                            "  {} ({}) — {}:{}  callers={} callees={}",
                            n.name, n.kind, n.file, n.start_line, n.callers.len(), n.callees.len()
                        ));
                    }
                    state.push(Role::System, lines.join("\n"));
                }
            }
            true
        }
        "/rag" => {
            if arg.is_empty() {
                state.push(Role::System, "Usage: /rag <query>".to_string());
            } else {
                let root = std::env::current_dir().unwrap_or_default();
                let path = crate::rag::index_path(&root);
                match crate::rag::RagIndex::load(&path) {
                    Ok(index) if !index.is_empty() => {
                        let hits = index.search(arg, 5);
                        if hits.is_empty() {
                            state.push(Role::System, format!("No RAG matches for '{}'", arg));
                        } else {
                            let mut lines = vec![format!("Top matches for '{}':", arg)];
                            for (doc, score) in hits {
                                let file = doc.metadata["file"].as_str().unwrap_or("?");
                                let start = doc.metadata["start_line"].as_u64().unwrap_or(0);
                                lines.push(format!("  {:.3}  {}:{}  ({})", score, file, start, doc.id));
                            }
                            state.push(Role::System, lines.join("\n"));
                        }
                    }
                    _ => state.push(Role::System, "No RAG index yet — run 'morse rag-init' in your shell first.".to_string()),
                }
            }
            true
        }
        "/memory" => {
            let parts: Vec<&str> = arg.split_whitespace().collect();
            match crate::memory::MemoryStore::load_default() {
                Ok(mut store) => match parts.first().copied().unwrap_or("list") {
                    "add" | "set" if parts.len() >= 3 => {
                        let key = parts[1].to_string();
                        let value = parts[2..].join(" ");
                        match store.store(key.clone(), value) {
                            Ok(_) => state.push(Role::System, format!("Remembered: {} = {}", key, store.retrieve(&key).unwrap_or(&String::new()))),
                            Err(e) => state.push(Role::Error, format!("/memory: {}", e)),
                        }
                    }
                    "get" if parts.len() >= 2 => {
                        match store.retrieve(parts[1]) {
                            Some(v) => state.push(Role::System, format!("{} = {}", parts[1], v)),
                            None => state.push(Role::System, format!("No memory for '{}'", parts[1])),
                        }
                    }
                    "search" if !parts.is_empty() => {
                        let q = parts[1..].join(" ");
                        let hits = store.search(&q);
                        if hits.is_empty() {
                            state.push(Role::System, format!("No memories match '{}'", q));
                        } else {
                            let lines: Vec<String> = hits.iter().take(6).map(|e| format!("  {} = {}", e.key, e.value)).collect();
                            state.push(Role::System, format!("Memories matching '{}':\n{}", q, lines.join("\n")));
                        }
                    }
                    _ => {
                        let entries = store.list();
                        if entries.is_empty() {
                            state.push(Role::System, "Memory is empty. /memory add <key> <value>".to_string());
                        } else {
                            let lines: Vec<String> = entries.iter().take(8).map(|e| format!("  {} = {}", e.key, e.value)).collect();
                            state.push(Role::System, format!("Memories:\n{}", lines.join("\n")));
                        }
                    }
                },
                Err(e) => state.push(Role::Error, format!("/memory: {}", e)),
            }
            true
        }
        "/export" => {
            let path = match arg.is_empty() {
                true => {
                    let ts = chrono::Utc::now().format("%Y%m%d-%H%M%S");
                    std::env::current_dir().unwrap_or_default().join(format!(".morse/chat-{}.md", ts))
                }
                false => std::path::PathBuf::from(arg),
            };
            let mut md = format!("# Morse chat — {}\n\n", chrono::Utc::now().format("%Y-%m-%d %H:%M UTC"));
            for m in &state.messages {
                let who = match m.role {
                    Role::User => "You",
                    Role::Assistant => "Morse",
                    Role::System => "System",
                    Role::Error => "Error",
                };
                md.push_str(&format!("**{}**: {}\n\n", who, m.content));
            }
            match std::fs::write(&path, md) {
                Ok(_) => state.push(Role::System, format!("Transcript exported to {}", path.display())),
                Err(e) => state.push(Role::Error, format!("/export failed: {}", e)),
            }
            true
        }
        "/reset" => {
            state.messages.clear();
            state.context_files.clear();
            state.pending_context.clear();
            state.push(Role::System, "Transcript and context files cleared.".to_string());
            true
        }
        "/cache" => {
            let cache = crate::ccache::CompletionCache::new(cfg);
            match arg {
                "off" | "disable" => {
                    let _ = cache.set_enabled(false);
                    state.push(Role::System, "Completion cache disabled — every ask hits the provider.".to_string());
                }
                "on" | "enable" => {
                    let _ = cache.set_enabled(true);
                    state.push(Role::System, "Completion cache enabled — identical asks answer instantly ⚡".to_string());
                }
                "clear" => match cache.clear() {
                    Ok(n) => state.push(Role::System, format!("Cleared {} cached response(s).", n)),
                    Err(e) => state.push(Role::Error, format!("/cache clear failed: {}", e)),
                },
                _ => {
                    let (enabled, hits, misses, writes) = cache.stats();
                    let rate = if hits + misses > 0 {
                        format!("{:.0}%", hits as f64 / (hits + misses) as f64 * 100.0)
                    } else {
                        "—".to_string()
                    };
                    state.push(Role::System, format!(
                        "Completion cache: {}\n  hits {} · misses {} · writes {} · hit rate {}\n\n/cache off · /cache on · /cache clear\nIdentical asks (same model+prompt) answer instantly ⚡",
                        if enabled { "ON" } else { "OFF" },
                        hits, misses, writes, rate
                    ));
                }
            }
            true
        }
        "/models" => {
            // Configured providers + defaults, plus cached live list sizes.
            let mut lines = vec![format!("Current: {}", state.model_label), String::new()];
            for provider in ["groq", "openai", "anthropic", "gemini", "deepseek", "ollama"] {
                if cfg.get_provider_key(provider).is_some() || provider == "ollama" {
                    let model = crate::providers::default_model_for_pub(cfg, provider);
                    lines.push(format!("  /model {}/{}", provider, model));
                }
            }
            lines.push(String::new());
            lines.push("Live model lists: /model (cached 6h) — refresh: 'morse models --refresh'".into());
            state.push(Role::System, lines.join("\n"));
            true
        }
        "/model" => {
            if arg.is_empty() {
                state.push(Role::System, format!("Current model: {}", state.model_label));
            } else {
                state.model_label = arg.to_string();
                state.push(Role::System, format!("Model switched to {}", arg));
            }
            true
        }
        "/clear" => {
            state.messages.clear();
            state.push(Role::System, "Transcript cleared.");
            true
        }
        "/compact" => {
            let before = state.messages.len();
            let as_tuples: Vec<(String, String)> = state
                .messages
                .iter()
                .filter(|m| !matches!(m.role, Role::System))
                .map(|m| (m.role.as_str().to_string(), m.content.clone()))
                .collect();
            // Keep ~8k chars of the most recent context.
            let trimmed = crate::context::trim_history(&as_tuples, 8_000);
            let after = trimmed.len();
            if after < before {
                // Rebuild the transcript from the trimmed view.
                let mut rebuilt: Vec<ChatMessage> = Vec::new();
                for (role, content) in trimmed {
                    let r = match role.as_str() {
                        "user" => Role::User,
                        "assistant" => Role::Assistant,
                        "error" => Role::Error,
                        _ => Role::System,
                    };
                    rebuilt.push(ChatMessage { role: r, content, meta: None });
                }
                state.messages = rebuilt;
                state.push(
                    Role::System,
                    format!("Compacted: {} → {} messages (older turns trimmed).", before, after),
                );
            } else {
                state.push(Role::System, "Nothing to compact — history already fits the budget.");
            }
            true
        }
        "/cost" => {
            state.push(
                Role::System,
                "Costs depend on your provider. Groq & Ollama are free; OpenAI/Anthropic bill per token. Use 'morse cost' for tracked usage.",
            );
            true
        }
        "/exit" | "/quit" => {
            state.push(Role::System, "Use Ctrl+C or type /exit then Enter.");
            true
        }
        _ => {
            state.push(Role::System, format!("Unknown command {}. Try /help.", cmd));
            true
        }
    }
}

/// Non-streaming answer path (used for initial prompt).
async fn answer(state: &mut ChatState, cfg: &Config, prompt: &str) {
    let (provider, model) = resolve_with_fallback(cfg, &cfg.routing.quick_chat.clone());
    let mut req = CompletionRequest::new(&model, prompt).with_system(&system_prompt());
    req.messages = history_messages(state, prompt);
    match provider.complete(req).await {
        Ok(resp) => {
            crate::cost::record_call(&resp.provider, &resp.model, resp.input_tokens as i64, resp.output_tokens as i64);
            state.model_label = format!("{}/{}", resp.provider, resp.model);
            state.push(Role::Assistant, resp.content);
        }
        Err(e) => state.push(Role::Error, e.display()),
    }
}

/// Drop the last assistant/error response and re-generate it from the last
/// user message.
async fn retry_last<B: Backend + Send>(
    terminal: &mut Terminal<B>,
    state: &mut ChatState,
    cfg: &Config,
) -> Result<()> {
    // Find the last user message index.
    let Some(last_user) = state
        .messages
        .iter()
        .rposition(|m| m.role == Role::User)
    else {
        state.push(Role::System, "Nothing to retry — send a message first.");
        return Ok(());
    };
    let prompt = state.messages[last_user].content.clone();
    // Truncate everything after the user's prompt (drops the old response).
    state.messages.truncate(last_user + 1);
    answer_streaming(terminal, state, cfg, &prompt).await
}

/// Streaming answer path with a live "typing" indicator.
async fn answer_streaming<B: Backend + Send>(
    terminal: &mut Terminal<B>,
    state: &mut ChatState,
    cfg: &Config,
    prompt: &str,
) -> Result<()> {
    state.pending = true;

    // Exact re-ask: if the user repeats the previous question, drop the stale
    // (question, answer) pair so this request is byte-identical to the first
    // one — the cache then hits, and the stale answer is replaced in place.
    {
        let n = state.messages.len();
        if n >= 3 {
            let same = {
                let u_prev = &state.messages[n - 3];
                let a_prev = &state.messages[n - 2];
                let u_new = &state.messages[n - 1];
                u_prev.role == Role::User
                    && a_prev.role == Role::Assistant
                    && u_new.role == Role::User
                    && u_prev.content == u_new.content
            };
            if same {
                state.messages.truncate(n - 2);
            }
        }
    }

    state.push(Role::Assistant, String::new());
    terminal.draw(|f| render(f, state))?;

    let history = history_messages(state, prompt);

    // ── Completion cache: identical prompts answer instantly, for free. ──
    let started = std::time::Instant::now();
    let cache = crate::ccache::CompletionCache::new(cfg);
    if cache.is_enabled() {
        let sys = system_prompt();
        let msgs = serde_json::to_string(&history).unwrap_or_default();
        let key = crate::ccache::cache_key(&cfg.routing.default, &sys, &msgs, 0.7, 8192);
        if let Ok(Some(entry)) = cache.get(&key) {
            let content = entry.response["content"].as_str().unwrap_or("").to_string();
            if !content.is_empty() {
                state.pending = false;
                state.pending_label.clear();
                let slot = state.messages.last_mut().unwrap();
                slot.content = content;
                slot.meta = Some("~0s · cached ⚡".to_string());
                state.model_label = format!("{}/{}", entry.provider, entry.model);
                state.follow = true;
                terminal.draw(|f| render(f, state))?;
                return Ok(());
            }
        }
    }

    // The assistant reply slot, fixed for the whole fallback chain. System
    // notices pushed during the chain land AFTER this index, so streaming
    // always writes to the right bubble (regression: each retry re-captured
    // `last` and replies landed in / destroyed system notices).
    let msg_idx = state.messages.len() - 1;

    // Try the cached working spec first (session memory OR the persisted one
    // from a previous session — no repeated dead-provider round-trips);
    // otherwise walk the fallback chain.
    let chain: Vec<String> = match state
        .working_spec
        .clone()
        .or_else(crate::providers::load_working_spec)
    {
        Some(spec) => vec![spec],
        None => crate::providers::fallback_model_specs(cfg),
    };

    let mut last_err: Option<String> = None;
    let mut outcome: Option<crate::providers::CompletionResponse> = None;
    let mut used_spec: Option<String> = None;

    for spec in &chain {
        let (provider, model) = crate::providers::resolve_with_fallback(cfg, spec);
        if provider.validate_key().await.is_err() {
            continue;
        }
        // Live feedback: show which backend we're waiting on.
        state.pending_label = format!("{} · {}", spec, model);
        let _ = terminal.draw(|f| render(f, state));
        let mut req = CompletionRequest::new(&model, prompt).with_system(&system_prompt());
        req.messages = history.clone();
        req.temperature = Some(0.7);

        // Run the stream in a task and keep the UI responsive: chunks arrive
        // over a channel (we redraw as they land) and Esc/Ctrl+C cancels a
        // slow generation instead of freezing the TUI until it finishes.
        let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<String>();
        let task = tokio::spawn(async move {
            let res = provider.stream(req, &mut |chunk: String| {
                let _ = tx.send(chunk);
            })
            .await;
            res
        });

        let mut cancelled = false;
        let result;
        loop {
            tokio::select! {
                chunk = rx.recv() => {
                    match chunk {
                        Some(c) => {
                            if let Some(m) = state.messages.get_mut(msg_idx) {
                                m.content.push_str(&c);
                            }
                            let _ = terminal.draw(|f| render(f, state));
                        }
                        None => {
                            // Channel closed: the task finished; collect result.
                            result = match task.await {
                                Ok(r) => r,
                                Err(e) => Err(crate::errors::MorseError::new(
                                    "TUI-TASK", &e.to_string(), crate::errors::ErrorCategory::Internal,
                                )),
                            };
                            break;
                        }
                    }
                }
                _ = tokio::time::sleep(std::time::Duration::from_millis(80)) => {
                    if cancel_pressed() {
                        task.abort();
                        cancelled = true;
                        result = Err(crate::errors::MorseError::new(
                            "TUI-CANCEL", "generation cancelled", crate::errors::ErrorCategory::Internal,
                        ));
                        break;
                    }
                }
            }
        }

        if cancelled {
            // Keep whatever streamed so far, marked as partial.
            if let Some(m) = state.messages.get_mut(msg_idx) {
                if !m.content.is_empty() {
                    m.content.push_str("\n[cancelled]");
                } else {
                    m.content.push_str("[cancelled]");
                }
            }
            state.pending = false;
            state.pending_label.clear();
            state.follow = true;
            terminal.draw(|f| render(f, state))?;
            return Ok(());
        }

        match result {
            Ok(resp) => {
                outcome = Some(resp);
                used_spec = Some(spec.clone());
                break;
            }
            Err(e) => {
                // Discard any partial junk from the failed attempt so the next
                // provider starts from a clean message slot.
                if let Some(m) = state.messages.get_mut(msg_idx) {
                    m.content.clear();
                }
                let detail: String = e.display().split_whitespace().collect::<Vec<_>>().join(" ");
                let detail: String = detail.chars().take(110).collect();
                state.push(Role::System, format!("{} unavailable — {}", spec, detail));
                terminal.draw(|f| render(f, state))?;
                last_err = Some(e.display());
            }
        }
    }

    state.pending = false;
    state.pending_label.clear();
    let slot = state
        .messages
        .get_mut(msg_idx)
        .expect("assistant slot must exist");
    match (outcome, used_spec) {
        (Some(resp), Some(spec)) => {
            crate::cost::record_call(&resp.provider, &resp.model, resp.input_tokens as i64, resp.output_tokens as i64);
            // Store in the completion cache for instant, free re-runs.
            let cache = crate::ccache::CompletionCache::new(cfg);
            if cache.is_enabled() {
                let sys = system_prompt();
                let msgs = serde_json::to_string(&history).unwrap_or_default();
                let key = crate::ccache::cache_key(&cfg.routing.default, &sys, &msgs, 0.7, 8192);
                let payload = serde_json::json!({
                    "content": resp.content,
                    "provider": resp.provider,
                    "model": resp.model,
                });
                let _ = cache.put(&key, &resp.provider, &resp.model, &payload);
            }
            let reply_len = resp.content.len();
            if slot.content.is_empty() {
                slot.content = resp.content;
            }
            let secs = started.elapsed().as_secs_f64();
            let toks = resp.input_tokens + resp.output_tokens;
            slot.meta = Some(format!(
                "{:.1}s · {} tok · {}/{}",
                secs,
                if toks > 0 { toks.to_string() } else { format!("~{}", reply_len / 4) },
                resp.provider,
                resp.model
            ));
            state.model_label = format!("{}/{}", resp.provider, resp.model);
            state.working_spec = Some(spec.clone());
            crate::providers::save_working_spec(&spec);
        }
        _ => {
            slot.content = format!(
                "All providers failed. Last error: {}",
                last_err.unwrap_or_else(|| "no provider configured".into())
            );
            slot.role = Role::Error;
        }
    }
    // Pin to the newest message after a response arrives.
    state.follow = true;

    // Auto-compact: when the transcript approaches the context budget, trim
    // older turns instead of letting requests start failing.
    let total_chars: usize = state.messages.iter().map(|m| m.content.len()).sum();
    const AUTO_COMPACT_THRESHOLD: usize = (128_000 * 4) * 85 / 100; // 85% of 128k tokens
    if total_chars > AUTO_COMPACT_THRESHOLD {
        let as_tuples: Vec<(String, String)> = state
            .messages
            .iter()
            .filter(|m| m.role != Role::System)
            .map(|m| (m.role.as_str().to_string(), m.content.clone()))
            .collect();
        let trimmed = crate::context::trim_history(&as_tuples, 8_000);
        if trimmed.len() < as_tuples.len() {
            let mut rebuilt: Vec<ChatMessage> = Vec::new();
            for (role, content) in trimmed {
                let r = match role.as_str() {
                    "user" => Role::User,
                    "assistant" => Role::Assistant,
                    "error" => Role::Error,
                    _ => Role::System,
                };
                rebuilt.push(ChatMessage { role: r, content, meta: None });
            }
            let before = as_tuples.len();
            let after = trimmed.len();
            state.messages = rebuilt;
            state.push(
                Role::System,
                format!("Auto-compacted: {} → {} messages (context was near budget).", before, after),
            );
        }
    }
    terminal.draw(|f| render(f, state))?;
    Ok(())
}

fn history_messages(state: &ChatState, latest: &str) -> Vec<Message> {
    let mut out = Vec::new();
    for m in &state.messages {
        // Skip the just-pushed empty assistant placeholder and the duplicate
        // user prompt we add manually below.
        match m.role {
            Role::User if m.content == latest => continue,
            Role::Assistant if m.content.is_empty() => continue,
            Role::User => out.push(Message::user(&m.content)),
            Role::Assistant => out.push(Message::assistant(&m.content)),
            Role::System | Role::Error => continue,
        }
    }
    out.push(Message::user(latest));
    out
}
