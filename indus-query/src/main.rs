mod graphql;

use axum::{routing::get, Extension};
use axum_prometheus::PrometheusMetricLayer;
use indus_query::auth::jwt::load_public_key;
use indus_query::config::Config;
use indus_query::db::pool::create_pool;
use indus_query::rest::router::build_router;
use indus_query::schema::cache::SchemaCache;
use std::net::SocketAddr;
use tokio::signal;
use tracing::{info, warn};
use graphql::handler::{graphql_handler, graphql_playground, GraphQLState};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing with JSON formatter
    let subscriber = tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .json()
        .with_current_span(false)
        .flatten_event(true)
        .init();

    info!("Starting indus-query service...");

    // Load configuration
    let config = Config::from_env()?;
    info!(
        port = config.server_port,
        database_url = %mask_password(&config.database_url),
        "Configuration loaded successfully"
    );

    // Create database pool
    let pool = create_pool(&config.database_url).await?;
    info!("Database pool created");

    // Test database connection
    match sqlx::query("SELECT 1").fetch_one(&pool).await {
        Ok(_) => info!("Database connection verified"),
        Err(e) => {
            warn!("Database connection test failed: {}", e);
        }
    }

    // Load JWT public key
    let jwt_public_key = match load_public_key(&config.jwt_public_key_path) {
        Ok(key) => {
            info!("JWT public key loaded from: {}", config.jwt_public_key_path);
            key
        }
        Err(e) => {
            warn!("Failed to load JWT public key: {}. Using default.", e);
            // Use a default secret for development
            jsonwebtoken::DecodingKey::from_secret(b"default-secret-for-development-only")
        }
    };

    // Build schema cache with refresh loop
    let schema_cache = SchemaCache::new(
        pool.clone(),
        config.allowed_schemas.clone(),
        config.schema_cache_refresh_secs,
    );

    // Initial schema refresh
    if let Err(e) = schema_cache.refresh().await {
        warn!("Initial schema refresh failed: {}", e);
    } else {
        info!("Schema cache initialized");
    }

    // Start background refresh loop
    schema_cache.start_refresh_loop();
    info!(
        refresh_secs = config.schema_cache_refresh_secs,
        "Schema cache refresh loop started"
    );

    // Build the Axum router
    let (prometheus_layer, metric_handle) = PrometheusMetricLayer::pair();
    let metrics_handle = metric_handle.clone();

    let app = build_router(pool.clone(), config.clone(), schema_cache, jwt_public_key)
        .route("/graphql", get(graphql_playground).post(graphql_handler))
        .route("/metrics", get(move || {
            let handle = metrics_handle.clone();
            async move { handle.render() }
        }))
        .layer(prometheus_layer)
        .layer(Extension(GraphQLState::new(pool.clone())));

    // Start the server
    let addr = SocketAddr::from(([0, 0, 0, 0], config.server_port));
    info!("Server listening on http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    
    // Start server with graceful shutdown
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    info!("Server shutdown complete");
    Ok(())
}

/// Handle shutdown signals (SIGTERM, SIGINT)
async fn shutdown_signal() {
    let ctrl_c = async {
        signal::ctrl_c()
            .await
            .expect("Failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        signal::unix::signal(signal::unix::SignalKind::terminate())
            .expect("Failed to install signal handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => info!("Received Ctrl+C, shutting down..."),
        _ = terminate => info!("Received SIGTERM, shutting down..."),
    }
}

/// Mask password in database URL for logging
fn mask_password(url: &str) -> String {
    // Simple regex-like replacement to mask password
    if let Some(pos) = url.find("@") {
        if let Some(colon_pos) = url[..pos].rfind(":") {
            if let Some(slash_pos) = url[..colon_pos].find("://") {
                let prefix = &url[..colon_pos + 1];
                let suffix = &url[pos..];
                return format!("{}****{}", prefix, suffix);
            }
        }
    }
    url.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mask_password() {
        let url = "postgres://user:password@localhost:5432/db";
        let masked = mask_password(url);
        assert!(masked.contains("****"));
        assert!(!masked.contains("password"));
    }
}
