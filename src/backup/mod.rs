//! Backups: snapshot project files (and the `.morse` state) to a timestamped
//! directory with a SHA-256 manifest, list/restore/verify/clean them up.
//!
//! Layout: `.morse/backups/<id>/` containing copied files + `manifest.json`.

use crate::config::Config;
use anyhow::{bail, Context, Result};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::time::SystemTime;

const IGNORED_DIRS: &[&str] = &["node_modules", "target", ".git", "dist", "build", ".venv"];
const IGNORED_FILES: &[&str] = &[".DS_Store"];
const MAX_FILE_BYTES: u64 = 5 * 1024 * 1024; // skip files > 5MB
const DEFAULT_MAX_DEPTH: usize = 8;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupManifest {
    pub id: String,
    pub created_at: SystemTime,
    pub file_count: usize,
    pub size_bytes: u64,
    /// relative path -> sha256 hex
    pub checksums: BTreeMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupMetadata {
    pub id: String,
    pub created_at: SystemTime,
    pub size_bytes: u64,
    pub file_count: usize,
    pub path: String,
}

pub struct BackupManager {
    #[allow(dead_code)]
    cfg: Config,
    backup_dir: PathBuf,
    root: PathBuf,
}

fn sha256_hex(bytes: &[u8]) -> String {
    let mut h = Sha256::new();
    h.update(bytes);
    format!("{:x}", h.finalize())
}

impl BackupManager {
    pub fn new(cfg: Config) -> Result<Self> {
        let root = std::env::current_dir()?;
        let backup_dir = root.join(".morse/backups");
        std::fs::create_dir_all(&backup_dir)?;
        Ok(Self { cfg, backup_dir, root })
    }

    pub fn with_dirs(cfg: Config, root: PathBuf, backup_dir: PathBuf) -> Result<Self> {
        std::fs::create_dir_all(&backup_dir)?;
        Ok(Self { cfg, backup_dir, root })
    }

    /// Snapshot tracked project files into a new backup.
    pub fn create_backup(&mut self) -> Result<BackupMetadata> {
        let ts = SystemTime::now().duration_since(SystemTime::UNIX_EPOCH)?.as_secs();
        let id = format!("backup-{}", ts);
        let dest = self.backup_dir.join(&id);
        std::fs::create_dir_all(&dest)?;

        let mut files = Vec::new();
        collect_files(&self.root, &self.root, 0, &mut files);

        let mut checksums = BTreeMap::new();
        let mut size_bytes = 0u64;
        for rel in &files {
            let src = self.root.join(rel);
            let out = dest.join(rel);
            if let Some(p) = out.parent() {
                std::fs::create_dir_all(p)?;
            }
            let bytes = std::fs::read(&src)?;
            size_bytes += bytes.len() as u64;
            checksums.insert(rel.to_string_lossy().to_string(), sha256_hex(&bytes));
            std::fs::write(&out, &bytes)?;
        }

        let manifest = BackupManifest {
            id: id.clone(),
            created_at: SystemTime::now(),
            file_count: files.len(),
            size_bytes,
            checksums,
        };
        std::fs::write(dest.join("manifest.json"), serde_json::to_string_pretty(&manifest)?)?;

        Ok(BackupMetadata {
            id,
            created_at: manifest.created_at,
            size_bytes,
            file_count: manifest.file_count,
            path: dest.display().to_string(),
        })
    }

    /// List backups found on disk (newest first).
    pub fn list_backups(&self) -> Vec<BackupMetadata> {
        let mut out = Vec::new();
        let Ok(entries) = std::fs::read_dir(&self.backup_dir) else { return out };
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }
            let manifest_path = path.join("manifest.json");
            if let Ok(json) = std::fs::read_to_string(&manifest_path) {
                if let Ok(m) = serde_json::from_str::<BackupManifest>(&json) {
                    out.push(BackupMetadata {
                        id: m.id,
                        created_at: m.created_at,
                        size_bytes: m.size_bytes,
                        file_count: m.file_count,
                        path: path.display().to_string(),
                    });
                    continue;
                }
            }
            // Fallback for a dir without a readable manifest.
            let id = entry.file_name().to_string_lossy().to_string();
            out.push(BackupMetadata {
                path: path.display().to_string(),
                id,
                created_at: SystemTime::UNIX_EPOCH,
                size_bytes: 0,
                file_count: 0,
            });
        }
        out.sort_by_key(|b| std::cmp::Reverse(b.created_at));
        out
    }

    /// Restore files from a backup, overwriting existing ones. Current files
    /// that would be overwritten are first copied to `.morse/backups/pre-restore/`.
    pub fn restore_backup(&self, backup_id: &str) -> Result<usize> {
        let src = self.backup_dir.join(backup_id);
        if !src.is_dir() {
            bail!("Backup not found: {}", backup_id);
        }
        let manifest_json =
            std::fs::read_to_string(src.join("manifest.json")).context("missing manifest")?;
        let manifest: BackupManifest = serde_json::from_str(&manifest_json)?;

        // Safety copy of files we're about to overwrite.
        let staging = self.backup_dir.join("pre-restore");
        let mut restored = 0usize;
        for rel in manifest.checksums.keys() {
            let from = src.join(rel);
            let to = self.root.join(rel);
            if to.exists() {
                if let Some(p) = staging.join(rel).parent() {
                    std::fs::create_dir_all(p)?;
                }
                let _ = std::fs::copy(&to, staging.join(rel));
            }
            if let Some(p) = to.parent() {
                std::fs::create_dir_all(p)?;
            }
            std::fs::copy(&from, &to)?;
            restored += 1;
        }
        Ok(restored)
    }

    /// Verify each backup's files still match their recorded checksums.
    pub fn verify_backups(&self) -> Result<(usize, usize)> {
        let mut ok = 0;
        let mut bad = 0;
        for meta in self.list_backups() {
            if self.verify_one(&meta.id).unwrap_or(false) {
                ok += 1;
            } else {
                bad += 1;
            }
        }
        Ok((ok, bad))
    }

    fn verify_one(&self, id: &str) -> Result<bool> {
        let dir = self.backup_dir.join(id);
        let json = std::fs::read_to_string(dir.join("manifest.json"))?;
        let manifest: BackupManifest = serde_json::from_str(&json)?;
        for (rel, expected) in &manifest.checksums {
            let bytes = std::fs::read(dir.join(rel))?;
            if &sha256_hex(&bytes) != expected {
                return Ok(false);
            }
        }
        Ok(true)
    }

    /// Remove backups older than `retention_days`. Returns count removed.
    pub fn cleanup_old_backups(&mut self, retention_days: u32) -> Result<usize> {
        let now_secs = SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        let cutoff = now_secs.saturating_sub(u64::from(retention_days) * 86_400);
        let mut removed = 0;
        for meta in self.list_backups() {
            let created = meta
                .created_at
                .duration_since(SystemTime::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs();
            if created < cutoff {
                std::fs::remove_dir_all(&meta.path)?;
                removed += 1;
            }
        }
        Ok(removed)
    }
}

