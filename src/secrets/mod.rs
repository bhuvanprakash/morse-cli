//! Secret storage with environment-variable resolution.
//!
//! Secrets live in `.morse/secrets.json` (0600 permissions). A stored value
//! of the form `${VAR}` resolves at read time from the process environment,
//! so real credentials stay out of the file and only references are persisted.

use crate::config::Config;
use anyhow::{bail, Context, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecretEntry {
    pub key: String,
    pub value: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
struct SecretFile {
    #[serde(default)]
    secrets: HashMap<String, SecretEntry>,
}

pub struct SecretManager {
    store: HashMap<String, SecretEntry>,
    path: PathBuf,
}

impl Default for SecretManager {
    fn default() -> Self {
        Self::new().unwrap_or_else(|_| Self {
            store: HashMap::new(),
            path: PathBuf::from(".morse/secrets.json"),
        })
    }
}

fn resolve_env(raw: &str) -> String {
    // Expand ${VAR} and $VAR from the environment.
    let mut out = String::with_capacity(raw.len());
    let bytes: Vec<char> = raw.chars().collect();
    let mut i = 0;
    while i < bytes.len() {
        let c = bytes[i];
        if c == '$' && i + 1 < bytes.len() {
            let braced = bytes.get(i + 1) == Some(&'{');
            let (name_start, mut j) = if braced { (i + 2, i + 2) } else { (i + 1, i + 1) };
            while j < bytes.len() && (bytes[j].is_alphanumeric() || bytes[j] == '_') {
                j += 1;
            }
            let name: String = bytes[name_start..j].iter().collect();
            if braced {
                // expect closing }
                if bytes.get(j) == Some(&'}') {
                    j += 1;
                } else {
                    // malformed; emit literally
                    out.push(c);
                    i += 1;
                    continue;
                }
            }
            if !name.is_empty() {
                if let Ok(v) = std::env::var(&name) {
                    out.push_str(&v);
                }
                // If unset, expand to empty (standard shell behavior).
                i = j;
                continue;
            }
        }
        out.push(c);
        i += 1;
    }
    out
}

impl SecretManager {
    pub fn new() -> Result<Self> {
        let path = std::env::current_dir()?.join(".morse").join("secrets.json");
        Self::load_at(path)
    }

    pub fn load_at(path: PathBuf) -> Result<Self> {
        let mut store = HashMap::new();
        if path.exists() {
            let json = std::fs::read_to_string(&path)
                .with_context(|| format!("reading secrets at {}", path.display()))?;
            if let Ok(f) = serde_json::from_str::<SecretFile>(&json) {
                store = f.secrets;
            }
        }
        Ok(Self { store, path })
    }

    fn persist(&self) -> Result<()> {
        if let Some(parent) = self.path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let file = SecretFile { secrets: self.store.clone() };
        let json = serde_json::to_string_pretty(&file)?;
        std::fs::write(&self.path, json)?;
        // Restrict permissions to owner on unix.
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let _ = std::fs::set_permissions(&self.path, std::fs::Permissions::from_mode(0o600));
        }
        Ok(())
    }

    pub fn set(&mut self, key: String, value: String) -> Result<()> {
        let now = chrono::Utc::now();
        let created_at = self.store.get(&key).map(|e| e.created_at).unwrap_or(now);
        self.store.insert(
            key.clone(),
            SecretEntry { key: key.clone(), value, created_at, updated_at: now },
        );
        self.persist()
    }

    /// Read a secret with `${VAR}` references resolved from the environment.
    pub fn get_resolved(&self, key: &str) -> Option<String> {
        self.store.get(key).map(|e| resolve_env(&e.value))
    }

    /// Raw stored value (unresolved) — used for list/audit.
    pub fn get_raw(&self, key: &str) -> Option<&str> {
        self.store.get(key).map(|e| e.value.as_str())
    }

    pub fn delete(&mut self, key: &str) -> Result<Option<SecretEntry>> {
        let removed = self.store.remove(key);
        if removed.is_some() {
            self.persist()?;
        }
        Ok(removed)
    }

    pub fn list(&self) -> Vec<&SecretEntry> {
        let mut out: Vec<&SecretEntry> = self.store.values().collect();
        out.sort_by(|a, b| a.key.cmp(&b.key));
        out
    }

    /// Rotate: update the value, bumping updated_at.
    pub fn rotate(&mut self, key: &str, new_value: String) -> Result<()> {
        if let Some(entry) = self.store.get_mut(key) {
            entry.value = new_value;
            entry.updated_at = chrono::Utc::now();
            self.persist()?;
            Ok(())
        } else {
            bail!("Secret not found: {}", key)
        }
    }

    /// Audit: report count and whether any secrets embed raw (non-env) values.
    pub fn audit(&self) -> String {
        let total = self.store.len();
        let env_refs = self
            .store
            .values()
            .filter(|e| e.value.contains("${") || e.value.starts_with('$'))
            .count();
        let raw = total - env_refs;
        format!(
            "Secret audit: {} stored, {} reference env vars, {} hold literal values",
            total, env_refs, raw
        )
    }
}

pub fn run(cfg: &Config, action: Option<&str>) -> Result<()> {
    let _ = cfg;
    let mut mgr = SecretManager::new()?;
    let parts: Vec<&str> = action.unwrap_or("list").split_whitespace().collect();
    let cmd = parts.first().copied().unwrap_or("list");

    match cmd {
        "list" => {
            let secrets = mgr.list();
            if secrets.is_empty() {
                println!("No secrets stored.");
                println!("Add one with: morse secrets set <key> \"${{MY_ENV_VAR}}\"");
            } else {
                println!("Stored secrets:\n");
                for s in secrets {
                    let kind = if s.value.contains("${") { "env-ref" } else { "literal" };
                    println!("  {:<24} [{}] updated {}", s.key, kind, s.updated_at.format("%Y-%m-%d"));
                }
            }
        }
        "get" => {
            let Some(key) = parts.get(1) else {
                println!("Usage: morse secrets get <key>");
                return Ok(());
            };
            match mgr.get_resolved(key) {
                Some(v) => {
                    // Mask the value unless it's clearly non-sensitive.
                    let masked = mask(&v);
                    println!("{} = {}", key, masked);
                }
                None => println!("No secret found for '{}'", key),
            }
        }
        "set" => {
            if parts.len() < 3 {
                println!("Usage: morse secrets set <key> <value-or-${{ENV_VAR}}>");
                return Ok(());
            }
            let key = parts[1].to_string();
            let value = parts[2..].join(" ");
            mgr.set(key.clone(), value)?;
            println!("Stored secret '{}'", key);
        }
        "delete" | "rm" => {
            let Some(key) = parts.get(1) else {
                println!("Usage: morse secrets delete <key>");
                return Ok(());
            };
            if mgr.delete(key)?.is_some() {
                println!("Deleted '{}'", key);
            } else {
                println!("No secret found for '{}'", key);
            }
        }
        "rotate" => {
            if parts.len() < 3 {
                println!("Usage: morse secrets rotate <key> <new-value>");
                return Ok(());
            }
            mgr.rotate(parts[1], parts[2..].join(" "))?;
            println!("Rotated '{}'", parts[1]);
        }
        "audit" => {
            println!("{}", mgr.audit());
        }
        _ => {
            println!("Available actions: list, get <key>, set <key> <value>, delete <key>, rotate <key> <value>, audit");
        }
    }
    Ok(())
}

fn mask(v: &str) -> String {
    let chars: Vec<char> = v.chars().collect();
    if chars.len() <= 4 {
        return "*".repeat(chars.len().max(1));
    }
    let head: String = chars[..2].iter().collect();
    let tail: String = chars[chars.len() - 2..].iter().collect();
    format!("{}{}{}", head, "*".repeat((chars.len() - 4).min(12)), tail)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_mgr() -> SecretManager {
        let dir = std::env::temp_dir().join(format!("sec-{}", uuid::Uuid::new_v4()));
        SecretManager::load_at(dir.join("secrets.json")).unwrap()
    }

    #[test]
    fn env_var_resolution() {
        std::env::set_var("MORSE_TEST_SECRET", "s3cr3t");
        assert_eq!(resolve_env("${MORSE_TEST_SECRET}"), "s3cr3t");
        assert_eq!(resolve_env("prefix-${MORSE_TEST_SECRET}-suffix"), "prefix-s3cr3t-suffix");
        // Unset -> empty.
        assert_eq!(resolve_env("${MORSE_DEFINITELY_UNSET_XYZ}"), "");
        // Not a var reference -> untouched.
        assert_eq!(resolve_env("plain"), "plain");
        // Malformed braced -> literal.
        assert_eq!(resolve_env("${unclosed"), "${unclosed");
    }

    #[test]
    fn set_get_delete_roundtrip() {
        let mut m = temp_mgr();
        m.set("KEY".into(), "${MORSE_TEST_SECRET}".into()).unwrap();
        assert_eq!(m.get_resolved("KEY").as_deref(), Some("s3cr3t"));
        assert_eq!(m.get_raw("KEY"), Some("${MORSE_TEST_SECRET}"));
        assert!(m.delete("KEY").unwrap().is_some());
        assert_eq!(m.get_resolved("KEY"), None);
        let _ = std::fs::remove_file(&m.path);
    }

    #[test]
    fn persists_across_instances() {
        let dir = std::env::temp_dir().join(format!("sec-{}", uuid::Uuid::new_v4()));
        let path = dir.join("secrets.json");
        let mut m = SecretManager::load_at(path.clone()).unwrap();
        m.set("A".into(), "lit".into()).unwrap();
        drop(m);
        let m2 = SecretManager::load_at(path.clone()).unwrap();
        assert_eq!(m2.get_resolved("A").as_deref(), Some("lit"));
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn rotate_updates_and_fails_if_missing() {
        let mut m = temp_mgr();
        m.set("K".into(), "v1".into()).unwrap();
        m.rotate("K", "v2".into()).unwrap();
        assert_eq!(m.get_resolved("K").as_deref(), Some("v2"));
        assert!(m.rotate("NOPE", "x".into()).is_err());
        let _ = std::fs::remove_file(&m.path);
    }

    #[test]
    fn audit_counts_env_refs_vs_literals() {
        let mut m = temp_mgr();
        std::env::set_var("MORSE_TEST_SECRET", "s3cr3t");
        m.set("ref".into(), "${MORSE_TEST_SECRET}".into()).unwrap();
        m.set("lit".into(), "literal".into()).unwrap();
        let a = m.audit();
        assert!(a.contains("2 stored"), "audit: {}", a);
        assert!(a.contains("1 reference"), "audit: {}", a);
        let _ = std::fs::remove_file(&m.path);
    }

    #[test]
    fn mask_hides_value() {
        assert_eq!(mask("ab"), "**");
        let masked = mask("supersecretvalue");
        assert!(!masked.contains("persecret"), "mask leaked: {}", masked);
        assert!(masked.starts_with("su") && masked.ends_with("ue"));
    }
}
