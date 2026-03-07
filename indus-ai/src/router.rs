//! Router module
//!
//! Axum router and application state

use std::sync::Arc;

use sqlx::PgPool;

use crate::config::Config;
use crate::embeddings::EmbeddingProvider;

/// Application state shared across all handlers
#[derive(Clone)]
pub struct AppState {
    /// Database connection pool
    pub pool: PgPool,
    /// Embedding provider
    pub embedding_provider: Arc<Box<dyn EmbeddingProvider>>,
    /// Application configuration
    pub config: Config,
}

impl AppState {
    /// Create a new application state
    pub fn new(
        pool: PgPool,
        embedding_provider: Box<dyn EmbeddingProvider>,
        config: Config,
    ) -> Self {
        Self {
            pool,
            embedding_provider: Arc::new(embedding_provider),
            config,
        }
    }
}

// Re-export modules for easier imports
pub use crate::db;
pub use crate::embeddings;
pub use crate::handlers;
pub use crate::middleware;
pub use crate::models;
