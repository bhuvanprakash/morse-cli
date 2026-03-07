//! Indus Query Service
//!
//! A dynamic REST/GraphQL API generator for PostgreSQL with RLS support.

pub mod auth;
pub mod config;
pub mod db;
pub mod errors;
pub mod graphql;
pub mod middleware;
pub mod rest;
pub mod schema;

// Re-export commonly used types
pub use config::Config;
pub use errors::AppError;

use crate::rest::handler::AppState;
use axum::Router;
use sqlx::PgPool;
use std::sync::Arc;

/// Create a new application router with all routes
pub async fn create_app(
    pool: PgPool,
    config: Config,
) -> anyhow::Result<Router> {
    use crate::auth::jwt::load_public_key;
    use crate::rest::router::build_router;
    use crate::schema::cache::SchemaCache;

    // Load JWT public key
    let jwt_public_key = load_public_key(&config.jwt_public_key_path)
        .unwrap_or_else(|_| {
            jsonwebtoken::DecodingKey::from_secret(b"default-secret")
        });

    // Build schema cache
    let schema_cache = SchemaCache::new(
        pool.clone(),
        config.allowed_schemas.clone(),
        config.schema_cache_refresh_secs,
    );

    // Initial refresh
    let _ = schema_cache.refresh().await;

    // Start refresh loop
    schema_cache.start_refresh_loop();

    Ok(build_router(pool, config, schema_cache, jwt_public_key))
}

/// Version of the crate
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

/// Name of the crate
pub const NAME: &str = env!("CARGO_PKG_NAME");

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_version() {
        assert!(!VERSION.is_empty());
        assert_eq!(NAME, "indus-query");
    }
}