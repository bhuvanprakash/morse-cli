//! Rollback: undo the last change using whatever safety net exists.
//!
//! Resolution order for "undo the last change":
//!   1. **Git** — soft-reset the last commit (keeps edits in the tree) so the
//!      AI's last commit is reverted but nothing is lost.
//!   2. **Checkpoints** — restore the most recent checkpoint.
//!   3. Neither → actionable message.
//!
//! `rollback <id>` restores a specific checkpoint; `list` shows the undo
//! history (recent commits and/or checkpoints).

use crate::config::Config;
use crate::ui::UI;
use anyhow::{bail, Result};

/// Roll back to a named checkpoint.
pub fn rollback_to_checkpoint(cfg: &Config, checkpoint_id: &str) -> Result<()> {
    let ui = UI::new(true);
    let mgr = crate::checkpoint::CheckpointManager::new(cfg.clone())?;
    let n = mgr.restore(checkpoint_id)?;
    ui.print(&ui.success(&format!("Restored {} file(s) from checkpoint {}", n, checkpoint_id)));
    Ok(())
}

/// Undo the most recent change: prefers git, falls back to the latest
/// checkpoint. Returns a human description of what happened.
pub fn rollback_last_change(cfg: &Config) -> Result<String> {
    let root = std::env::current_dir()?;

    if crate::vcs::is_repo(&root) {
        if crate::vcs::changed_file_count(&root).unwrap_or(0) == 0 {
            // Clean tree => the last action was a commit: undo it (keep edits).
            return match crate::vcs::undo_last(&root, true) {
                Ok(action) => Ok(format!("git: {}", action)),
                Err(e) => {
                    let m = e.to_string();
                    if m.contains("first commit") {
                        Ok("git: already at the earliest commit — nothing to undo".to_string())
                    } else {
                        Err(e)
                    }
                }
            };
        }
        // Uncommitted edits exist: discard them on tracked files (untracked kept).
        crate::vcs::discard_tracked_changes(&root)?;
        return Ok("git: discarded uncommitted changes to tracked files".to_string());
    }

    // No git — fall back to the most recent checkpoint.
    let mgr = crate::checkpoint::CheckpointManager::new(cfg.clone())?;
    if let Some(cp) = mgr.list().into_iter().next() {
        let n = mgr.restore(&cp.id)?;
        return Ok(format!("checkpoint: restored {} file(s) from {}", n, cp.id));
    }

    bail!("nothing to roll back - no git repository and no checkpoints. Run 'git init' or 'morse checkpoint create <desc>' first.")
}

/// Show undo history: recent commits (if git) and checkpoints.
pub fn list_changes(cfg: &Config) -> Result<()> {
    let root = std::env::current_dir()?;
    let ui = UI::new(true);

    ui.print(&ui.header(" Undo History "));
    ui.print("");

    if crate::vcs::is_repo(&root) {
        ui.print(&ui.section("Recent commits"));
        match crate::vcs::log(&root, 8) {
            Ok(out) => {
                for line in out.lines() {
                    println!("  {}", line);
                }
            }
            Err(e) => ui.print(&ui.warning(&format!("could not read git log: {}", e))),
        }
    } else {
        ui.print(&ui.muted("Not a git repository — commits not tracked here."));
    }

    let mgr = crate::checkpoint::CheckpointManager::new(cfg.clone())?;
    let cps = mgr.list();
    ui.print("");
    ui.print(&ui.section("Checkpoints"));
    if cps.is_empty() {
        ui.print(&ui.muted("No checkpoints. Create one with 'morse checkpoint create <desc>'."));
    } else {
        for cp in cps.iter().take(8) {
            println!("  {:<18} {} files", cp.id, cp.files.len());
        }
    }

    ui.print("");
    ui.print(&ui.muted("Undo last: morse rollback · Restore: morse rollback <id>"));
    Ok(())
}

pub fn run(cfg: &Config, target: Option<&str>) -> Result<()> {
    let ui = UI::new(true);
    match target {
        Some("list") | Some("history") => list_changes(cfg),
        Some(id) if !id.is_empty() => rollback_to_checkpoint(cfg, id),
        _ => {
            let desc = rollback_last_change(cfg)?;
            ui.print(&ui.info(&desc));
            Ok(())
        }
    }
}

pub fn rollback_last(cfg: &Config) -> Result<()> {
    rollback_last_change(cfg).map(|_| ())
}

pub fn rollback_to(cfg: &Config, checkpoint_id: &str) -> Result<()> {
    rollback_to_checkpoint(cfg, checkpoint_id)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rollback_without_git_or_checkpoints_errors() {
        // Run in an empty temp dir with no git and no checkpoints.
        let dir = std::env::temp_dir().join(format!("rb-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let original = std::env::current_dir().unwrap();
        std::env::set_current_dir(&dir).unwrap();

        let cfg = Config::default();
        let res = rollback_last_change(&cfg);
        assert!(res.is_err(), "should error with no git and no checkpoints");

        std::env::set_current_dir(original).unwrap();
        let _ = std::fs::remove_dir_all(&dir);
    }
}
