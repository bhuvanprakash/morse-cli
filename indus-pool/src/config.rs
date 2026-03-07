use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};

/// Indus Pool configuration loaded from environment variables
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Config {
    /// Path to PgCat binary
    pub pgcat_binary_path: String,
    /// Path to PgCat configuration file
    pub pgcat_config_path: String,
    /// Port for health endpoint
    pub health_port: u16,
    /// Port for metrics endpoint (also PgCat prometheus port)
    pub metrics_port: u16,
    /// Internal secret for admin endpoints
    pub internal_secret: String,
    /// Database host for PgCat to connect to
    pub db_host: String,
    /// Database port for PgCat to connect to
    pub db_port: u16,
    /// Database name
    pub db_name: String,
    /// Database user
    pub db_user: String,
    /// Database password
    pub db_password: String,
    /// Maximum number of restart attempts before giving up
    pub max_restart_attempts: u8,
}

impl Config {
    /// Load configuration from environment variables
    pub fn from_env() -> Result<Self> {
        let config = Self {
            pgcat_binary_path: std::env::var("PGCAT_BINARY_PATH")
                .unwrap_or_else(|_| "/usr/local/bin/pgcat".to_string()),
            pgcat_config_path: std::env::var("PGCAT_CONFIG_PATH")
                .unwrap_or_else(|_| "./config/pgcat.toml".to_string()),
            health_port: std::env::var("HEALTH_PORT")
                .ok()
                .and_then(|p| p.parse().ok())
                .unwrap_or(8080),
            metrics_port: std::env::var("METRICS_PORT")
                .ok()
                .and_then(|p| p.parse().ok())
                .unwrap_or(9090),
            internal_secret: std::env::var("INTERNAL_SECRET")
                .context("INTERNAL_SECRET environment variable is required")?,
            db_host: std::env::var("DB_HOST")
                .context("DB_HOST environment variable is required")?,
            db_port: std::env::var("DB_PORT")
                .ok()
                .and_then(|p| p.parse().ok())
                .unwrap_or(5432),
            db_name: std::env::var("DB_NAME")
                .context("DB_NAME environment variable is required")?,
            db_user: std::env::var("DB_USER")
                .context("DB_USER environment variable is required")?,
            db_password: std::env::var("DB_PASSWORD")
                .context("DB_PASSWORD environment variable is required")?,
            max_restart_attempts: std::env::var("MAX_RESTART_ATTEMPTS")
                .ok()
                .and_then(|p| p.parse().ok())
                .unwrap_or(5),
        };

        config.validate()?;
        Ok(config)
    }

    /// Validate the configuration
    pub fn validate(&self) -> Result<()> {
        // Validate required fields are not empty
        if self.internal_secret.is_empty() {
            return Err(anyhow::anyhow!("INTERNAL_SECRET cannot be empty"));
        }
        if self.db_host.is_empty() {
            return Err(anyhow::anyhow!("DB_HOST cannot be empty"));
        }
        if self.db_name.is_empty() {
            return Err(anyhow::anyhow!("DB_NAME cannot be empty"));
        }
        if self.db_user.is_empty() {
            return Err(anyhow::anyhow!("DB_USER cannot be empty"));
        }
        if self.db_password.is_empty() {
            return Err(anyhow::anyhow!("DB_PASSWORD cannot be empty"));
        }

        // Validate port ranges
        if self.health_port == 0 {
            return Err(anyhow::anyhow!("HEALTH_PORT cannot be 0"));
        }
        if self.metrics_port == 0 {
            return Err(anyhow::anyhow!("METRICS_PORT cannot be 0"));
        }
        if self.db_port == 0 {
            return Err(anyhow::anyhow!("DB_PORT cannot be 0"));
        }

        // Validate max_restart_attempts
        if self.max_restart_attempts == 0 {
            return Err(anyhow::anyhow!("MAX_RESTART_ATTEMPTS must be at least 1"));
        }

        Ok(())
    }

    /// Get the PgCat pool port (PostgreSQL protocol port)
    pub fn pgcat_pool_port(&self) -> u16 {
        // PgCat listens on 5432 by default for PostgreSQL protocol
        5432
    }
}

impl Default for Config {
    fn default() -> Self {
        Self {
            pgcat_binary_path: "/usr/local/bin/pgcat".to_string(),
            pgcat_config_path: "./config/pgcat.toml".to_string(),
            health_port: 8080,
            metrics_port: 9090,
            internal_secret: String::new(),
            db_host: "localhost".to_string(),
            db_port: 5432,
            db_name: "indusbase".to_string(),
            db_user: String::new(),
            db_password: String::new(),
            max_restart_attempts: 5,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = Config::default();
        assert_eq!(config.health_port, 8080);
        assert_eq!(config.metrics_port, 9090);
        assert_eq!(config.db_port, 5432);
        assert_eq!(config.max_restart_attempts, 5);
    }

    #[test]
    fn test_config_validation_empty_secret() {
        let config = Config::default();
        let result = config.validate();
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("INTERNAL_SECRET"));
    }

    #[test]
    fn test_config_validation_valid() {
        let config = Config {
            internal_secret: "test-secret".to_string(),
            db_host: "localhost".to_string(),
            db_name: "test".to_string(),
            db_user: "user".to_string(),
            db_password: "pass".to_string(),
            ..Default::default()
        };
        assert!(config.validate().is_ok());
    }

    #[test]
    fn test_config_validation_zero_port() {
        let config = Config {
            internal_secret: "test-secret".to_string(),
            db_host: "localhost".to_string(),
            db_name: "test".to_string(),
            db_user: "user".to_string(),
            db_password: "pass".to_string(),
            health_port: 0,
            ..Default::default()
        };
        let result = config.validate();
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("HEALTH_PORT"));
    }
}
