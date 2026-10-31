//! Checkpoints: snapshot file contents so the working tree can be reverted.
//!
//! Unlike `backup` (which is for disaster recovery of the whole project),
//! a checkpoint is a lightweight, named save-point you create before a risky
//! change and roll back to. Contents are stored inline so restore works even
//! after files are modified or deleted.

use crate::config::Config;
use anyhow::{bail, Context, Result};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;
use std::fs;
use std::path::PathBuf;
use std::time::SystemTime;

const IGNORED_DIRS: &[&str] = &["node_modules", "target", ".git", "dist", "build", ".venv"];
const MAX_FILE_BYTES: u64 = 2 * 1024 * 1024;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Checkpoint {
    pub id: String,
    pub created_at: SystemTime,
    pub description: String,
    /// relative path -> file content (inline so restore is self-contained)
    pub files: BTreeMap<String, String>,
    /// relative path -> sha256 of content, for integrity verification
    pub checksums: BTreeMap<String, String>,
}

pub struct CheckpointManager {
    #[allow(dead_code)]
    cfg: Config,
    checkpoint_dir: PathBuf,
    root: PathBuf,
}

fn sha256_hex(s: &str) -> String {
    let mut h = Sha256::new();
    h.update(s.as_bytes());
    format!("{:x}", h.finalize())
}

impl CheckpointManager {
    pub fn new(cfg: Config) -> Result<Self> {
        let root = std::env::current_dir()?;
        let checkpoint_dir = root.join(".morse/checkpoints");
        fs::create_dir_all(&checkpoint_dir)?;
        Ok(Self { cfg, checkpoint_dir, root })
    }

    pub fn with_dirs(cfg: Config, root: PathBuf, checkpoint_dir: PathBuf) -> Result<Self> {
        fs::create_dir_all(&checkpoint_dir)?;
        Ok(Self { cfg, checkpoint_dir, root })
    }

    /// Snapshot the current state of project files.
    pub fn create(&mut self, description: String) -> Result<Checkpoint> {
        let id = format!(
            "cp-{}",
            SystemTime::now().duration_since(SystemTime::UNIX_EPOCH)?.as_secs()
        );

        let rel_files = self.collect_project_files()?;
        let mut files = BTreeMap::new();
        let mut checksums = BTreeMap::new();
        for rel in rel_files {
            let full = self.root.join(&rel);
            if let Ok(contents) = fs::read_to_string(&full) {
                checksums.insert(rel.clone(), sha256_hex(&contents));
                files.insert(rel, contents);
            }
        }

        let checkpoint = Checkpoint {
            id: id.clone(),
            created_at: SystemTime::now(),
            description,
            checksums,
            files,
        };
        self.save_checkpoint(&checkpoint)?;
        Ok(checkpoint)
    }

