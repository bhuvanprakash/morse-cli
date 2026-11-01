//! Production-grade CLI entry point with beautiful UX

use morse_cli_rs::config;
use morse_cli_rs::errors::MorseError;
use morse_cli_rs::ui::UI;
use morse_cli_rs::{agent, cloud, cost, health, memory, mcp, modes, native_mac, observability, providers, ratelimit, rollback, secrets, session, skills, slash_commands, swarm, trust, vcs, verify, z3_verify};
use morse_cli_rs::{auto_approval, backup, checkpoint, daemon, graph, lsp, rag, serve, tui};
use anyhow::Result;
use clap::{CommandFactory, Parser, Subcommand};
use std::io;
use std::path::PathBuf;
use std::process::exit;

#[derive(Parser, Debug)]
#[command(
    name = "morse",
    about = "Morse CLI - Terminal-first AI Coding Assistant",
    long_about = "Morse CLI is a production-grade, terminal-first AI coding assistant with trust boundaries, multi-provider support, knowledge graphs, RAG, multi-agent swarms, and cloud execution.",
    version = "1.0.0",
    author = "Morse CLI Team <team@morse-cli.dev>"
)]
#[command(after_help = "Run 'morse <COMMAND> --help' for command-specific help.\nRun 'morse --list' to see all available commands.")]
struct Cli {
    #[command(subcommand)]
    command: Option<Commands>,

    #[arg(short, long, help = "Path to configuration file")]
    config: Option<PathBuf>,

    #[arg(short, long, help = "Enable verbose logging")]
    verbose: bool,

    #[arg(long, help = "Disable colored output")]
    no_color: bool,

    #[arg(long, help = "Output format: text, json, stream-json")]
    output: Option<String>,

    #[arg(long, help = "Override default model (e.g. groq/llama-3.1-8b-instant)")]
    model: Option<String>,

    #[arg(short = 'a', long, help = "Run in agentic mode: the assistant can use tools (read, edit, run) to complete your task")]
    agent: bool,

    #[arg(long, help = "Auto-approve tool actions (dangerous: skips confirmations)")]
    yolo: bool,

    #[arg(long, help = "Disable the completion cache (always hit the provider)")]
    no_cache: bool,

    #[arg(short = 'q', long, help = "Quiet: raw answer only, no decorations (for scripts/pipes)")]
    quiet: bool,

    #[arg(short = 'f', long, help = "Read the prompt from a file (one-shot automation)")]
    message_file: Option<PathBuf>,

    #[arg(last = true, help = "Prompt or question to ask")]
    prompt: Option<String>,
}

