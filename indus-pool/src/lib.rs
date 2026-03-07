//! Indus Pool - A Rust wrapper for PgCat connection pooler
//!
//! This crate provides:
//! - Process management for PgCat
//! - Health check endpoints
//! - Prometheus metrics export
//! - Admin API for pool management

pub mod config;
pub mod health;
pub mod metrics;
pub mod admin;
pub mod process;

use std::sync::atomic::AtomicU64;
use std::sync::Arc;

use config::Config;

/// Shared application state for axum handlers
#[derive(Clone)]
pub struct AppState {
    /// Application configuration
    pub config: Arc<Config>,
    /// PgCat restart counter (shared with runner and exporter)
    pub restart_counter: Arc<AtomicU64>,
}

impl AppState {
    /// Create new application state
    pub fn new(config: Arc<Config>, restart_counter: Arc<AtomicU64>) -> Self {
        Self {
            config,
            restart_counter,
        }
    }
}
