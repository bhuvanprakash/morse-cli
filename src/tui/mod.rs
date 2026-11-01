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