#[derive(Subcommand, Debug, Clone)]
// `MCP`/`LSP` are intentional acronyms and map to `mcp`/`lsp` commands.
#[allow(clippy::upper_case_acronyms)]
enum Commands {
    /// Initialize Morse in the current project (writes .morse/config.yaml)
    Init { path: Option<PathBuf> },
    /// Create trust-boundary config (authority.yaml)
    TrustInit,
    /// Show the current trust configuration
    TrustStatus,
    /// Check read/write trust for a specific path
    TrustCheck { path: PathBuf },
    /// Alias for trust-check
    Check { path: PathBuf },
    /// Build the code knowledge graph (.morse/graph.json)
    GraphBuild,
    /// Search the graph for symbols matching a query
    GraphQuery { q: String },
    /// Blast-radius analysis: what depends on a symbol
    GraphImpact { symbol: String },
    /// Emit Graphviz DOT for the code graph
    GraphVisualize,
    /// Build the semantic (RAG) index over the codebase
    RAGInit,
    /// Semantic search over indexed code
    RAGSearch { q: String },
    /// Run a task with a swarm of specialized agents in parallel
    Swarm { task: String },
    /// Execute code in the cloud sandbox
    CloudRun { code: String },
    /// Show cloud execution status
    CloudStatus,
    /// Show/configure cloud settings
    CloudConfig,
    /// Diagnose your setup (config, providers, tools, git, disk)
    Doctor,
    /// Run health checks and report status
    Health,
    /// Cost dashboard with usage vs. budgets
    Cost,
    /// Rate limits & budget enforcement status
    Limit,
    /// Snapshot / restore / verify project backups
    Backup {
        #[arg(num_args = 0.., trailing_var_arg = true, help = "create, list, restore <id>, verify, clean [days]")]
        action: Vec<String>,
    },
    /// Store secrets with ${VAR} env resolution
    Secrets {
        #[arg(num_args = 0.., trailing_var_arg = true, help = "list, get <key>, set <key> <value>, delete <key>, rotate, audit")]
        action: Vec<String>,
    },
    /// List execution modes (coder, architect, debugger, reviewer, explainer)
    Modes,
    /// Generate shell completion script
    Completion { shell: Option<String> },
    /// Generate documentation (markdown|man)
    Docs { format: Option<String> },
    /// Interactive getting-started tutorial
    Tutorial,
    /// Start the interactive TUI chat (or answer a message inline)
    Chat { message: Option<String> },
    /// Ask a one-shot question (streamed answer)
    Ask { question: String },
    /// Run an autonomous agent that uses tools to complete a task
    Agent { task: String },
    /// List providers and their default models
    Models {
        #[arg(long, help = "Re-fetch live model lists from providers (bypasses 6h cache)")]
        refresh: bool,
    },
    /// Open a file in your $EDITOR
    Edit { path: PathBuf },
    /// Diagnose and propose a fix for an error message
    Fix { error: String },
    /// AI code review of the current project
    Review,
    /// Generate a conventional commit message
    Commit,
    /// Explain a file, symbol, or concept
    Explain { target: String },
    /// Ralph: self-verifying plan→execute→verify loop
    Ralph { task: String },
    /// MCP (Model Context Protocol) server status
    /// MCP (Model Context Protocol) — list/call tools on configured servers
    MCP {
        #[arg(num_args = 0.., trailing_var_arg = true, help = "list (default) or call <server> <tool> [json-args]")]
        action: Vec<String>,
    },
    /// LSP integration status
    LSP,
    /// Auto-approval policy settings
    AutoApproval,
    /// List available skills
    Skills,
    /// Manage saved chat sessions
    Sessions {
        #[arg(num_args = 0.., trailing_var_arg = true, help = "list, save [name], resume [id], delete <id>")]
        action: Vec<String>,
    },
    /// Persistent project memory (add/get/search/list/delete)
    Memory {
        #[arg(num_args = 0.., trailing_var_arg = true, help = "show, add <key> <value>, get <key>, search <q>, delete <key>")]
        action: Vec<String>,
    },
    /// Start the background daemon
    Daemon,
    /// Stop the background daemon
    DaemonStop,
    /// Show daemon status
    DaemonStatus,
    /// Start a serve transport (stdio|tcp)
    Serve { transport: Option<String> },
    /// Checkpoint / restore the working tree
    Checkpoint {
        #[arg(num_args = 0.., trailing_var_arg = true, help = "list, create [desc], restore <id>, verify <id>, delete <id>")]
        action: Vec<String>,
    },
    /// Roll back a change
    Rollback { target: Option<String> },
    /// macOS native integration status
    NativeMac,
    /// Formal (Z3) property verification
    Z3Verify { property: Option<String> },
    /// Run a slash command
    Slash { command: Option<String> },
    /// Show the working-tree diff
    Diff,
    /// Undo the last AI commit (keeps changes)
    Undo,
    /// Show git status
    GitStatus,
    /// Show recent commit history
    GitLog {
        #[arg(short, long, default_value_t = 10, help = "Number of commits to show")]
        n: usize,
    },
    /// Run the project's build/test checks (cargo/go/npm/pytest)
    Verify {
        #[arg(default_value = "all", help = "Which check to run: build, test, all")]
        which: Option<String>,
    },
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();

    let color_enabled = !cli.no_color && console::colors_enabled();
    let ui = UI::new(color_enabled);
    if !color_enabled {
        // Ensure console/indicatif respect the choice too.
        console::set_colors_enabled(false);
    }

