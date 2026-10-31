//! Health checks and `morse doctor`: verify the installation actually works.
//!
//! Every check inspects real state (config validity, provider credentials,
//! required tools, git, disk write, DuckDB) rather than reporting hardcoded
//! success.

use crate::config::{self, Config};
use crate::db;
use crate::providers;
use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::time::SystemTime;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum Status {
    Healthy,
    Warning,
    Failing,
}

impl Status {
    fn icon(&self) -> &'static str {
        match self {
            Status::Healthy => "✓",
            Status::Warning => "⚠",
            Status::Failing => "✖",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthCheckResult {
    pub name: String,
    pub status: Status,
    pub message: String,
    pub hint: Option<String>,
    pub checked_at: SystemTime,
}

impl HealthCheckResult {
    fn ok(name: &str, message: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            status: Status::Healthy,
            message: message.into(),
            hint: None,
            checked_at: SystemTime::now(),
        }
    }
    fn warn(name: &str, message: impl Into<String>, hint: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            status: Status::Warning,
            message: message.into(),
            hint: Some(hint.into()),
            checked_at: SystemTime::now(),
        }
    }
    fn fail(name: &str, message: impl Into<String>, hint: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            status: Status::Failing,
            message: message.into(),
            hint: Some(hint.into()),
            checked_at: SystemTime::now(),
        }
    }
}

/// Run all checks against the given config.
pub fn run_checks(cfg: &Config) -> Vec<HealthCheckResult> {
    vec![
        check_config(cfg),
        check_providers(cfg),
        check_tools(),
        check_git(),
        check_disk(),
        check_duckdb(),
        check_indices(),
    ]
}

fn check_config(cfg: &Config) -> HealthCheckResult {
    // Re-run validation to surface concrete problems.
    match cfg.validate() {
        Ok(_) => HealthCheckResult::ok(
            "config",
            format!("valid (v{}), default model {}", cfg.version, cfg.routing.default),
        ),
        Err(e) => {
            if matches!(e.category, crate::errors::ErrorCategory::Auth) {
                HealthCheckResult::warn("config", e.message, "set a provider key to enable AI")
            } else {
                HealthCheckResult::fail("config", e.message, "fix ~/.morse/config.yaml")
            }
        }
    }
}

fn check_providers(cfg: &Config) -> HealthCheckResult {
    let configured: Vec<&str> = [
        "groq", "openai", "anthropic", "gemini", "deepseek", "mistral", "xai",
        "together", "openrouter", "fireworks", "cerebras", "sambanova", "deepinfra",
        "nebius", "novita", "hyperbolic", "lepton",
    ]
    .iter()
    .filter(|p| cfg.get_provider_key(p).is_some())
    .copied()
    .collect();

    if configured.is_empty() {
        // Ollama may still be usable without a key.
        if cfg.get_provider_key("ollama").is_some() {
            return HealthCheckResult::ok("providers", "ollama configured (local, keyless)");
        }
        return HealthCheckResult::warn(
            "providers",
            "no API keys configured",
            "export GROQ_API_KEY=… (free) or another provider key",
        );
    }
    HealthCheckResult::ok(
        "providers",
        format!("{} configured: {}", configured.len(), configured.join(", ")),
    )
}

fn check_tools() -> HealthCheckResult {
    const REQUIRED: &[&str] = &["git"];
    const OPTIONAL: &[&str] = &["rg", "fd", "dot", "docker"];
    let mut missing_required = Vec::new();
    let mut present_optional = Vec::new();

    for t in REQUIRED {
        if which(t) {
            // ok
        } else {
            missing_required.push(*t);
        }
    }
    for t in OPTIONAL {
        if which(t) {
            present_optional.push(*t);
        }
    }

    if !missing_required.is_empty() {
        return HealthCheckResult::fail(
            "tools",
            format!("missing required: {}", missing_required.join(", ")),
            "install missing tools",
        );
    }
    let opt = if present_optional.is_empty() {
        "none of the optional tools (rg/fd/dot/docker) found".to_string()
    } else {
        format!("optional present: {}", present_optional.join(", "))
    };
    HealthCheckResult::ok("tools", format!("git found; {}", opt))
}

