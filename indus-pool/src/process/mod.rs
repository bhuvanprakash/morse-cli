//! Process management module
//!
//! Manages the PgCat child process lifecycle

pub mod pgcat_runner;

pub use pgcat_runner::PgcatRunner;

use std::process::ExitStatus;
use thiserror::Error;

/// Process management errors
#[derive(Error, Debug)]
pub enum ProcessError {
    #[error("Failed to spawn PgCat process: {0}")]
    SpawnError(String),
    
    #[error("PgCat process exited unexpectedly with status: {0}")]
    UnexpectedExit(ExitStatus),
    
    #[error("Failed to send signal to PgCat process: {0}")]
    SignalError(String),
    
    #[error("PgCat binary not found at: {0}")]
    BinaryNotFound(String),
    
    #[error("Configuration error: {0}")]
    ConfigError(String),
    
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
}

/// Process state
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ProcessState {
    /// Process is not running
    Stopped,
    /// Process is starting
    Starting,
    /// Process is running
    Running,
    /// Process is stopping
    Stopping,
    /// Process has crashed
    Crashed,
    /// Process is restarting
    Restarting,
}

impl std::fmt::Display for ProcessState {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ProcessState::Stopped => write!(f, "stopped"),
            ProcessState::Starting => write!(f, "starting"),
            ProcessState::Running => write!(f, "running"),
            ProcessState::Stopping => write!(f, "stopping"),
            ProcessState::Crashed => write!(f, "crashed"),
            ProcessState::Restarting => write!(f, "restarting"),
        }
    }
}