    if cli.no_cache {
        morse_cli_rs::ccache::set_session_override(true);
    }

    // Initialize observability
    observability::init_observability(cli.verbose)
        .map_err(|e| anyhow::anyhow!(e.display()))?;

    let _span = observability::tracer().span("cli.main");
    observability::metrics().increment("cli.invocations");

    let mut cfg = match config::load(cli.config.as_deref()) {
        Ok(c) => c,
        Err(e) => {
            ui.print_error(&MorseError::from_anyhow(e));
            exit(1);
        }
    };

    if let Some(model_override) = &cli.model {
        cfg.routing.default = model_override.clone();
    }

    // Scriptability: merge piped stdin into the prompt (cat err.log | morse "explain")
    // and support --message-file for one-shot automation.
    let file_prompt = match &cli.message_file {
        Some(f) => Some(std::fs::read_to_string(f).map_err(|e| {
            anyhow::anyhow!("cannot read --message-file {}: {}", f.display(), e)
        })?),
        None => None,
    };
    let piped = if !console::user_attended() {
        use std::io::Read;
        let mut buf = String::new();
        match std::io::stdin().read_to_string(&mut buf) {
            Ok(0) => None,
            Ok(_) if buf.trim().is_empty() => None,
            Ok(_) => Some(buf),
            Err(_) => None,
        }
    } else {
        None
    };

    // Effective prompt = message-file + piped stdin + CLI prompt, joined.
    let mut parts: Vec<String> = Vec::new();
    if let Some(fp) = &file_prompt {
        if !fp.trim().is_empty() {
            parts.push(fp.trim().to_string());
        }
    }
    if let Some(pipe) = &piped {
        parts.push(format!("\n\n--- piped input ---\n{}", pipe.trim_end()));
    }
    if let Some(p) = cli.prompt.as_deref() {
        if !p.trim().is_empty() {
            parts.push(p.trim().to_string());
        }
    }
    let effective_prompt = if parts.is_empty() { None } else { Some(parts.join("\n\n")) };

    let result = match cli.command {
        Some(cmd) => execute_command(&ui, &cfg, cmd, effective_prompt.as_deref(), cli.yolo).await,
        None => {
            if let Some(prompt) = &effective_prompt {
                if cli.agent {
                    agent::run(&ui, &cfg, prompt, cli.yolo).await
                } else if cli.quiet {
                    providers::complete_raw(&cfg, prompt).await
                } else {
                    providers::complete_text_streaming(&cfg, prompt).await
                }
            } else if console::user_attended() {
                // Interactive terminal: launch the TUI.
                tui::async_chat(&cfg, None).await
            } else if cli.quiet {
                // Quiet mode with nothing to do: fail with a clear script error.
                ui.print(&ui.error("no prompt given (usage: morse -q \"question\" or echo data | morse -q \"explain\")"));
                Err(anyhow::anyhow!("empty input"))
            } else {
                // Piped/non-interactive: show the status dashboard + guidance.
                print_welcome(&ui, &cfg);
                Ok(())
            }
        }
    };

    // Render failures as a clean, actionable error instead of a raw dump.
    if let Err(e) = result {
        observability::metrics().increment("cli.error");
        let msg = format!("{}", e);
        // Surface the deepest root cause hint when available.
        let hint = e
            .chain()
            .skip(1)
            .map(|c| format!("caused by: {}", c))
            .last();
        ui.print(&ui.error(&truncate_str(&msg, 400)));
        if let Some(h) = hint {
            ui.print(&ui.muted(&truncate_str(&h, 400)));
        }
        exit(1);
    }

    observability::metrics().increment("cli.success");
    Ok(())
}

fn truncate_str(s: &str, max: usize) -> String {
    if s.chars().count() <= max {
        s.to_string()
    } else {
        let cut: String = s.chars().take(max).collect();
        format!("{}…", cut.trim_end())
    }
}