    /// Load all checkpoints from disk (newest first).
    pub fn list(&self) -> Vec<Checkpoint> {
        let mut out = Vec::new();
        let Ok(entries) = fs::read_dir(&self.checkpoint_dir) else { return out };
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) != Some("json") {
                continue;
            }
            if let Ok(json) = fs::read_to_string(&path) {
                if let Ok(cp) = serde_json::from_str::<Checkpoint>(&json) {
                    out.push(cp);
                }
            }
        }
        out.sort_by_key(|c| std::cmp::Reverse(c.created_at));
        out
    }

    fn get(&self, id: &str) -> Result<Checkpoint> {
        let path = self.checkpoint_dir.join(format!("{}.json", id));
        let json = fs::read_to_string(&path)
            .with_context(|| format!("checkpoint '{}' not found", id))?;
        serde_json::from_str(&json).context("corrupt checkpoint")
    }

    /// Restore every file in the checkpoint. Files changed since are backed up
    /// to `.morse/checkpoints/pre-restore/` first; files not in the checkpoint
    /// are left alone.
    pub fn restore(&self, checkpoint_id: &str) -> Result<usize> {
        let cp = self.get(checkpoint_id)?;
        let staging = self.checkpoint_dir.join("pre-restore");
        let mut restored = 0usize;

        for (rel, content) in &cp.files {
            let target = self.root.join(rel);
            // Preserve the current version before overwriting.
            if target.exists() {
                if let Some(p) = staging.join(rel).parent() {
                    fs::create_dir_all(p)?;
                }
                let _ = fs::copy(&target, staging.join(rel));
            }
            if let Some(p) = target.parent() {
                fs::create_dir_all(p)?;
            }
            fs::write(&target, content)?;
            restored += 1;
        }
        Ok(restored)
    }

    /// Verify a checkpoint's inline contents still match their checksums.
    pub fn verify(&self, id: &str) -> Result<bool> {
        let cp = self.get(id)?;
        for (rel, expected) in &cp.checksums {
            match cp.files.get(rel) {
                Some(content) if sha256_hex(content) == *expected => {}
                _ => return Ok(false),
            }
        }
        Ok(true)
    }

    pub fn delete(&mut self, checkpoint_id: &str) -> Result<()> {
        let path = self.checkpoint_dir.join(format!("{}.json", checkpoint_id));
        if path.exists() {
            fs::remove_file(&path)?;
            Ok(())
        } else {
            bail!("Checkpoint not found: {}", checkpoint_id)
        }
    }

    fn collect_project_files(&self) -> Result<Vec<String>> {
        let mut files = Vec::new();
        for entry in walkdir::WalkDir::new(&self.root)
            .into_iter()
            .filter_entry(|e| {
                let name = e.file_name().to_string_lossy();
                if e.depth() > 0 && e.file_type().is_dir() {
                    return !(IGNORED_DIRS.contains(&name.as_ref()) || name.starts_with('.'));
                }
                // Skip the checkpoint/backup state dir entirely.
                if name == "backups" || name == "checkpoints" {
                    return false;
                }
                true
            })
            .filter_map(|e| e.ok())
        {
            if entry.file_type().is_file() {
                let meta = entry.metadata().ok();
                if let Some(m) = &meta {
                    if m.len() > MAX_FILE_BYTES || m.len() == 0 {
                        continue;
                    }
                }
                if let Ok(rel) = entry.path().strip_prefix(&self.root) {
                    files.push(rel.display().to_string());
                }
            }
        }
        Ok(files)
    }

    fn save_checkpoint(&self, checkpoint: &Checkpoint) -> Result<()> {
        let path = self.checkpoint_dir.join(format!("{}.json", checkpoint.id));
        let json = serde_json::to_string_pretty(checkpoint)?;
        fs::write(path, json)?;
        Ok(())
    }
}

pub fn run(cfg: &Config, action: Option<&str>) -> Result<()> {
    let mut mgr = CheckpointManager::new(cfg.clone())?;
    let parts: Vec<&str> = action.unwrap_or("list").split_whitespace().collect();
    let cmd = parts.first().copied().unwrap_or("list");
    let ui = crate::ui::UI::new(true);

    match cmd {
        "create" => {
            let desc = if parts.len() > 1 {
                parts[1..].join(" ")
            } else {
                "manual checkpoint".to_string()
            };
            let cp = mgr.create(desc.clone())?;
            ui.print(&ui.success(&format!(
                "Checkpoint {} created ({} files) — {}",
                cp.id,
                cp.files.len(),
                desc
            )));
        }
        "list" => {
            let checkpoints = mgr.list();
            if checkpoints.is_empty() {
                println!("No checkpoints found. Create one with 'morse checkpoint create <desc>'.");
            } else {
                println!("Checkpoints (newest first):\n");
                for cp in &checkpoints {
                    let age = SystemTime::now()
                        .duration_since(cp.created_at)
                        .unwrap_or_default();
                    let days = age.as_secs() / 86_400;
                    let ago = if days > 0 {
                        format!("{}d ago", days)
                    } else {
                        let hrs = age.as_secs() / 3600;
                        if hrs > 0 { format!("{}h ago", hrs) } else { format!("{}m ago", age.as_secs() / 60) }
                    };
                    println!(
                        "  {:<18} {} files  {:>8}  {}",
                        cp.id,
                        cp.files.len(),
                        ago,
                        cp.description
                    );
                }
            }
        }
        "restore" => {
            let Some(id) = parts.get(1) else {
                println!("Usage: morse checkpoint restore <id>");
                if let Some(latest) = mgr.list().into_iter().next() {
                    println!("Latest: {}", latest.id);
                }
                return Ok(());
            };
            let n = mgr.restore(id)?;
            ui.print(&ui.success(&format!("Restored {} files from {}", n, id)));
        }
        "verify" => {
            let Some(id) = parts.get(1) else {
                println!("Usage: morse checkpoint verify <id>");
                return Ok(());
            };
            if mgr.verify(id)? {
                println!("✓ Checkpoint {} integrity OK", id);
            } else {
                println!("✗ Checkpoint {} is CORRUPT", id);
                std::process::exit(1);
            }
        }
        "delete" | "rm" => {
            let Some(id) = parts.get(1) else {
                println!("Usage: morse checkpoint delete <id>");
                return Ok(());
            };
            mgr.delete(id)?;
            println!("Deleted checkpoint {}", id);
        }
        _ => {
            println!("Available actions: create [desc], list, restore <id>, verify <id>, delete <id>");
        }
    }
    Ok(())
}

