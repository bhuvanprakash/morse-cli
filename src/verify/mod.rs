//! Verification: detect the project's toolchain and run its build/test/lint
//! checks, so the agent can feed failures back to the model for
//! self-correction — the tight feedback loop that separates a demo agent
//! from one that actually lands working code.

use anyhow::Result;
use std::path::Path;
use std::process::Command;
use std::time::{Duration, Instant};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Toolchain {
    Rust,
    Go,
    Node,
    Python,
    Unknown,
}

impl Toolchain {
    pub fn as_str(&self) -> &'static str {
        match self {
            Toolchain::Rust => "cargo",
            Toolchain::Go => "go",
            Toolchain::Node => "node",
            Toolchain::Python => "python",
            Toolchain::Unknown => "none",
        }
    }
}

#[derive(Debug, Clone)]
pub struct Check {
    pub name: String,
    pub cmd: String,
    pub ok: bool,
    pub output: String,
    pub duration: Duration,
}

#[derive(Debug, Clone)]
pub struct Report {
    pub toolchain: Toolchain,
    pub checks: Vec<Check>,
}

impl Report {
    pub fn passed(&self) -> bool {
        self.checks.iter().all(|c| c.ok)
    }

    /// Concatenated failure output, bounded — this is what gets fed back to
    /// the model so it can fix the problem.
    pub fn failure_feedback(&self, max_chars: usize) -> String {
        let mut out = String::new();
        for c in self.checks.iter().filter(|c| !c.ok) {
            out.push_str(&format!("CHECK FAILED: {} ({})\n", c.name, c.cmd));
            let tail = tail(&c.output, max_chars);
            out.push_str(&tail);
            out.push('\n');
        }
        if out.is_empty() {
            out.push_str("All checks passed.\n");
        }
        out
    }
}

/// Detect the project toolchain by marker files.
pub fn detect(root: &Path) -> Toolchain {
    if root.join("Cargo.toml").exists() {
        Toolchain::Rust
    } else if root.join("go.mod").exists() {
        Toolchain::Go
    } else if root.join("package.json").exists() {
        Toolchain::Node
    } else if root.join("pyproject.toml").exists()
        || root.join("requirements.txt").exists()
        || root.join("setup.py").exists()
    {
        Toolchain::Python
    } else {
        Toolchain::Unknown
    }
}

/// Pick the checks that make sense for the toolchain, in order.
fn checks_for(toolchain: Toolchain) -> Vec<(&'static str, &'static str)> {
    match toolchain {
        Toolchain::Rust => vec![("build", "cargo build"), ("test", "cargo test")],
        Toolchain::Go => vec![("vet", "go vet ./..."), ("test", "go test ./...")],
        Toolchain::Node => vec![("build", "npm run build --if-present"), ("test", "npm test --silent")],
        Toolchain::Python => vec![("test", "python -m pytest -q")],
        Toolchain::Unknown => vec![],
    }
}

/// Run all applicable checks. Empty `checks` for Unknown toolchain returns a
/// report with no checks (passes trivially).
pub fn run_checks(root: &Path, only: Option<&str>) -> Result<Report> {
    let toolchain = detect(root);
    let mut checks = Vec::new();
    for (name, cmd) in checks_for(toolchain) {
        if let Some(want) = only {
            if want != name && want != "all" {
                continue;
            }
        }
        checks.push(run_one(root, name, cmd));
    }
    Ok(Report { toolchain, checks })
}

/// Convenience: run just the build (fast signal) for the agent's tight loop.
pub fn run_build(root: &Path) -> Result<Report> {
    let toolchain = detect(root);
    let build_cmd = match toolchain {
        Toolchain::Rust => Some(("build", "cargo build")),
        Toolchain::Go => Some(("vet", "go vet ./...")),
        Toolchain::Node => Some(("build", "npm run build --if-present")),
        _ => None,
    };
    let checks = match build_cmd {
        Some((name, cmd)) => vec![run_one(root, name, cmd)],
        None => vec![],
    };
    Ok(Report { toolchain, checks })
}

fn run_one(root: &Path, name: &str, cmd: &str) -> Check {
    let started = Instant::now();
    // Run via `sh -c` so the full command line (with args) works uniformly.
    let output = Command::new("sh")
        .arg("-c")
        .arg(cmd)
        .current_dir(root)
        // Keep stdout+stderr merged and ordered.
        .output();
    let (ok, output) = match output {
        Ok(o) => {
            let mut text = String::from_utf8_lossy(&o.stdout).to_string();
            let err = String::from_utf8_lossy(&o.stderr).to_string();
            if !err.is_empty() {
                if !text.is_empty() {
                    text.push('\n');
                }
                text.push_str(&err);
            }
            (o.status.success(), text)
        }
        Err(e) => (false, format!("failed to run '{}': {}", cmd, e)),
    };
    Check {
        name: name.to_string(),
        cmd: cmd.to_string(),
        ok,
        output,
        duration: started.elapsed(),
    }
}

