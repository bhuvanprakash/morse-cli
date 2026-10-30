use crate::config::Config;
use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionData {
    pub id: String,
    pub name: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
    pub messages: Vec<SessionMessage>,
    pub metadata: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionMessage {
    pub role: String,
    pub content: String,
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub tokens: Option<i32>,
}

pub struct SessionStore {
    sessions: HashMap<String, SessionData>,
    store_dir: std::path::PathBuf,
}

impl SessionStore {
    pub fn new() -> Result<Self> {
        let store_dir = std::env::current_dir()?.join(".morse/sessions");
        fs::create_dir_all(&store_dir)?;
        Ok(Self {
            sessions: HashMap::new(),
            store_dir,
        })
    }

    pub fn create(&mut self, name: String) -> String {
        let id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now();
        let session = SessionData {
            id: id.clone(),
            name,
            created_at: now,
            updated_at: now,
            messages: Vec::new(),
            metadata: HashMap::new(),
        };
        self.sessions.insert(id.clone(), session);
        id
    }

    pub fn add_message(&mut self, session_id: &str, role: String, content: String) {
        if let Some(session) = self.sessions.get_mut(session_id) {
            session.messages.push(SessionMessage {
                role,
                content,
                timestamp: chrono::Utc::now(),
                tokens: None,
            });
            session.updated_at = chrono::Utc::now();
        }
    }

    pub fn get_session(&self, id: &str) -> Option<&SessionData> {
        self.sessions.get(id)
    }

    /// Scan the store directory for sessions persisted on disk.
    pub fn scan_disk(&self) -> Vec<SessionData> {
        let mut out = Vec::new();
        let Ok(entries) = fs::read_dir(&self.store_dir) else { return out };
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) != Some("json") {
                continue;
            }
            if let Ok(contents) = fs::read_to_string(&path) {
                if let Ok(s) = serde_json::from_str::<SessionData>(&contents) {
                    out.push(s);
                }
            }
        }
        out.sort_by_key(|a| std::cmp::Reverse(a.updated_at));
        out
    }

    /// Load the most recently updated session, if any.
    pub fn latest(&self) -> Option<SessionData> {
        self.scan_disk().into_iter().next()
    }

    pub fn delete(&mut self, id: &str) -> Result<bool> {
        let path = self.store_dir.join(format!("{}.json", id));
        self.sessions.remove(id);
        if path.exists() {
            fs::remove_file(&path)?;
            Ok(true)
        } else {
            Ok(false)
        }
    }

    pub fn list_sessions(&self) -> Vec<&SessionData> {
        self.sessions.values().collect()
    }

    pub fn save(&self, id: &str) -> Result<()> {
        if let Some(session) = self.sessions.get(id) {
            let path = self.store_dir.join(format!("{}.json", id));
            let json = serde_json::to_string_pretty(session)?;
            fs::write(path, json)?;
        }
        Ok(())
    }

    /// Replace a session's full state and persist it to disk immediately.
    /// Used by the TUI to write back an edited transcript.
    pub fn replace(&mut self, id: &str, data: SessionData) -> Result<()> {
        self.sessions.insert(id.to_string(), data);
        self.save(id)
    }

    pub fn load(&mut self, id: &str) -> Result<Option<SessionData>> {
        let path = self.store_dir.join(format!("{}.json", id));
        if path.exists() {
            let contents = fs::read_to_string(&path)?;
            let session: SessionData = serde_json::from_str(&contents)?;
            self.sessions.insert(id.to_string(), session.clone());
            Ok(Some(session))
        } else {
            Ok(None)
        }
    }
}

pub fn run(cfg: &Config, action: Option<&str>) -> Result<()> {
    let _ = cfg;
    let mut store = SessionStore::new()?;
    let parts: Vec<&str> = action.unwrap_or("list").split_whitespace().collect();
    let cmd = parts.first().copied().unwrap_or("list");
    let arg = parts.get(1).copied();

    match cmd {
        "list" => {
            let sessions = store.scan_disk();
            if sessions.is_empty() {
                println!("No sessions found. Start one with 'morse chat'.");
            } else {
                println!("Sessions (newest first):\n");
                for s in &sessions {
                    let when = s.updated_at.format("%Y-%m-%d %H:%M");
                    println!("  {:<10} {:<28} {} msgs  updated {}",
                        truncate_id(&s.id), s.name, s.messages.len(), when);
                }
                println!("\nResume: morse sessions resume <id>");
            }
        }
        "save" => {
            let id = store.create(arg.unwrap_or("default").to_string());
            store.add_message(&id, "system".to_string(), "Session started".to_string());
            store.save(&id)?;
            println!("Session created: {}", id);
        }
        "resume" | "show" | "get" => {
            let id = match arg {
                Some(a) => a.to_string(),
                None => match store.latest() {
                    Some(s) => {
                        println!("No id given — resuming most recent session '{}'.", s.name);
                        s.id
                    }
                    None => {
                        println!("No sessions to resume.");
                        return Ok(());
                    }
                },
            };
            match store.load(&id)? {
                Some(s) => {
                    println!("Session {} — {} ({} messages)\n", s.id, s.name, s.messages.len());
                    for m in &s.messages {
                        let ts = m.timestamp.format("%H:%M");
                        println!("[{}] {}: {}", ts, m.role, preview(&m.content, 100));
                    }
                }
                None => println!("Session '{}' not found.", id),
            }
        }
        "delete" | "rm" => {
            let Some(id) = arg else {
                println!("Usage: morse sessions delete <id>");
                return Ok(());
            };
            if store.delete(id)? {
                println!("Deleted session {}", id);
            } else {
                println!("Session '{}' not found.", id);
            }
        }
        _ => {
            println!("Available actions: list, save [name], resume [id], delete <id>");
        }
    }
    Ok(())
}

fn truncate_id(id: &str) -> String {
    id.chars().take(8).collect()
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

    fn temp_store() -> SessionStore {
        let dir = std::env::temp_dir().join(format!("sess-test-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&dir).unwrap();
        SessionStore { sessions: HashMap::new(), store_dir: dir }
    }

    #[test]
    fn create_add_save_load_roundtrip() {
        let mut store = temp_store();
        let id = store.create("my chat".into());
        store.add_message(&id, "user".into(), "hello".into());
        store.save(&id).unwrap();

        let mut fresh = SessionStore { sessions: HashMap::new(), store_dir: store.store_dir.clone() };
        let loaded = fresh.load(&id).unwrap().expect("session should load");
        assert_eq!(loaded.name, "my chat");
        assert_eq!(loaded.messages.len(), 1);
        assert_eq!(loaded.messages[0].content, "hello");
        let _ = fs::remove_dir_all(&store.store_dir);
    }

    #[test]
    fn scan_disk_lists_saved_sessions_sorted() {
        let mut store = temp_store();
        let a = store.create("first".into());
        store.save(&a).unwrap();
        let b = store.create("second".into());
        store.save(&b).unwrap();
        let found = store.scan_disk();
        assert_eq!(found.len(), 2);
        let _ = fs::remove_dir_all(&store.store_dir);
    }

    #[test]
    fn delete_removes_from_disk() {
        let mut store = temp_store();
        let id = store.create("gone".into());
        store.save(&id).unwrap();
        assert!(store.delete(&id).unwrap());
        assert!(!store.delete(&id).unwrap(), "second delete reports not found");
        assert!(store.scan_disk().is_empty());
        let _ = fs::remove_dir_all(&store.store_dir);
    }
}
