//! Admin module
//!
//! Provides admin endpoints for pool management

pub mod handler;

pub use handler::AdminHandler;

use serde::{Deserialize, Serialize};

/// Pool statistics response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PoolStats {
    /// Pool name
    pub pool_name: String,
    /// Total number of servers in the pool
    pub total_servers: usize,
    /// Number of active connections
    pub active_connections: usize,
    /// Number of idle connections
    pub idle_connections: usize,
    /// Pool mode (session or transaction)
    pub pool_mode: String,
    /// Maximum pool size
    pub max_pool_size: usize,
    /// Current pool size
    pub current_pool_size: usize,
    /// Queries per second
    pub qps: f64,
    /// Average query time in milliseconds
    pub avg_query_time_ms: f64,
}

/// Pool configuration response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PoolConfig {
    /// Pool name
    pub name: String,
    /// Pool mode
    pub mode: String,
    /// Default database
    pub default_database: String,
    /// List of servers
    pub servers: Vec<ServerInfo>,
    /// List of users
    pub users: Vec<UserInfo>,
}

/// Server information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerInfo {
    /// Server host
    pub host: String,
    /// Server port
    pub port: u16,
    /// Server role (primary or replica)
    pub role: String,
    /// Server status
    pub status: String,
}

/// User information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserInfo {
    /// Username
    pub username: String,
    /// Pool size for this user
    pub pool_size: usize,
    /// Statement timeout
    pub statement_timeout: Option<u64>,
}

/// Reload response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReloadResponse {
    /// Whether the reload was successful
    pub success: bool,
    /// Message describing the result
    pub message: String,
    /// Timestamp of the reload
    pub timestamp: String,
}

impl ReloadResponse {
    /// Create a successful reload response
    pub fn success(message: impl Into<String>) -> Self {
        Self {
            success: true,
            message: message.into(),
            timestamp: chrono::Utc::now().to_rfc3339(),
        }
    }

    /// Create a failed reload response
    pub fn error(message: impl Into<String>) -> Self {
        Self {
            success: false,
            message: message.into(),
            timestamp: chrono::Utc::now().to_rfc3339(),
        }
    }
}