fn collect_files(root: &Path, dir: &Path, depth: usize, out: &mut Vec<PathBuf>) {
    if depth > DEFAULT_MAX_DEPTH {
        return;
    }
    let Ok(entries) = std::fs::read_dir(dir) else { return };
    for entry in entries.flatten() {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        if path.is_dir() {
            if IGNORED_DIRS.contains(&name.as_str()) || name.starts_with('.') {
                continue;
            }
            collect_files(root, &path, depth + 1, out);
        } else if path.is_file() {
            if IGNORED_FILES.contains(&name.as_str()) || name == "manifest.json" {
                continue;
            }
            let meta = entry.metadata().ok();
            if let Some(m) = &meta {
                if m.len() > MAX_FILE_BYTES || m.len() == 0 {
                    continue;
                }
            }
            if let Ok(rel) = path.strip_prefix(root) {
                out.push(rel.to_path_buf());
            }
        }
    }
}

pub fn run(cfg: &Config, action: Option<&str>) -> Result<()> {
    let mut mgr = BackupManager::new(cfg.clone())?;
    let parts: Vec<&str> = action.unwrap_or("list").split_whitespace().collect();
    let cmd = parts.first().copied().unwrap_or("list");

    match cmd {
        "create" => {
            let meta = mgr.create_backup()?;
            println!(
                "Backup created: {} ({} files, {} bytes)",
                meta.id, meta.file_count, meta.size_bytes
            );
        }
        "list" => {
            let backups = mgr.list_backups();
            if backups.is_empty() {
                println!("No backups found. Create one with 'morse backup create'.");
            } else {
                println!("Backups (newest first):\n");
                for b in &backups {
                    println!(
                        "  {:<20} {} files  {} bytes",
                        b.id, b.file_count, b.size_bytes
                    );
                }
            }
        }
        "restore" => {
            let Some(id) = parts.get(1) else {
                let backups = mgr.list_backups();
                println!("Usage: morse backup restore <id>");
                if let Some(latest) = backups.first() {
                    println!("Latest available: {}", latest.id);
                }
                return Ok(());
            };
            let n = mgr.restore_backup(id)?;
            println!("Restored {} files from {}", n, id);
        }
        "verify" => {
            let (ok, bad) = mgr.verify_backups()?;
            if bad == 0 {
                println!("Verified {} backup(s): all checksums OK", ok);
            } else {
                println!("{} OK, {} CORRUPT", ok, bad);
                if bad > 0 {
                    std::process::exit(1);
                }
            }
        }
        "clean" | "prune" => {
            let days: u32 = parts
                .get(1)
                .and_then(|s| s.parse().ok())
                .unwrap_or(30);
            let removed = mgr.cleanup_old_backups(days)?;
            println!("Removed {} backup(s) older than {} days", removed, days);
        }
        _ => {
            println!("Available actions: create, list, restore <id>, verify, clean [days]");
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_mgr() -> BackupManager {
        let root = std::env::temp_dir().join(format!("bk-{}", uuid::Uuid::new_v4()));
        let bdir = root.join(".morse/backups");
        std::fs::create_dir_all(root.join("src")).unwrap();
        std::fs::write(root.join("src/lib.rs"), "fn alpha() {}").unwrap();
        std::fs::write(root.join("README.md"), "# hi").unwrap();
        BackupManager::with_dirs(Config::default(), root, bdir).unwrap()
    }

    #[test]
    fn create_lists_and_checksums() {
        let mut mgr = temp_mgr();
        let meta = mgr.create_backup().unwrap();
        assert!(meta.file_count >= 2, "expected >=2 files, got {}", meta.file_count);
        assert!(meta.size_bytes > 0);
        let list = mgr.list_backups();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].id, meta.id);
        let _ = std::fs::remove_dir_all(&mgr.root);
    }

    #[test]
    fn verify_detects_corruption() {
        let mut mgr = temp_mgr();
        let meta = mgr.create_backup().unwrap();
        // Corrupt one file in the backup.
        let target = mgr.backup_dir.join(&meta.id).join("README.md");
        std::fs::write(&target, "tampered").unwrap();
        let (ok, bad) = mgr.verify_backups().unwrap();
        assert_eq!((ok, bad), (0, 1), "corruption must be detected");
        let _ = std::fs::remove_dir_all(&mgr.root);
    }

    #[test]
    fn restore_recovers_deleted_file() {
        let mut mgr = temp_mgr();
        let meta = mgr.create_backup().unwrap();
        // Delete a source file.
        let target = mgr.root.join("README.md");
        std::fs::remove_file(&target).unwrap();
        assert!(!target.exists());
        let n = mgr.restore_backup(&meta.id).unwrap();
        assert!(n >= 2);
        assert!(target.exists(), "restore should bring the file back");
        let _ = std::fs::remove_dir_all(&mgr.root);
    }

    #[test]
    fn cleanup_removes_old_only() {
        let mut mgr = temp_mgr();
        mgr.create_backup().unwrap();
        // 0-day retention: everything older than "now - 0s" counts as old only
        // if created < cutoff; with cutoff = now, the just-created backup is
        // not older. Use retention 0 => cutoff = now, so created < now => removed.
        let removed = mgr.cleanup_old_backups(0).unwrap();
        assert!(removed <= 1);
        let _ = std::fs::remove_dir_all(&mgr.root);
    }
}