fn print_welcome(ui: &UI, cfg: &config::Config) {
    ui.print(&ui.morse_ascii_art());

    // Status strip: provider readiness at a glance.
    let provider = if cfg.has_any_provider() {
        ui.success("AI ready")
    } else {
        ui.warning("no API key")
    };
    ui.print("");
    ui.print(&format!(
        "  {}  {}  {}  {}",
        ui.muted("v1.0.0"),
        provider,
        ui.muted(&format!("model {}", cfg.routing.default)),
        ui.muted(&format!("trust {}", cfg.trust.default_level)),
    ));
    ui.print("");
    ui.print(&ui.divider(58));

    // Grouped quick-start, more scannable than a flat list.
    ui.print(&ui.section("Chat & ask"));
    ui.print(&format!(
        "    {}\n    {}\n    {}",
        ui.keyhint("morse", "interactive chat (TUI)"),
        ui.keyhint("morse \"q\"", "one-shot streaming answer"),
        ui.keyhint("morse ask \"how do I…\"", "quick question"),
    ));
    ui.print(&ui.section("Let the agent work"));
    ui.print(&format!(
        "    {}\n    {}",
        ui.keyhint("morse -a -- \"task\"", "agentic mode with tools"),
        ui.keyhint("morse swarm \"feature\"", "multi-agent parallel run"),
    ));
    ui.print(&ui.section("Stay in control"));
    ui.print(&format!(
        "    {}\n    {}\n    {}\n    {}",
        ui.keyhint("morse diff", "review AI changes"),
        ui.keyhint("morse undo", "revert the last AI commit"),
        ui.keyhint("morse limit", "budget & rate-limit status"),
        ui.keyhint("morse mcp", "external tool servers (MCP)"),
    ));
    ui.print(&ui.section("Understand the codebase"));
    ui.print(&format!(
        "    {}\n    {}\n    {}",
        ui.keyhint("morse graph-query \"sym\"", "symbol lookup"),
        ui.keyhint("morse rag-search \"idea\"", "semantic code search"),
        ui.keyhint("morse doctor", "check your setup"),
    ));
    ui.print("");
    ui.print(&ui.divider(58));
    if cfg.has_any_provider() {
        ui.print(&ui.muted(
            "Tip: run 'morse' with no args to open the chat, or 'morse --help' for all commands.",
        ));
    } else {
        ui.print(&ui.warning("No provider configured — set a key to enable AI:"));
        ui.print(&ui.bullet("export GROQ_API_KEY=…   (free at console.groq.com)", 0));
    }
}

