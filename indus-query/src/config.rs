use anyhow::{Context, Result};
use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
pub struct Config {
    pub database_url: String,
    #[serde(default = "default_server_port")]
    pub server_port: u16,
    pub jwt_public_key_path: String,
    pub internal_secret: String,
    #[serde(default = "default_schema_cache_refresh_secs")]
    pub schema_cache_refresh_secs: u64,
    #[serde(default = "default_max_query_rows")]
    pub max_query_rows: usize,
    #[serde(default = "default_allowed_schemas")]
    pub allowed_schemas: Vec<String>,
    // Backwards compatibility
    #[serde(default)]
    pub port: u16,
    #[serde(default)]
    pub host: String,
    #[serde(default)]
    pub jwt_secret: String,
    #[serde(default)]
    pub jwt_issuer: String,
    #[serde(default)]
    pub schema_cache_ttl: u64,
}

fn default_server_port() -> u16 {
    8002
}

fn default_schema_cache_refresh_secs() -> u64 {
    30
}

fn default_max_query_rows() -> usize {
    1000
}

fn default_allowed_schemas() -> Vec<String> {
    vec!["public".to_string()]
}

impl Config {
    pub fn from_env() -> Result<Self> {
        dotenvy::dotenv().ok();

        let database_url = std::env::var("DATABASE_URL")
            .unwrap_or_else(|_| "postgres://postgres:postgres@localhost:5432/indus".to_string());

        let server_port = std::env::var("SERVER_PORT")
            .ok()
            .and_then(|s| s.parse().ok())
            .or_else(|| std::env::var("PORT").ok().and_then(|s| s.parse().ok()))
            .unwrap_or_else(default_server_port);

        let jwt_public_key_path = std::env::var("JWT_PUBLIC_KEY_PATH")
            .unwrap_or_else(|_| "/etc/indus/jwt.pub".to_string());

        let internal_secret = std::env::var("INTERNAL_SECRET")
            .unwrap_or_else(|_| "internal-secret".to_string());

        let schema_cache_refresh_secs = std::env::var("SCHEMA_CACHE_REFRESH_SECS")
            .ok()
            .and_then(|s| s.parse().ok())
            .or_else(|| std::env::var("SCHEMA_CACHE_TTL").ok().and_then(|s| s.parse().ok()))
            .unwrap_or_else(default_schema_cache_refresh_secs);

        let max_query_rows = std::env::var("MAX_QUERY_ROWS")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or_else(default_max_query_rows);

        let allowed_schemas = std::env::var("ALLOWED_SCHEMAS")
            .ok()
            .map(|s| s.split(',').map(|s| s.trim().to_string()).collect())
            .unwrap_or_else(default_allowed_schemas);

        // Backwards compatibility fields
        let port = server_port;
        let host = std::env::var("HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
        let jwt_secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| "secret".to_string());
        let jwt_issuer = std::env::var("JWT_ISSUER").unwrap_or_else(|_| "indus-auth".to_string());
        let schema_cache_ttl = schema_cache_refresh_secs;

        let config = Config {
            database_url,
            server_port,
            jwt_public_key_path,
            internal_secret,
            schema_cache_refresh_secs,
            max_query_rows,
            allowed_schemas,
            port,
            host,
            jwt_secret,
            jwt_issuer,
            schema_cache_ttl,
        };

        config.validate()?;
        Ok(config)
    }

    pub fn validate(&self) -> Result<()> {
        if self.database_url.is_empty() {
            anyhow::bail!("DATABASE_URL cannot be empty");
        }

        if self.jwt_public_key_path.is_empty() {
            anyhow::bail!("JWT_PUBLIC_KEY_PATH cannot be empty");
        }

        if self.internal_secret.is_empty() {
            anyhow::bail!("INTERNAL_SECRET cannot be empty");
        }

        if self.allowed_schemas.is_empty() {
            anyhow::bail!("ALLOWED_SCHEMAS cannot be empty");
        }

        // Validate that schema names are safe (alphanumeric and underscore only)
        for schema in &self.allowed_schemas {
            if !schema.chars().all(|c| c.is_alphanumeric() || c == '_') {
                anyhow::bail!("Invalid schema name: {}. Only alphanumeric and underscore allowed.", schema);
            }
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = Config {
            database_url: "postgres://localhost".to_string(),
            server_port: default_server_port(),
            jwt_public_key_path: "/etc/jwt.pub".to_string(),
            internal_secret: "secret".to_string(),
            schema_cache_refresh_secs: default_schema_cache_refresh_secs(),
            max_query_rows: default_max_query_rows(),
            allowed_schemas: default_allowed_schemas(),
            port: default_server_port(),
            host: "0.0.0.0".to_string(),
            jwt_secret: "secret".to_string(),
            jwt_issuer: "indus-auth".to_string(),
            schema_cache_ttl: default_schema_cache_refresh_secs(),
        };

        assert_eq!(config.server_port, 8002);
        assert_eq!(config.schema_cache_refresh_secs, 30);
        assert_eq!(config.max_query_rows, 1000);
        assert_eq!(config.allowed_schemas, vec!["public"]);
    }

    #[test]
    fn test_validate_empty_database_url() {
        let config = Config {
            database_url: "".to_string(),
            server_port: 8002,
            jwt_public_key_path: "/etc/jwt.pub".to_string(),
            internal_secret: "secret".to_string(),
            schema_cache_refresh_secs: 30,
            max_query_rows: 1000,
            allowed_schemas: vec!["public".to_string()],
            port: 8002,
            host: "0.0.0.0".to_string(),
            jwt_secret: "secret".to_string(),
            jwt_issuer: "indus-auth".to_string(),
            schema_cache_ttl: 30,
        };

        assert!(config.validate().is_err());
    }

    #[test]
    fn test_validate_invalid_schema_name() {
        let config = Config {
            database_url: "postgres://localhost".to_string(),
            server_port: 8002,
            jwt_public_key_path: "/etc/jwt.pub".to_string(),
            internal_secret: "secret".to_string(),
            schema_cache_refresh_secs: 30,
            max_query_rows: 1000,
            allowed_schemas: vec!["public; DROP TABLE users;".to_string()],
            port: 8002,
            host: "0.0.0.0".to_string(),
            jwt_secret: "secret".to_string(),
            jwt_issuer: "indus-auth".to_string(),
            schema_cache_ttl: 30,
        };

        assert!(config.validate().is_err());
    }
}
