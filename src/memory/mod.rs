//! Persistent project memory: key/value notes that survive across sessions,
//! stored as JSON under `.morse/memory.json`.
//!
//! Used to record decisions, conventions, and context that should inform
//! future sessions (`morse memory add/get/search/list/delete`).

use crate::config::Config;
use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryEntry {
    pub key: String,
    pub value: String,
    #[serde(default)]
    pub embedding: Option<Vec<f32>>,
    #[serde(default)]
    pub metadata: HashMap<String, String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct MemoryStore {
    #[serde(default)]
    entries: HashMap<String, MemoryEntry>,
    #[serde(skip)]
    path: Option<PathBuf>,
}

impl MemoryStore {
    pub fn new() -> Self {
        Self::default()
    }

    /// Load from the project's `.morse/memory.json`, creating an empty store
    /// if it doesn't exist yet.
    pub fn load_default() -> Result<Self> {
        let root = std::env::current_dir()?;
        Self::load_at(root.join(".morse").join("memory.json"))
    }

    pub fn load_at(path: PathBuf) -> Result<Self> {
        let mut store = MemoryStore { entries: HashMap::new(), path: Some(path.clone()) };
        if path.exists() {
            let json = std::fs::read_to_string(&path)
                .with_context(|| format!("reading memory at {}", path.display()))?;
            if let Ok(loaded) = serde_json::from_str::<HashMap<String, MemoryEntry>>(&json) {
                store.entries = loaded;
            }
        }
        Ok(store)
    }

    fn persist(&self) -> Result<()> {
        let Some(path) = &self.path else { return Ok(()) };
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let json = serde_json::to_string_pretty(&self.entries)?;
        std::fs::write(path, json)?;
        Ok(())
    }

    /// Insert or update a key, preserving created_at on update.
    pub fn store(&mut self, key: String, value: String) -> Result<()> {
        let now = chrono::Utc::now();
        let created_at = self
            .entries
            .get(&key)
            .map(|e| e.created_at)
            .unwrap_or(now);
        self.entries.insert(
            key.clone(),
            MemoryEntry {
                key: key.clone(),
                value,
                embedding: None,
                metadata: HashMap::new(),
                created_at,
                updated_at: now,
            },
        );
        self.persist()
    }

    pub fn retrieve(&self, key: &str) -> Option<&String> {
        self.entries.get(key).map(|e| &e.value)
    }

    /// Substring search across keys and values (case-insensitive).
    pub fn search(&self, query: &str) -> Vec<&MemoryEntry> {
        let q = query.to_lowercase();
        let mut out: Vec<&MemoryEntry> = self
            .entries
            .values()
            .filter(|e| {
                e.key.to_lowercase().contains(&q) || e.value.to_lowercase().contains(&q)
            })
            .collect();
        // Prefer key matches, then most recently updated.
        out.sort_by(|a, b| {
            let a_key = a.key.to_lowercase().contains(&q) as u8;
            let b_key = b.key.to_lowercase().contains(&q) as u8;
            b_key.cmp(&a_key).then(b.updated_at.cmp(&a.updated_at))
        });
        out
    }

    pub fn delete(&mut self, key: &str) -> Result<Option<MemoryEntry>> {
        let removed = self.entries.remove(key);
        if removed.is_some() {
            self.persist()?;
        }
        Ok(removed)
    }

    pub fn list(&self) -> Vec<&MemoryEntry> {
        let mut out: Vec<&MemoryEntry> = self.entries.values().collect();
        out.sort_by_key(|a| std::cmp::Reverse(a.updated_at));
        out
    }

    pub fn count(&self) -> usize {
        self.entries.len()
    }
}

/// CLI: `morse memory [show|add k v|get k|search q|delete k]`.
pub fn run(cfg: &Config, action: Option<&str>) -> Result<()> {
    let _ = cfg;
    let mut store = MemoryStore::load_default()?;
    let parts: Vec<&str> = action.unwrap_or("show").split_whitespace().collect();
    let cmd = parts.first().copied().unwrap_or("show");

    match cmd {
        "show" | "list" => {
            let entries = store.list();
            if entries.is_empty() {
                println!("Project memory is empty.");
                println!("Add entries with: morse memory add <key> <value>");
                return Ok(());
            }
            println!("Project memory ({} entries):\n", entries.len());
            for e in entries {
                println!("  {} = {}", e.key, preview(&e.value, 70));
            }
        }
        "add" | "set" => {
            if parts.len() < 3 {
                println!("Usage: morse memory add <key> <value...>");
                return Ok(());
            }
            let key = parts[1].to_string();
            let value = parts[2..].join(" ");
            store.store(key.clone(), value)?;
            println!("Saved memory '{}'", key);
        }
        "get" => {
            let Some(key) = parts.get(1) else {
                println!("Usage: morse memory get <key>");
                return Ok(());
            };
            match store.retrieve(key) {
                Some(v) => println!("{} = {}", key, v),
                None => println!("No memory found for '{}'", key),
            }
        }
        "search" => {
            let query = parts[1..].join(" ");
            if query.trim().is_empty() {
                println!("Usage: morse memory search <query>");
                return Ok(());
            }
            let results = store.search(&query);
            if results.is_empty() {
                println!("No memory matches '{}'", query);
            } else {
                println!("{} match(es):\n", results.len());
                for e in results {
                    println!("  {} = {}", e.key, preview(&e.value, 90));
                }
            }
        }
        "delete" | "rm" => {
            let Some(key) = parts.get(1) else {
                println!("Usage: morse memory delete <key>");
                return Ok(());
            };
            if store.delete(key)?.is_some() {
                println!("Deleted '{}'", key);
            } else {
                println!("No memory found for '{}'", key);
            }
        }
        _ => {
            println!("Available actions: show, add <key> <value>, get <key>, search <query>, delete <key>");
        }
    }
    Ok(())
}

fn preview(s: &str, max: usize) -> String {
    let one_line: String = s.split_whitespace().collect::<Vec<_>>().join(" ");
    if one_line.chars().count() <= max {
        one_line
    } else {
        let cut: String = one_line.chars().take(max).collect();
        format!("{}…", cut)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_store() -> MemoryStore {
        let dir = std::env::temp_dir().join(format!("mem-test-{}", uuid::Uuid::new_v4()));
        MemoryStore::load_at(dir.join("memory.json")).unwrap()
    }

    #[test]
    fn store_retrieve_delete_roundtrip() {
        let mut store = temp_store();
        store.store("lang".into(), "rust".into()).unwrap();
        assert_eq!(store.retrieve("lang"), Some(&"rust".to_string()));
        assert!(store.delete("lang").unwrap().is_some());
        assert_eq!(store.retrieve("lang"), None);
        let _ = std::fs::remove_file(store.path.unwrap());
    }

    #[test]
    fn persists_across_loads() {
        let dir = std::env::temp_dir().join(format!("mem-test-{}", uuid::Uuid::new_v4()));
        let path = dir.join("memory.json");
        let mut store = MemoryStore::load_at(path.clone()).unwrap();
        store.store("db".into(), "postgres".into()).unwrap();

        let reloaded = MemoryStore::load_at(path.clone()).unwrap();
        assert_eq!(reloaded.retrieve("db"), Some(&"postgres".to_string()));
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn search_ranks_key_matches_first() {
        let mut store = temp_store();
        store.store("provider".into(), "groq".into()).unwrap();
        store.store("note".into(), "uses provider x".into()).unwrap();
        let res = store.search("provider");
        assert!(res.len() >= 2);
        assert_eq!(res[0].key, "provider", "key match should rank first");
        let _ = std::fs::remove_file(store.path.unwrap());
    }

    #[test]
    fn update_preserves_created_at() {
        let mut store = temp_store();
        store.store("k".into(), "v1".into()).unwrap();
        let created = store.entries["k"].created_at;
        std::thread::sleep(std::time::Duration::from_millis(5));
        store.store("k".into(), "v2".into()).unwrap();
        assert_eq!(store.entries["k"].created_at, created, "created_at must not change");
        assert_eq!(store.retrieve("k"), Some(&"v2".to_string()));
        let _ = std::fs::remove_file(store.path.unwrap());
    }
}