async fn execute_command(
    ui: &UI,
    cfg: &config::Config,
    command: Commands,
    prompt: Option<&str>,
    yolo: bool,
) -> Result<()> {
    match command {
        Commands::Init { path } => {
            if console::user_attended() {
                config::init_interactive(ui, path.as_deref())?;
            } else {
                config::init(path.as_deref())?;
                ui.print(&ui.success("Project initialized (run 'morse init' in a terminal for setup wizard)"));
            }
        }
        Commands::TrustInit => {
            trust::init(ui, cfg)?;
            ui.print(&ui.success("Trust configuration initialized"));
        }
        Commands::TrustStatus => {
            trust::status(ui, cfg)?;
        }
        Commands::TrustCheck { path } => {
            trust::check(ui, cfg, &path)?;
        }
        Commands::Check { path } => {
            trust::check(ui, cfg, &path)?;
        }
        Commands::GraphBuild => {
            let _spinner = ui.spinner("Building code graph...");
            graph::build(cfg)?;
            ui.print(&ui.success("Code graph built"));
        }
        Commands::GraphQuery { q } => {
            graph::query(cfg, &q)?;
        }
        Commands::GraphImpact { symbol } => {
            graph::impact(cfg, &symbol)?;
        }
        Commands::GraphVisualize => {
            graph::visualize(cfg)?;
        }
        Commands::RAGInit => {
            let _spinner = ui.spinner("Initializing RAG index...");
            rag::init(cfg)?;
            ui.print(&ui.success("RAG index initialized"));
        }
        Commands::RAGSearch { q } => {
            rag::search(cfg, &q)?;
        }
        Commands::Swarm { task } => {
            let _spinner = ui.spinner(&format!("Running swarm: {}", task));
            swarm::run(cfg, &task).await?;
            ui.print(&ui.success("Swarm execution complete"));
        }
        Commands::CloudRun { code } => {
            let _spinner = ui.spinner("Executing in cloud...");
            cloud::run(cfg, &code)?;
        }
        Commands::CloudStatus => {
            cloud::status(cfg)?;
        }
        Commands::CloudConfig => {
            cloud::config(cfg)?;
        }
        Commands::Doctor => {
            health::doctor(cfg)?;
        }
        Commands::Health => {
            health::run(cfg)?;
        }
        Commands::Cost => {
            cost::run(cfg)?;
        }
        Commands::Limit => {
            ratelimit::run(cfg)?;
        }
        Commands::Backup { action } => {
            let joined = join_args(&action);
            backup::run(cfg, joined.as_deref())?;
        }
        Commands::Secrets { action } => {
            let joined = join_args(&action);
            secrets::run(cfg, joined.as_deref())?;
        }
        Commands::Modes => {
            modes::run(cfg)?;
        }
        Commands::Completion { shell } => {
            cli_completion(shell.as_deref(), ui)?;
        }
        Commands::Docs { format } => {
            docs_generate(format.as_deref())?;
        }
        Commands::Tutorial => {
            tui::tutorial()?;
        }
        Commands::Chat { message } => {
            let msg = message.as_deref().or(prompt);
            if let Some(prompt_text) = msg {
                providers::complete_text_streaming(cfg, prompt_text).await?;
            } else {
                tui::async_chat(cfg, None).await?;
            }
        }
        Commands::Ask { question } => {
            providers::complete_text_streaming(cfg, &question).await?;
        }
        Commands::Agent { task } => {
            agent::run(ui, cfg, &task, yolo).await?;
        }
        Commands::Models { refresh } => {
            providers::print_models(ui, cfg);
            if refresh {
                println!("\nRefreshing live model lists…");
                for provider in ["groq", "openai", "anthropic", "deepseek", "mistral"] {
                    let key = cfg.get_provider_key(provider).map(|s| s.to_string());
                    let Some(key) = key else { continue };
                    let models = providers::cached_models(provider, Some(&key), true).await;
                    println!("  {}: {} models", provider, models.len());
                }
                println!("Done — lists cached for 6h.");
            }
        }
        Commands::Edit { path } => {
            open_in_editor(&path)?;
            ui.print(&ui.success(&format!("Opened {} in editor", path.display())));
        }
        Commands::Fix { error } => {
            let _spinner = ui.spinner("Analyzing error...");
            providers::fix_error(cfg, &error).await?;
            ui.print(&ui.success("Error analysis complete"));
        }        Commands::Review => {
            let _spinner = ui.spinner("Reviewing code...");
            providers::review_code(cfg).await?;
            ui.print(&ui.success("Code review complete"));
        }
        Commands::Commit => {
            let _spinner = ui.spinner("Generating commit message...");
            providers::generate_commit(cfg).await?;
            ui.print(&ui.success("Commit message generated"));
        }
        Commands::Explain { target } => {
            providers::explain(cfg, &target).await?;
        }
        Commands::Ralph { task } => {
            let _spinner = ui.spinner(&format!("Ralph: {}", task));
            swarm::ralph(cfg, &task).await?;
            ui.print(&ui.success("Ralph verification complete"));
        }
        Commands::MCP { action } => {
            let joined = join_args(&action);
            mcp::run(cfg, joined.as_deref())?;
        }
        Commands::LSP => {
            lsp::run(cfg)?;
        }
        Commands::AutoApproval => {
            auto_approval::run(cfg)?;
        }
        Commands::Skills => {
            skills::run(cfg)?;
        }
        Commands::Sessions { action } => {
            let joined = join_args(&action);
            session::run(cfg, joined.as_deref())?;
        }
        Commands::Memory { action } => {
            let joined = join_args(&action);
            memory::run(cfg, joined.as_deref())?;
        }
        Commands::Daemon => {
            daemon::run(cfg)?;
            ui.print(&ui.success("Daemon started"));
        }
        Commands::DaemonStop => {
            daemon::stop_daemon(cfg)?;
            ui.print(&ui.success("Daemon stopped"));
        }
        Commands::DaemonStatus => {
            daemon::daemon_status(cfg)?;
        }
        Commands::Serve { transport } => {
            serve::run(cfg, transport.as_deref())?;
        }
        Commands::Checkpoint { action } => {
            let joined = join_args(&action);
            checkpoint::run(cfg, joined.as_deref())?;
        }
        Commands::Rollback { target } => {
            rollback::run(cfg, target.as_deref())?;
        }
        Commands::NativeMac => {
            native_mac::run(cfg)?;
        }
        Commands::Z3Verify { property } => {
            z3_verify::run(cfg, property.as_deref())?;
        }
        Commands::Slash { command } => {
            slash_commands::run(cfg, command.as_deref())?;
        }
        Commands::Diff => {
            vcs::run_diff(cfg)?;
        }
        Commands::Undo => {
            vcs::run_undo(cfg, true)?;
        }
        Commands::GitStatus => {
            vcs::run_status(cfg)?;
        }
        Commands::GitLog { n } => {
            vcs::run_log(cfg, n)?;
        }
        Commands::Verify { which } => {
            verify::run(cfg, which.as_deref())?;
        }
    }

    Ok(())
}

