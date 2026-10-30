use crate::errors::{ErrorCategory, MorseError, MorseResult};
use duckdb::Connection;
use std::path::PathBuf;

pub const STORAGE_CAPACITY_GB: usize = 5;
pub const STORAGE_CAPACITY_BYTES: usize = STORAGE_CAPACITY_GB * 1024 * 1024 * 1024;

pub struct Store {
    conn: Connection,
    db_path: PathBuf,
}

impl Store {
    pub fn open(project_root: &str) -> MorseResult<Self> {
        let morse_dir = PathBuf::from(project_root).join(".morse");
        std::fs::create_dir_all(&morse_dir).map_err(|e| {
            MorseError::new("DB-001", format!("Failed to create storage directory: {e}").as_str(), ErrorCategory::Storage)
        })?;
        let db_path = morse_dir.join("tracker.duck.db");
        Self::open_with_config(&db_path)
    }

    pub fn open_with_config(db_path: &PathBuf) -> MorseResult<Self> {
        let conn = Connection::open(db_path).map_err(|e| {
            MorseError::new("DB-002", format!("Failed to open DuckDB: {e}").as_str(), ErrorCategory::Storage)
        })?;

        let mut store = Store { conn, db_path: db_path.clone() };
        store.configure_capacity();
        store.migrate()?;
        Ok(store)
    }

    fn configure_capacity(&mut self) {
        let queries = [
            format!("PRAGMA memory_limit='{}GB'", STORAGE_CAPACITY_GB),
            "PRAGMA enable_progress_bar".to_string(),
            "PRAGMA threads".to_string(),
            format!("PRAGMA max_memory='{}GB'", STORAGE_CAPACITY_GB),
            "PRAGMA preserve_identifier_case".to_string(),
            "PRAGMA case_sensitive".to_string(),
        ];
        for q in queries {
            let _ = self.conn.execute(&q, []);
        }
    }

    fn migrate(&mut self) -> MorseResult<()> {
        let queries = [
            "CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                title TEXT,
                summary TEXT,
                turn_count INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )",
            "CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY,
                session_id TEXT,
                role TEXT,
                content TEXT,
                tokens INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(session_id) REFERENCES sessions(id)
            )",
            "CREATE TABLE IF NOT EXISTS files (
                id INTEGER PRIMARY KEY,
                path TEXT,
                content TEXT,
                version INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )",
            "CREATE TABLE IF NOT EXISTS telemetry (
                id INTEGER PRIMARY KEY,
                event_type TEXT,
                command TEXT,
                status TEXT,
                detail TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )",
            "CREATE TABLE IF NOT EXISTS file_search (
                id INTEGER PRIMARY KEY,
                path TEXT,
                content TEXT
            )",
            "CREATE INDEX IF NOT EXISTS idx_file_search_path ON file_search(path)",
            "CREATE TABLE IF NOT EXISTS context_nodes (
                id TEXT PRIMARY KEY,
                node_type TEXT NOT NULL,
                name TEXT,
                file_path TEXT,
                start_line INTEGER,
                end_line INTEGER,
                content_hash TEXT,
                content TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )",
            "CREATE TABLE IF NOT EXISTS context_edges (
                id INTEGER PRIMARY KEY,
                source_id TEXT NOT NULL,
                target_id TEXT NOT NULL,
                edge_type TEXT NOT NULL,
                FOREIGN KEY(source_id) REFERENCES context_nodes(id),
                FOREIGN KEY(target_id) REFERENCES context_nodes(id)
            )",
            "CREATE INDEX IF NOT EXISTS idx_context_nodes_file ON context_nodes(file_path)",
            "CREATE INDEX IF NOT EXISTS idx_context_nodes_type ON context_nodes(node_type)",
            "CREATE INDEX IF NOT EXISTS idx_context_edges_source ON context_edges(source_id)",
            "CREATE INDEX IF NOT EXISTS idx_context_edges_target ON context_edges(target_id)",
            "CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id)",
            "CREATE INDEX IF NOT EXISTS idx_sessions_updated_at ON sessions(updated_at DESC)",
        ];
        for q in queries {
            self.conn.execute(q, []).map_err(|e| {
                MorseError::new("DB-003", format!("Migration failed: {e}").as_str(), ErrorCategory::Storage)
            })?;
        }
        Ok(())
    }

    pub fn path(&self) -> &PathBuf {
        &self.db_path
    }

    pub fn storage_capacity_bytes() -> usize {
        STORAGE_CAPACITY_BYTES
    }

    pub fn storage_capacity_gb() -> usize {
        STORAGE_CAPACITY_GB
    }

    pub fn execute(&self, query: &str, params: &[&dyn duckdb::ToSql]) -> MorseResult<usize> {
        self.conn.execute(query, params).map_err(|e| {
            MorseError::new("DB-004", format!("Query execution failed: {e}").as_str(), ErrorCategory::Storage)
        })
    }

    pub fn query_row<F, T>(&self, query: &str, params: &[&dyn duckdb::ToSql], mapper: F) -> MorseResult<T>
    where
        F: FnOnce(&duckdb::Row<'_>) -> duckdb::Result<T>,
    {
        self.conn.query_row(query, params, mapper).map_err(|e| {
            MorseError::new("DB-005", format!("Query failed: {e}").as_str(), ErrorCategory::Storage)
        })
    }

    pub fn close(self) -> MorseResult<()> {
        self.conn.close().map_err(|(_, e)| {
            MorseError::new("DB-006", format!("Failed to close database: {e}").as_str(), ErrorCategory::Storage)
        })
    }

    pub fn ping(&self) -> MorseResult<()> {
        self.conn.query_row("SELECT 1", [], |_row| Ok(())).map_err(|e| {
            MorseError::new("DB-007", format!("Database ping failed: {e}").as_str(), ErrorCategory::Storage)
        })
    }
}
