use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::process::Stdio;

use anyhow::{Context, Result};
use tokio::process::{Child, Command};
use tokio::time::{sleep, timeout, Duration};
use tracing::{debug, error, info, warn};

use crate::config::Config;
use crate::process::ProcessError;

/// PgCat process runner
/// Manages the lifecycle of the PgCat child process with restart logic
pub struct PgcatRunner {
    child: Option<Child>,
    restart_count: AtomicU64,
}

impl PgcatRunner {
    /// Create a new PgcatRunner (does not spawn the process yet)
    pub fn new() -> Self {
        Self {
            child: None,
            restart_count: AtomicU64::new(0),
        }
    }

    /// Spawn the PgCat process
    /// 
    /// Starts the pgcat binary with the provided configuration file
    pub async fn spawn(config: &Config) -> Result<Self> {
        let binary_path = &config.pgcat_binary_path;
        let config_path = &config.pgcat_config_path;

        debug!("Starting PgCat from {} with config {}", binary_path, config_path);

        // Verify binary exists
        if !std::path::Path::new(binary_path).exists() {
            return Err(ProcessError::BinaryNotFound(binary_path.clone()).into());
        }

        // Verify config exists
        if !std::path::Path::new(config_path).exists() {
            return Err(ProcessError::ConfigError(format!(
                "Config file not found: {}",
                config_path
            ))
            .into());
        }

        // Spawn PgCat process
        let child = Command::new(binary_path)
            .arg(config_path)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .with_context(|| format!("Failed to spawn PgCat from {}", binary_path))?;

        info!("PgCat spawned successfully with PID: {:?}", child.id());

        Ok(Self {
            child: Some(child),
            restart_count: AtomicU64::new(0),
        })
    }

    /// Check if the PgCat process is still alive
    /// 
    /// Uses try_wait() to check process status without blocking
    pub fn is_alive(&mut self) -> bool {
        match self.child {
            Some(ref mut child) => {
                match child.try_wait() {
                    Ok(None) => true,  // Process still running
                    Ok(Some(_status)) => {
                        // Process has exited
                        false
                    }
                    Err(e) => {
                        error!("Error checking PgCat process status: {}", e);
                        false
                    }
                }
            }
            None => false,
        }
    }

    /// Kill the PgCat process gracefully
    /// 
    /// Sends SIGTERM first, waits 5 seconds, then SIGKILL if needed
    pub async fn kill(&mut self) -> Result<()> {
        if let Some(ref mut child) = self.child {
            let pid = child.id();
            info!("Stopping PgCat process (PID: {:?})", pid);

            // Try graceful shutdown with SIGTERM
            #[cfg(unix)]
            {
                if let Some(id) = pid {
                    debug!("Sending SIGTERM to PgCat process {}", id);
                    let _ = nix::sys::signal::kill(
                        nix::unistd::Pid::from_raw(id as i32),
                        nix::sys::signal::Signal::SIGTERM,
                    );
                }
            }

            #[cfg(not(unix))]
            {
                // On non-Unix platforms, try to kill directly
                let _ = child.kill().await;
            }

            // Wait up to 5 seconds for graceful shutdown
            let shutdown_timeout = Duration::from_secs(5);
            match timeout(shutdown_timeout, child.wait()).await {
                Ok(Ok(status)) => {
                    info!("PgCat stopped gracefully with status: {}", status);
                }
                Ok(Err(e)) => {
                    warn!("Error waiting for PgCat to stop: {}", e);
                    // Force kill
                    let _ = child.kill().await;
                }
                Err(_) => {
                    warn!("PgCat did not stop gracefully within 5s, forcing kill");
                    // Force kill with SIGKILL
                    #[cfg(unix)]
                    {
                        if let Some(id) = pid {
                            let _ = nix::sys::signal::kill(
                                nix::unistd::Pid::from_raw(id as i32),
                                nix::sys::signal::Signal::SIGKILL,
                            );
                        }
                    }
                    let _ = child.kill().await;
                }
            }
        }

        self.child = None;
        Ok(())
    }

    /// Get the current restart count
    pub fn get_restart_count(&self) -> u64 {
        self.restart_count.load(Ordering::SeqCst)
    }

    /// Increment the restart count
    fn increment_restart_count(&self) {
        self.restart_count.fetch_add(1, Ordering::SeqCst);
    }

    /// Reset the restart count (call after successful health check)
    pub fn reset_restart_count(&self) {
        self.restart_count.store(0, Ordering::SeqCst);
    }

    /// Main restart loop
    /// 
    /// Checks PgCat every 5 seconds and restarts it with exponential backoff
    /// if it crashes. Max 5 attempts then exits.
    /// 
    /// Backoff sequence: 1s, 2s, 4s, 8s, 16s
    pub async fn restart_loop(&mut self, config: Arc<Config>) -> Result<()> {
        info!("Starting PgCat restart loop");

        loop {
            // Check if PgCat is alive
            if !self.is_alive() {
                let current_restarts = self.get_restart_count();
                
                if current_restarts >= config.max_restart_attempts as u64 {
                    error!(
                        "PgCat has crashed {} times, exceeding max restart attempts ({}). Exiting.",
                        current_restarts,
                        config.max_restart_attempts
                    );
                    return Err(anyhow::anyhow!(
                        "Max restart attempts exceeded"
                    ));
                }

                // Calculate exponential backoff: 2^restart_count seconds, max 16s
                let backoff_secs = 2_u64.pow(current_restarts as u32).min(16);
                
                warn!(
                    "PgCat is not running. Restart attempt {}/{} in {}s...",
                    current_restarts + 1,
                    config.max_restart_attempts,
                    backoff_secs
                );

                // Wait with exponential backoff
                sleep(Duration::from_secs(backoff_secs)).await;

                // Spawn new PgCat process
                match Self::spawn(&config).await {
                    Ok(new_runner) => {
                        self.child = new_runner.child;
                        self.increment_restart_count();
                        info!(
                            "PgCat restarted successfully (restart count: {})",
                            self.get_restart_count()
                        );
                    }
                    Err(e) => {
                        error!("Failed to restart PgCat: {}", e);
                        self.increment_restart_count();
                    }
                }
            }

            // Sleep for 5 seconds before next check
            sleep(Duration::from_secs(5)).await;
        }
    }

    /// Get the process ID if running
    pub fn get_pid(&self) -> Option<u32> {
        self.child.as_ref().and_then(|c| c.id())
    }
}

impl Default for PgcatRunner {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_restart_count() {
        let runner = PgcatRunner::new();
        assert_eq!(runner.get_restart_count(), 0);
        
        runner.increment_restart_count();
        assert_eq!(runner.get_restart_count(), 1);
        
        runner.increment_restart_count();
        assert_eq!(runner.get_restart_count(), 2);
        
        runner.reset_restart_count();
        assert_eq!(runner.get_restart_count(), 0);
    }
}