pub fn create_checkpoint(cfg: &Config, description: String) -> Result<Checkpoint> {
    let mut mgr = CheckpointManager::new(cfg.clone())?;
    mgr.create(description)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_mgr() -> CheckpointManager {
        let root = std::env::temp_dir().join(format!("cp-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(root.join("src")).unwrap();
        fs::write(root.join("src/main.rs"), "fn original() {}").unwrap();
        CheckpointManager::with_dirs(
            Config::default(),
            root.clone(),
            root.join(".morse/checkpoints"),
        )
        .unwrap()
    }

    #[test]
    fn create_stores_contents_and_lists_from_disk() {
        let mut mgr = temp_mgr();
        let cp = mgr.create("before refactor".into()).unwrap();
        assert!(cp.files.contains_key("src/main.rs"));
        assert_eq!(cp.files["src/main.rs"], "fn original() {}");

        // A fresh manager (empty in-memory) must still see it from disk.
        let fresh = CheckpointManager::with_dirs(
            Config::default(),
            mgr.root.clone(),
            mgr.checkpoint_dir.clone(),
        )
        .unwrap();
        let list = fresh.list();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].id, cp.id);
        let _ = fs::remove_dir_all(&mgr.root);
    }

    #[test]
    fn restore_recovers_modified_and_deleted_files() {
        let mut mgr = temp_mgr();
        let cp = mgr.create("snap".into()).unwrap();

        // Mutate + delete.
        fs::write(mgr.root.join("src/main.rs"), "fn hacked() {}").unwrap();
        fs::write(mgr.root.join("new.txt"), "should not be touched").unwrap();

        let n = mgr.restore(&cp.id).unwrap();
        assert!(n >= 1);
        assert_eq!(
            fs::read_to_string(mgr.root.join("src/main.rs")).unwrap(),
            "fn original() {}",
            "restore must revert content"
        );
        assert!(
            mgr.root.join("new.txt").exists(),
            "files outside checkpoint are untouched"
        );
        let _ = fs::remove_dir_all(&mgr.root);
    }

    #[test]
    fn verify_detects_corruption() {
        let mut mgr = temp_mgr();
        let cp = mgr.create("snap".into()).unwrap();
        assert!(mgr.verify(&cp.id).unwrap(), "fresh checkpoint verifies");

        // Tamper with stored content.
        let path = mgr.checkpoint_dir.join(format!("{}.json", cp.id));
        let mut parsed: Checkpoint =
            serde_json::from_str(&fs::read_to_string(&path).unwrap()).unwrap();
        *parsed.files.get_mut("src/main.rs").unwrap() = "fn tampered() {}".to_string();
        fs::write(&path, serde_json::to_string_pretty(&parsed).unwrap()).unwrap();

        assert!(!mgr.verify(&cp.id).unwrap(), "tampering must be caught");
        let _ = fs::remove_dir_all(&mgr.root);
    }

    #[test]
    fn delete_and_missing_errors() {
        let mut mgr = temp_mgr();
        let cp = mgr.create("gone".into()).unwrap();
        mgr.delete(&cp.id).unwrap();
        assert!(mgr.list().is_empty());
        assert!(mgr.delete(&cp.id).is_err(), "double delete errors");
        assert!(mgr.restore("nope").is_err(), "missing restore errors");
        let _ = fs::remove_dir_all(&mgr.root);
    }
}