/// Truncate to the last `max` chars (errors are usually at the end) while
/// respecting char boundaries.
fn tail(s: &str, max: usize) -> String {
    if s.chars().count() <= max {
        return s.to_string();
    }
    let skip = s.chars().count() - max;
    let cut: String = s.chars().skip(skip).collect();
    format!("…{}", cut)
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

/// `morse verify [build|test|all]` — run the project's checks on demand.
pub fn run(cfg: &crate::config::Config, which: Option<&str>) -> Result<()> {
    let _ = cfg;
    let root = std::env::current_dir()?;
    let ui = crate::ui::UI::new(true);
    let which = which.unwrap_or("all");

    let toolchain = detect(&root);
    if toolchain == Toolchain::Unknown {
        ui.print(&ui.warning("No supported project manifest found (Cargo.toml, go.mod, package.json, pyproject.toml)."));
        return Ok(());
    }

    ui.print(&ui.section(&format!("Verify ({} detected)", toolchain.as_str())));
    let report = run_checks(&root, Some(which))?;
    if report.checks.is_empty() {
        ui.print(&ui.info(&format!("No '{}' check for {}.", which, toolchain.as_str())));
        return Ok(());
    }

    for c in &report.checks {
        let secs = format!("{:.1}", c.duration.as_secs_f64());
        if c.ok {
            ui.print(&ui.success(&format!("{} ({}s)", c.name, secs)));
        } else {
            ui.print(&ui.error(&format!("{} ({}s)", c.name, secs)));
            for line in tail(&c.output, 1500).lines().take(20) {
                println!("    {}", line);
            }
        }
    }

    if report.passed() {
        ui.print(&ui.success("All checks passed."));
    } else {
        ui.print("");
        ui.print(&ui.error("Some checks failed."));
        std::process::exit(1);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_toolchain_from_markers() {
        let dir = std::env::temp_dir().join(format!("det-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        assert_eq!(detect(&dir), Toolchain::Unknown);

        std::fs::write(dir.join("Cargo.toml"), "[package]").unwrap();
        assert_eq!(detect(&dir), Toolchain::Rust);
        std::fs::remove_file(dir.join("Cargo.toml")).unwrap();

        std::fs::write(dir.join("go.mod"), "module x").unwrap();
        assert_eq!(detect(&dir), Toolchain::Go);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn unknown_toolchain_has_no_checks() {
        let dir = std::env::temp_dir().join(format!("det-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let report = run_checks(&dir, Some("all")).unwrap();
        assert_eq!(report.toolchain, Toolchain::Unknown);
        assert!(report.checks.is_empty());
        assert!(report.passed(), "no checks = trivially passed");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn runs_real_passing_shell_check() {
        // Use a marker file to force a shell-based check we control: since
        // Unknown has no checks, verify run_one directly.
        let dir = std::env::temp_dir().join(format!("chk-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let ok = run_one(&dir, "true", "true");
        assert!(ok.ok, "true should pass: {}", ok.output);
        let bad = run_one(&dir, "false", "echo oops; exit 1");
        assert!(!bad.ok);
        assert!(bad.output.contains("oops"), "captured stdout: {}", bad.output);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn failure_feedback_includes_output() {
        let report = Report {
            toolchain: Toolchain::Rust,
            checks: vec![Check {
                name: "build".into(),
                cmd: "cargo build".into(),
                ok: false,
                output: "error[E0308]: mismatched types".into(),
                duration: Duration::from_millis(5),
            }],
        };
        assert!(!report.passed());
        let fb = report.failure_feedback(1000);
        assert!(fb.contains("CHECK FAILED"), "{}", fb);
        assert!(fb.contains("E0308"), "{}", fb);
    }

    #[test]
    fn passing_report_feedback_says_ok() {
        let report = Report {
            toolchain: Toolchain::Go,
            checks: vec![Check {
                name: "vet".into(),
                cmd: "go vet".into(),
                ok: true,
                output: String::new(),
                duration: Duration::from_millis(1),
            }],
        };
        assert!(report.passed());
        assert!(report.failure_feedback(100).contains("passed"));
    }

    #[test]
    fn tail_truncates_from_start() {
        assert_eq!(tail("short", 100), "short");
        let t = tail("aaaaaaaaaabbbbbbbbbb", 8);
        assert!(t.starts_with('…'));
        assert!(t.ends_with("bbbbbbbb"));
    }
}
