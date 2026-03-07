use crate::config::Config;
use crate::rest::handler::{
    create_record, create_row, delete_record, delete_row, delete_rows, get_record, get_row,
    list_records, list_rows, update_record, update_row, update_rows, AppState,
};
use crate::schema::cache::SchemaCache;
use axum::{
    middleware,
    routing::{delete, get, patch, post},
    Router,
};
use sqlx::PgPool;
use std::sync::Arc;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;

/// Build the Axum router with all REST API routes
pub fn build_router(
    pool: PgPool,
    config: Config,
    schema_cache: SchemaCache,
    jwt_public_key: jsonwebtoken::DecodingKey,
) -> Router {
    let pool = Arc::new(pool);
    let config = Arc::new(config);
    let schema_cache = Arc::new(schema_cache);
    let jwt_public_key = Arc::new(jwt_public_key);

    let state = Arc::new(AppState {
        pool: pool.clone(),
        config: config.clone(),
        schema_cache: schema_cache.clone(),
        jwt_public_key: jwt_public_key.clone(),
    });

    // New REST API routes with schema support
    let api_router = Router::new()
        // List and create rows in a table
        .route("/:schema/:table", get(list_rows).post(create_row))
        // Bulk operations
        .route("/:schema/:table", patch(update_rows).delete(delete_rows))
        // Single row operations by ID
        .route("/:schema/:table/:id", get(get_row).patch(update_row).delete(delete_row));

    // Legacy routes without schema (defaults to 'public')
    let legacy_router = Router::new()
        .route("/rest/:table", get(list_records).post(create_record))
        .route("/rest/:table/:id", get(get_record).patch(update_record).delete(delete_record));

    // Build the main router
    Router::new()
        .nest("/api", api_router)
        .nest("/", legacy_router)
        .route("/health", get(health_check))
        .route("/ready", get(ready_check))
        .layer(TraceLayer::new_for_http())
        .layer(CorsLayer::permissive())
        .with_state(state)
}

/// Simple router without schema cache (for backwards compatibility)
pub fn build_simple_router(pool: PgPool, config: Config) -> Router {
    let pool = Arc::new(pool);
    let config = Arc::new(config);

    // Create a temporary schema cache
    let schema_cache = Arc::new(SchemaCache::new(
        (*pool).clone(),
        config.allowed_schemas.clone(),
        config.schema_cache_refresh_secs,
    ));

    // Create a temporary decoding key
    let jwt_public_key = Arc::new(jsonwebtoken::DecodingKey::from_secret(b"secret"));

    let state = Arc::new(AppState {
        pool: pool.clone(),
        config: config.clone(),
        schema_cache: schema_cache.clone(),
        jwt_public_key: jwt_public_key.clone(),
    });

    Router::new()
        .route("/rest/:table", get(list_records).post(create_record))
        .route("/rest/:table/:id", get(get_record).patch(update_record).delete(delete_record))
        .route("/health", get(health_check))
        .layer(TraceLayer::new_for_http())
        .layer(CorsLayer::permissive())
        .with_state(state)
}

/// Health check endpoint
async fn health_check() -> &'static str {
    "OK"
}

/// Readiness check endpoint
async fn ready_check() -> &'static str {
    "READY"
}

#[cfg(test)]
mod tests {
    use super::*;

    // Note: Router tests would require a full integration test setup
    // with a running database and HTTP client
}