/// Join trailing var-args into a single command string (empty -> None).
fn join_args(args: &[String]) -> Option<String> {
    if args.is_empty() {
        None
    } else {
        Some(args.join(" "))
    }
}

/// Open a file in the user's preferred editor ($EDITOR / $VISUAL), falling
/// back to common editors.
fn open_in_editor(path: &std::path::Path) -> Result<()> {
    let editor = std::env::var("VISUAL")
        .or_else(|_| std::env::var("EDITOR"))
        .unwrap_or_else(|_| {
            for candidate in ["nano", "vim", "vi", "code"] {
                if std::process::Command::new("which")
                    .arg(candidate)
                    .output()
                    .map(|o| o.status.success())
                    .unwrap_or(false)
                {
                    return candidate.to_string();
                }
            }
            "nano".to_string()
        });
    let status = std::process::Command::new(&editor).arg(path).status()?;
    if !status.success() {
        anyhow::bail!("editor '{}' exited with {}", editor, status);
    }
    Ok(())
}

fn cli_completion(shell: Option<&str>, ui: &UI) -> Result<()> {
    let shell = shell.unwrap_or("bash");
    let mut cmd = Cli::command();
    match shell {
        "bash" => clap_complete::generate(clap_complete::Shell::Bash, &mut cmd, "morse", &mut io::stdout()),
        "zsh" => clap_complete::generate(clap_complete::Shell::Zsh, &mut cmd, "morse", &mut io::stdout()),
        "fish" => clap_complete::generate(clap_complete::Shell::Fish, &mut cmd, "morse", &mut io::stdout()),
        "powershell" => clap_complete::generate(clap_complete::Shell::PowerShell, &mut cmd, "morse", &mut io::stdout()),
        _ => {
            ui.print(&ui.error(&format!("Unsupported shell: {}", shell)));
            std::process::exit(1);
        }
    }
    Ok(())
}

fn docs_generate(format: Option<&str>) -> Result<()> {
    let fmt = format.unwrap_or("markdown");
    match fmt {
        "markdown" => {
            println!("# Morse CLI Documentation\n\nSee README.md");
        }
        "man" => {
            println!(".SH NAME\nmorse \\- AI coding assistant");
        }
        _ => {
            println!("Unsupported format: {}", fmt);
        }
    }
    Ok(())
}
