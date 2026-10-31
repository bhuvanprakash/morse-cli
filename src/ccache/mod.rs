//! Completion cache: identical (model, prompt) pairs return the stored
//! response instantly and for free.
//!
//! Developers re-run the same question constantly while iterating; paying
//! tokens + latency every time is waste. Responses are stored on disk under
//! `.morse/cache/completions/` keyed by a SHA-256 of the exact request, with
//! a TTL. `--no-cache` / `/cache off` bypasses it; any change in system
//! prompt, messages, tools, or sampling settings produces a different key.

use crate::config::Config;
use anyhow::Result;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};

const DEFAULT_TTL: Duration = Duration::from_secs(24 * 3600);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheEntry {
    pub key: String,
    pub created_at: SystemTime,
    pub model: String,
    pub provider: String,
    /// The stored completion payload (opaque JSON).
    pub response: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct CacheIndex {
    #[serde(default)]
    enabled: bool,
    #[serde(default)]
    hits: u64,
    #[serde(default)]
    misses: u64,
    #[serde(default)]
    writes: u64,
}

static NO_CACHE_OVERRIDE: std::sync::OnceLock<bool> = std::sync::OnceLock::new();

/// Force-disable the cache for this process only (`--no-cache`).
pub fn set_session_override(disabled: bool) {
    let _ = NO_CACHE_OVERRIDE.set(disabled);
}

fn session_disabled() -> bool {
    *NO_CACHE_OVERRIDE.get().unwrap_or(&false)
}

/// Handle to the on-disk cache. `enabled` mirrors the user's `/cache` toggle
/// and is persisted so the choice survives restarts.
pub struct CompletionCache {
    dir: PathBuf,
    ttl: Duration,
}

/// Deterministic cache key for a request.
pub fn cache_key(model: &str, system: &str, messages: &str, temperature: f64, max_tokens: i32) -> String {
    let mut h = Sha256::new();
    h.update(model.as_bytes());
    h.update([0]);
    h.update(system.as_bytes());
    h.update([0]);
    h.update(messages.as_bytes());
    h.update([0]);
    h.update(temperature.to_le_bytes());
    h.update(max_tokens.to_le_bytes());
    format!("{:x}", h.finalize())
}

impl CompletionCache {
    pub fn new(cfg: &Config) -> Self {
        let dir = std::env::current_dir()
            .map(|r| r.join(".morse/cache/completions"))
            .unwrap_or_else(|_| PathBuf::from(".morse/cache/completions"));
        let _ = cfg;
        Self { dir, ttl: DEFAULT_TTL }
    }

    pub fn with_dir(dir: PathBuf, ttl: Duration) -> Self {
        Self { dir, ttl }
    }

    fn index_path(&self) -> PathBuf {
        self.dir.join("index.json")
    }

    fn read_index(&self) -> CacheIndex {
        std::fs::read_to_string(self.index_path())
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or(CacheIndex { enabled: true, hits: 0, misses: 0, writes: 0 })
    }

    fn write_index(&self, idx: &CacheIndex) -> Result<()> {
        std::fs::create_dir_all(&self.dir)?;
        std::fs::write(self.index_path(), serde_json::to_string_pretty(idx)?)?;
        Ok(())
    }

    /// Is the cache turned on? (Defaults to on for fresh installs; a
    /// `--no-cache` session override wins over the persisted toggle.)
    pub fn is_enabled(&self) -> bool {
        if session_disabled() {
            return false;
        }
        self.read_index().enabled
    }

    pub fn set_enabled(&self, on: bool) -> Result<()> {
        let mut idx = self.read_index();
        idx.enabled = on;
        self.write_index(&idx)
    }

    pub fn stats(&self) -> (bool, u64, u64, u64) {
        let idx = self.read_index();
        (idx.enabled, idx.hits, idx.misses, idx.writes)
    }

    /// Lookup a cached response. Records hit/miss stats. `Ok(None)` = miss.
    pub fn get(&self, key: &str) -> Result<Option<CacheEntry>> {
        let mut idx = self.read_index();
        if !idx.enabled {
            return Ok(None);
        }
        let path = self.dir.join(format!("{}.json", key));
        let Ok(text) = std::fs::read_to_string(&path) else {
            idx.misses += 1;
            let _ = self.write_index(&idx);
            return Ok(None);
        };
        let Ok(entry) = serde_json::from_str::<CacheEntry>(&text) else {
            // Corrupt entry: drop it.
            let _ = std::fs::remove_file(&path);
            idx.misses += 1;
            let _ = self.write_index(&idx);
            return Ok(None);
        };
        // TTL check.
        let expired = SystemTime::now()
            .duration_since(entry.created_at)
            .map(|age| age > self.ttl)
            .unwrap_or(true);
        if expired {
            let _ = std::fs::remove_file(&path);
            idx.misses += 1;
            let _ = self.write_index(&idx);
            return Ok(None);
        }
        idx.hits += 1;
        let _ = self.write_index(&idx);
        Ok(Some(entry))
    }

    /// Store a response for `key`.
    pub fn put(&self, key: &str, provider: &str, model: &str, response: &serde_json::Value) -> Result<()> {
        let mut idx = self.read_index();
        idx.writes += 1;
        self.write_index(&idx)?;
        let entry = CacheEntry {
            key: key.to_string(),
            created_at: SystemTime::now(),
            model: model.to_string(),
            provider: provider.to_string(),
            response: response.clone(),
        };
        std::fs::create_dir_all(&self.dir)?;
        std::fs::write(self.dir.join(format!("{}.json", key)), serde_json::to_string(&entry)?)?;
        Ok(())
    }

    /// Remove all cached responses (keeps the enabled flag + stats).
    pub fn clear(&self) -> Result<usize> {
        let mut removed = 0usize;
        if self.dir.exists() {
            for entry in std::fs::read_dir(&self.dir)?.flatten() {
                let path = entry.path();
                if path.file_name().map(|n| n != "index.json").unwrap_or(false)
                    && std::fs::remove_file(&path).is_ok()
                {
                    removed += 1;
                }
            }
        }
        Ok(removed)
    }
}

/// Best-effort helpers for CLI use (never fail the caller).
pub fn record_hit() {
    let dir = std::env::current_dir()
        .map(|r| r.join(".morse/cache/completions"))
        .unwrap_or_else(|_| PathBuf::from(".morse/cache/completions"));
    let c = CompletionCache::with_dir(dir, DEFAULT_TTL);
    let mut idx = c.read_index();
    idx.hits += 1;
    let _ = c.write_index(&idx);
}

pub fn is_cache_path(p: &Path) -> bool {
    p.starts_with(".morse/cache")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_cache() -> CompletionCache {
        let dir = std::env::temp_dir().join(format!("mcache-{}", uuid::Uuid::new_v4()));
        CompletionCache::with_dir(dir, DEFAULT_TTL)
    }

    #[test]
    fn key_is_deterministic_and_sensitive() {
        let a = cache_key("m1", "sys", "msgs", 0.7, 100);
        let b = cache_key("m1", "sys", "msgs", 0.7, 100);
        let c = cache_key("m2", "sys", "msgs", 0.7, 100);
        let d = cache_key("m1", "sys", "msgs2", 0.7, 100);
        assert_eq!(a, b, "same input → same key");
        assert_ne!(a, c, "model change → new key");
        assert_ne!(a, d, "prompt change → new key");
    }

    #[test]
    fn put_get_roundtrip() {
        let c = temp_cache();
        assert!(c.get("k1").unwrap().is_none(), "miss before put");
        c.put("k1", "groq", "m", &serde_json::json!({"content": "hi"})).unwrap();
        let entry = c.get("k1").unwrap().expect("hit after put");
        assert_eq!(entry.response["content"], "hi");
        assert_eq!(entry.provider, "groq");
        let _ = std::fs::remove_dir_all(&c.dir);
    }

    #[test]
    fn ttl_expires_entries() {
        let dir = std::env::temp_dir().join(format!("mcache-{}", uuid::Uuid::new_v4()));
        let c = CompletionCache::with_dir(dir.clone(), Duration::from_millis(0));
        c.put("k", "p", "m", &serde_json::json!({})).unwrap();
        // TTL of 0ms → immediately expired.
        assert!(c.get("k").unwrap().is_none(), "expired entry must not be returned");
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn disable_bypasses_reads_but_keeps_files() {
        let c = temp_cache();
        c.put("k", "p", "m", &serde_json::json!({"x":1})).unwrap();
        c.set_enabled(false).unwrap();
        assert!(!c.is_enabled());
        assert!(c.get("k").unwrap().is_none(), "disabled cache never hits");
        c.set_enabled(true).unwrap();
        assert!(c.get("k").unwrap().is_some(), "re-enabling restores hits");
        let _ = std::fs::remove_dir_all(&c.dir);
    }

    #[test]
    fn stats_count_hits_and_misses() {
        let c = temp_cache();
        let _ = c.get("missing"); // miss
        c.put("k", "p", "m", &serde_json::json!({})).unwrap();
        let _ = c.get("k"); // hit
        let (enabled, hits, misses, writes) = c.stats();
        assert!(enabled);
        assert_eq!((hits, misses, writes), (1, 1, 1));
        let _ = std::fs::remove_dir_all(&c.dir);
    }

    #[test]
    fn clear_removes_entries_keeps_index() {
        let c = temp_cache();
        c.put("a", "p", "m", &serde_json::json!({})).unwrap();
        c.put("b", "p", "m", &serde_json::json!({})).unwrap();
        let removed = c.clear().unwrap();
        assert_eq!(removed, 2);
        assert!(c.get("a").unwrap().is_none());
        assert!(c.is_enabled(), "clear keeps the toggle");
        let _ = std::fs::remove_dir_all(&c.dir);
    }
}
