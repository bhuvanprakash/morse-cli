//! Git-native workflow: every AI change can become a clean commit, with
//! `diff`, `undo`, and `status` — the workflow that makes Aider the standard
//! for reviewable AI edits.
//!
//! We shell out to `git` (validated present by `morse doctor`) rather than
//! link a binding, which keeps the binary self-contained and behavior
//! identical to the user's own git.

use crate::config::Config;
use anyhow::{bail, Context, Result};
use std::path::{Path, PathBuf};
use std::process::Command;

/// Run a git command in `dir`, returning trimmed stdout on success.
fn git(dir: &Path, args: &[&str]) -> Result<String> {
    let out = Command::new("git")
        .args(args)
        .current_dir(dir)
        .output()
        .with_context(|| format!("failed to run git {}", args.join(" ")))?;
    if !out.status.success() {
        let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();
        let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
        let detail = if stderr.is_empty() { stdout } else { stderr };
        bail!("git {} failed: {}", args.join(" "), detail);
    }
    Ok(String::from_utf8_lossy(&out.stdout).to_string())
}

fn git_ok(dir: &Path, args: &[&str]) -> Result<String> {
    git(dir, args)
}

/// True when `dir` is inside a git work tree.
pub fn is_repo(dir: &Path) -> bool {
    Command::new("git")
        .args(["rev-parse", "--is-inside-work-tree"])
        .current_dir(dir)
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

pub fn repo_root(dir: &Path) -> Option<PathBuf> {
    git(dir, &["rev-parse", "--show-toplevel"])
        .ok()
        .map(|s| PathBuf::from(s.trim()))
}

/// Working-tree changes (staged + unstaged), as a unified diff.
pub fn diff(dir: &Path, staged: bool) -> Result<String> {
    let args: &[&str] = if staged { &["diff", "--cached"] } else { &["diff"] };
    let out = git_ok(dir, args)?;
    Ok(out)
}

/// One-line status of the working tree.
pub fn status_porcelain(dir: &Path) -> Result<String> {
    git_ok(dir, &["status", "--porcelain"])
}

/// Number of files with uncommitted changes.
pub fn changed_file_count(dir: &Path) -> Result<usize> {
    let out = status_porcelain(dir)?;
    Ok(out.lines().filter(|l| !l.trim().is_empty()).count())
}

/// Stage all changes and commit them with `message`. Returns the commit SHA.
/// When the tree is already clean, returns None (nothing to commit).
pub fn commit_all(dir: &Path, message: &str) -> Result<Option<String>> {
    if !is_repo(dir) {
        bail!("not a git repository");
    }
    if changed_file_count(dir)? == 0 {
        return Ok(None);
    }
    git_ok(dir, &["add", "-A"])?;
    git_ok(dir, &["commit", "-m", message])?;
    let sha = git_ok(dir, &["rev-parse", "--short", "HEAD"])?
        .trim()
        .to_string();
    Ok(Some(sha))
}

/// Undo the most recent commit while keeping (or discarding) its changes.
/// `keep_changes=true` does a soft reset (files stay edited) — this is the
/// "undo the AI's last commit but keep my work" case.
pub fn undo_last(dir: &Path, keep_changes: bool) -> Result<String> {
    if !is_repo(dir) {
        bail!("not a git repository");
    }
    // Ensure there is a commit to undo (refuse on orphan/empty history).
    git_ok(dir, &["rev-parse", "HEAD"])?;
    // Refuse to undo a merge commit (would corrupt the tree).
    let parents = git_ok(dir, &["rev-list", "--parents", "-n", "1", "HEAD"])?;
    let parent_count = parents.split_whitespace().count().saturating_sub(1);
    if parent_count > 1 {
        bail!("HEAD is a merge commit; refusing to auto-undo");
    }
    if parent_count == 0 {
        bail!(
            "HEAD is the first commit — there is nothing before it to undo. \\\n             Use 'git update-ref -d HEAD' to drop it entirely if you really mean to."
        );
    }
    let mode = if keep_changes { "--soft" } else { "--hard" };
    git_ok(dir, &["reset", mode, "HEAD~1"])?;
    let action = if keep_changes {
        "reverted commit (changes kept in working tree)"
    } else {
        "reverted commit and discarded its changes"
    };
    Ok(action.to_string())
}

/// Discard uncommitted changes to tracked files (`git checkout -- .`).
/// Untracked files are left alone.
pub fn discard_tracked_changes(dir: &Path) -> Result<()> {
    if !is_repo(dir) {
        bail!("not a git repository");
    }
    git_ok(dir, &["checkout", "--", "."])?;
    Ok(())
}

/// Recent commit history (short format) for `morse git-log`.
pub fn log(dir: &Path, n: usize) -> Result<String> {
    let fmt = "--pretty=format:%C(yellow)%h%C(reset) %C(cyan)%ad%C(reset) %s%C(green)%d%C(reset)";
    git_ok(dir, &["log", &format!("-{}", n), fmt, "--date=short"])
}

/// Generate a conventional commit message by asking the model, falling back
/// to a summary of changed files.
pub fn suggest_message(dir: &Config, files: &[String]) -> String {
    let _ = dir;
    if files.is_empty() {
        return "chore: update".to_string();
    }
    let roots: Vec<&str> = files
        .iter()
        .map(|f| f.split('/').next().unwrap_or(f))
        .collect();
    let mut uniq: Vec<&str> = roots.clone();
    uniq.sort_unstable();
    uniq.dedup();
    let scope = if uniq.len() == 1 { uniq[0] } else { "project" };
    format!("chore({}): update {} file(s)", scope, files.len())
}

// ---------------------------------------------------------------------------
// CLI entry points
// ---------------------------------------------------------------------------

pub fn run_diff(cfg: &Config) -> Result<()> {
    let _ = cfg;
    let root = std::env::current_dir()?;
    if !is_repo(&root) {
        bail!("not inside a git repository (run 'git init' first)");
    }
    let out = diff(&root, false)?;
    let ui = crate::ui::UI::new(true);
    if out.trim().is_empty() {
        ui.print(&ui.info("No uncommitted changes."));
    } else {
        ui.print(&ui.header(" Working Tree Diff "));
        print!("{}", colorize_diff(&out));
    }
    Ok(())
}

pub fn run_status(cfg: &Config) -> Result<()> {
    let _ = cfg;
    let root = std::env::current_dir()?;
    let ui = crate::ui::UI::new(true);
    if !is_repo(&root) {
        ui.print(&ui.warning("Not inside a git repository."));
        ui.print(&ui.bullet("Run 'git init' to enable auto-commit, diff, and undo.", 0));
        return Ok(());
    }
    let n = changed_file_count(&root)?;
    ui.print(&ui.header(" Git Status "));
    ui.print("");
    if n == 0 {
        ui.print(&ui.success("Working tree clean."));
    } else {
        ui.print(&ui.kv_pair("changed", &format!("{} file(s)", n)));
        let st = status_porcelain(&root)?;
        for line in st.lines().filter(|l| !l.trim().is_empty()) {
            ui.print(&ui.bullet(line, 1));
        }
    }
    ui.print("");
    ui.print(&ui.muted(
        "Undo last AI commit: morse undo · Diff: morse diff · Log: morse git-log",
    ));
    Ok(())
}

pub fn run_undo(cfg: &Config, keep: bool) -> Result<()> {
    let _ = cfg;
    let root = std::env::current_dir()?;
    let ui = crate::ui::UI::new(true);
    let action = undo_last(&root, keep)?;
    ui.print(&ui.success(&format!("Undid last commit — {}", action)));
    Ok(())
}

pub fn run_log(cfg: &Config, n: usize) -> Result<()> {
    let _ = cfg;
    let root = std::env::current_dir()?;
    if !is_repo(&root) {
        bail!("not inside a git repository");
    }
    let out = log(&root, n)?;
    let ui = crate::ui::UI::new(true);
    ui.print(&ui.header(" Recent Commits "));
    ui.print("");
    for line in out.lines() {
        println!("  {}", line);
    }
    Ok(())
}

/// Very small diff colorizer (added=green, removed=red, headers=cyan).
fn colorize_diff(diff: &str) -> String {
    use console::style;
    diff.lines()
        .map(|l| {
            if l.starts_with("+++") || l.starts_with("---") || l.starts_with("diff ") {
                style(l).cyan().to_string()
            } else if l.starts_with("@@") {
                style(l).magenta().to_string()
            } else if l.starts_with('+') {
                style(l).green().to_string()
            } else if l.starts_with('-') {
                style(l).red().to_string()
            } else {
                l.to_string()
            }
        })
        .collect::<Vec<_>>()
        .join("\n")
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Create a throwaway git repo for tests.
    fn temp_repo() -> PathBuf {
        let dir = std::env::temp_dir().join(format!("vcs-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        git(&dir, &["init", "-q"]).unwrap();
        git(&dir, &["config", "user.email", "t@t.io"]).unwrap();
        git(&dir, &["config", "user.name", "t"]).unwrap();
        dir
    }

    #[test]
    fn commit_and_status_roundtrip() {
        let dir = temp_repo();
        assert!(is_repo(&dir));
        std::fs::write(dir.join("a.txt"), "hello").unwrap();

        let n = changed_file_count(&dir).unwrap();
        assert_eq!(n, 1, "one changed file expected");

        let sha = commit_all(&dir, "feat: add a.txt").unwrap();
        assert!(sha.is_some(), "commit should return a sha");
        assert_eq!(changed_file_count(&dir).unwrap(), 0, "clean after commit");

        // Committing a clean tree returns None (nothing to commit).
        assert!(commit_all(&dir, "noop").unwrap().is_none());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn undo_keep_changes_reverts_commit() {
        let dir = temp_repo();
        std::fs::write(dir.join("a.txt"), "v1").unwrap();
        commit_all(&dir, "first").unwrap();

        std::fs::write(dir.join("a.txt"), "v2").unwrap();
        commit_all(&dir, "second").unwrap();
        assert_eq!(changed_file_count(&dir).unwrap(), 0);

        let action = undo_last(&dir, true).unwrap();
        assert!(action.contains("kept"), "{}", action);
        // Commit reverted but content preserved in working tree.
        assert!(changed_file_count(&dir).unwrap() >= 1);
        assert_eq!(std::fs::read_to_string(dir.join("a.txt")).unwrap(), "v2");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn undo_hard_discards_changes() {
        let dir = temp_repo();
        std::fs::write(dir.join("a.txt"), "v1").unwrap();
        commit_all(&dir, "first").unwrap();
        std::fs::write(dir.join("a.txt"), "v2").unwrap();
        commit_all(&dir, "second").unwrap();

        undo_last(&dir, false).unwrap();
        assert_eq!(std::fs::read_to_string(dir.join("a.txt")).unwrap(), "v1");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn diff_shows_changes() {
        let dir = temp_repo();
        std::fs::write(dir.join("a.txt"), "line1").unwrap();
        commit_all(&dir, "init").unwrap();
        std::fs::write(dir.join("a.txt"), "line2").unwrap();

        let d = diff(&dir, false).unwrap();
        assert!(d.contains("+line2"), "diff should show added line: {}", d);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn undo_first_commit_errors_clearly() {
        let dir = temp_repo();
        std::fs::write(dir.join("a.txt"), "v1").unwrap();
        commit_all(&dir, "first").unwrap();
        // Only one commit: HEAD~1 doesn't exist.
        let err = undo_last(&dir, true).unwrap_err();
        assert!(err.to_string().contains("first commit"), "{}", err);
        // History untouched.
        assert_eq!(log(&dir, 5).unwrap().lines().count(), 1);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn non_repo_is_not_repo() {
        let dir = std::env::temp_dir().join(format!("norepo-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        assert!(!is_repo(&dir));
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn suggest_message_builds_conventional() {
        let cfg = Config::default();
        let m = suggest_message(&cfg, &["src/main.rs".to_string(), "src/lib.rs".to_string()]);
        assert!(m.starts_with("chore("), "{}", m);
        assert!(m.contains("2 file"), "{}", m);
    }
}
// (appended via heredoc below)