fn which(cmd: &str) -> bool {
    std::process::Command::new("which")
        .arg(cmd)
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

fn check_git() -> HealthCheckResult {
    match std::process::Command::new("git").arg("rev-parse").arg("--is-inside-work-tree").output() {
        Ok(o) if o.status.success() => {
            let root = std::process::Command::new("git")
                .args(["rev-parse", "--show-toplevel"])
                .output()
                .ok()
                .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
                .filter(|s| !s.is_empty())
                .unwrap_or_else(|| ".".into());
            HealthCheckResult::ok("git", format!("inside repo at {}", root))
        }
        _ => HealthCheckResult::warn(
            "git",
            "not inside a git repository",
            "run 'git init' to enable commit/diff features",
        ),
    }
}

fn check_disk() -> HealthCheckResult {
    let root = match std::env::current_dir() {
        Ok(r) => r,
        Err(e) => return HealthCheckResult::fail("disk", format!("cannot read cwd: {}", e), ""),
    };
    let probe = root.join(".morse").join(".healthprobe");
    if let Some(p) = probe.parent() {
        let _ = std::fs::create_dir_all(p);
    }
    match std::fs::write(&probe, b"ok") {
        Ok(_) => {
            let _ = std::fs::remove_file(&probe);
            HealthCheckResult::ok("disk", format!("writable at {}", root.display()))
        }
        Err(e) => HealthCheckResult::fail(
            "disk",
            format!("cannot write to {}: {}", root.display(), e),
            "check filesystem permissions",
        ),
    }
}

fn check_duckdb() -> HealthCheckResult {
    match db::Store::open(".") {
        Ok(store) => {
            let ok = store.ping().is_ok();
            let _ = store.close();
            if ok {
                HealthCheckResult::ok(
                    "duckdb",
                    format!("open + ping ok ({}GB cap)", db::Store::storage_capacity_gb()),
                )
            } else {
                HealthCheckResult::warn("duckdb", "opened but ping failed", "try deleting .morse/tracker.duck.db")
            }
        }
        Err(e) => HealthCheckResult::fail(
            "duckdb",
            format!("open failed: {}", e),
            "delete .morse/tracker.duck.db to re-create",
        ),
    }
}

fn check_indices() -> HealthCheckResult {
    let root = std::env::current_dir().unwrap_or_default();
    let graph = root.join(".morse").join("graph.json");
    let rag = root.join(".morse").join("rag_index.json");
    let mut parts = Vec::new();
    parts.push(if graph.exists() { "graph ✓" } else { "graph –" }.to_string());
    parts.push(if rag.exists() { "rag ✓" } else { "rag –" }.to_string());
    let built = graph.exists() || rag.exists();
    if built {
        HealthCheckResult::ok("indices", parts.join(", "))
    } else {
        HealthCheckResult::warn(
            "indices",
            "no indexes built",
            "run 'morse graph-build' and 'morse rag-init'",
        )
    }
}

/// Pretty-print a health report. Returns exit code (0 = all healthy).
fn report(results: &[HealthCheckResult], title: &str) -> i32 {
    let ui = crate::ui::UI::new(true);
    ui.print(&ui.header(title));
    ui.print("");

    let mut worst = Status::Healthy;
    for r in results {
        let icon = match r.status {
            Status::Healthy => ui.success(""),
            Status::Warning => ui.warning(""),
            Status::Failing => ui.error(""),
        };
        let _ = icon;
        let mark = r.status.icon();
        let colored = match r.status {
            Status::Healthy => format!("  {} {:<10} {}", mark, r.name, r.message),
            Status::Warning => format!("  {} {:<10} {}", mark, r.name, r.message),
            Status::Failing => format!("  {} {:<10} {}", mark, r.name, r.message),
        };
        ui.print(&colored);
        if let Some(hint) = &r.hint {
            ui.print(&ui.muted(&format!("        hint: {}", hint)));
        }
        match r.status {
            Status::Healthy => {}
            Status::Warning => {
                if worst == Status::Healthy {
                    worst = Status::Warning;
                }
            }
            Status::Failing => worst = Status::Failing,
        }
    }

    ui.print("");
    let summary = match worst {
        Status::Healthy => ui.success("All checks passed."),
        Status::Warning => ui.warning("Some checks need attention (see hints above)."),
        Status::Failing => ui.error("One or more checks FAILED."),
    };
    ui.print(&summary);
    match worst {
        Status::Healthy => 0,
        Status::Warning => 0,
        Status::Failing => 1,
    }
}

pub fn run(cfg: &Config) -> Result<()> {
    let results = run_checks(cfg);
    let code = report(&results, " Health ");
    if code != 0 {
        std::process::exit(code);
    }
    Ok(())
}

/// `morse doctor`: verbose diagnostics with provider reachability.
pub fn doctor(cfg: &Config) -> Result<()> {
    let mut results = run_checks(cfg);
    results.insert(1, check_provider_reachable(cfg));
    let code = report(&results, " Doctor ");
    if code != 0 {
        std::process::exit(code);
    }
    Ok(())
}

/// Check that a provider credential exists (validates locally to keep doctor
/// fast and free — a live API call would cost money and add latency).
fn check_provider_reachable(cfg: &Config) -> HealthCheckResult {
    let (provider_name, _) = cfg.routing.default.split_once('/').unwrap_or(("groq", ""));
    if cfg.get_provider_key(provider_name).is_some() || provider_name == "ollama" {
        return HealthCheckResult::ok(
            "reachability",
            format!("credential present for '{}'", provider_name),
        );
    }
    // See if fallback would pick a different configured provider.
    let (fb, _) = providers::resolve_with_fallback(cfg, &cfg.routing.default.clone());
    let name = fb.name().to_string();
    if name == "mock" {
        HealthCheckResult::warn(
            "reachability",
            "no provider reachable with current keys",
            "set GROQ_API_KEY or OPENAI_API_KEY",
        )
    } else {
        HealthCheckResult::ok("reachability", format!("will fall back to '{}'", name))
    }
}

/// Convenience used by tests: parse a config path and run checks.
pub fn check_config_path(path: Option<&std::path::Path>) -> Result<Vec<HealthCheckResult>> {
    let cfg = config::load(path)?;
    Ok(run_checks(&cfg))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn checks_all_produce_results() {
        let cfg = Config::default();
        let results = run_checks(&cfg);
        // Every named check should be present.
        let names: Vec<&str> = results.iter().map(|r| r.name.as_str()).collect();
        for expected in ["config", "providers", "tools", "git", "disk", "duckdb", "indices"] {
            assert!(names.contains(&expected), "missing check: {}", expected);
        }
        assert!(!results.is_empty());
    }

    #[test]
    fn config_check_flags_missing_providers() {
        let cfg = Config { providers: Default::default(), ..Config::default() };
        let r = check_config(&cfg);
        // With no keys, validate() fails with Auth -> warning.
        assert_ne!(r.status, Status::Healthy);
    }

    #[test]
    fn disk_check_passes_in_writable_dir() {
        let r = check_disk();
        assert_eq!(r.status, Status::Healthy, "temp/cwd should be writable: {}", r.message);
    }

    #[test]
    fn git_check_returns_a_status() {
        let r = check_git();
        // Either healthy (in a repo) or warning (not) — both are valid.
        assert!(matches!(r.status, Status::Healthy | Status::Warning));
    }

    #[test]
    fn report_exit_code_reflects_worst() {
        let all_ok = vec![HealthCheckResult::ok("a", "fine")];
        assert_eq!(report(&all_ok, "T"), 0);

        let failing = vec![HealthCheckResult::fail("a", "bad", "fix it")];
        assert_eq!(report(&failing, "T"), 1);
    }
}
