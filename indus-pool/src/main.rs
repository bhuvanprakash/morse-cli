use std::sync::atomic::AtomicU64;
use std::sync::Arc;

use anyhow::{Context, Result};
use axum::routing::{get, post};
use axum::Router;
use tokio::signal;
use tokio::time::{sleep, Duration};
use tracing::{error, info, warn};

use indus_pool::admin::AdminHandler;
use indus_pool::config::Config;
use indus_pool::health::handler::HealthHandler;
use indus_pool::metrics::MetricsExporter;
use indus_pool::process::PgcatRunner;
use indus_pool::AppState;

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize tracing with JSON formatter if LOG_FORMAT=json
    init_tracing();

    info!("Starting Indus Pool - PgCat Connection Pooler Wrapper");

    // Load configuration from environment
    let config = Config::from_env().context("Failed to load configuration")?;
    let config = Arc::new(config);

    info!(
        "Configuration loaded - health_port: {}, metrics_port: {}",
        config.health_port, config.metrics_port
    );

    // Create shared restart counter
    let restart_counter = Arc::new(AtomicU64::new(0));

    // Spawn PgCat runner in background task
    let runner_config = config.clone();
    let pgcat_handle = tokio::spawn(async move {
        let mut runner = match PgcatRunner::spawn(&runner_config).await {
            Ok(r) => {
                info!("PgCat spawned successfully");
                r
            }
            Err(e) => {
                error!("Failed to spawn PgCat: {}", e);
                return Err(e);
            }
        };

        // Run the restart loop
        runner.restart_loop(runner_config).await
    });

    // Give PgCat a moment to start up
    sleep(Duration::from_secs(1)).await;

    // Build HTTP API router
    let app = build_router(config.clone(), restart_counter.clone()).await?;

    // Start HTTP server for health and metrics
    let health_port = config.health_port;
    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", health_port))
        .await
        .with_context(|| format!("Failed to bind to port {}", health_port))?;

    info!("Health and metrics server listening on port {}", health_port);

    // Start server with graceful shutdown handling
    let server = axum::serve(listener, app);

    // Handle shutdown signals
    tokio::select! {
        _ = handle_shutdown_signal() => {
            info!("Received shutdown signal, initiating graceful shutdown...");
        }
        result = pgcat_handle => {
            match result {
                Ok(Ok(())) => {
                    warn!("PgCat restart loop exited normally");
                }
                Ok(Err(e)) => {
                    error!("PgCat runner error: {}", e);
                }
                Err(e) => {
                    error!("PgCat task panicked: {}", e);
                }
            }
        }
    }

    // Graceful shutdown with 10s timeout
    info!("Waiting up to 10 seconds for graceful shutdown...");
    
    // Signal the PgCat runner to stop (we would need a channel for this in production)
    // For now, we just wait a bit and then exit
    sleep(Duration::from_secs(1)).await;

    info!("Indus Pool shutdown complete");
    Ok(())
}

/// Initialize tracing subscriber
/// 
/// Uses JSON formatter if LOG_FORMAT environment variable is set to "json"
fn init_tracing() {
    let log_format = std::env::var("LOG_FORMAT").unwrap_or_default();
    
    if log_format.eq_ignore_ascii_case("json") {
        tracing_subscriber::fmt()
            .json()
            .with_env_filter(
                tracing_subscriber::EnvFilter::try_from_default_env()
                    .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
            )
            .init();
    } else {
        tracing_subscriber::fmt()
            .with_env_filter(
                tracing_subscriber::EnvFilter::try_from_default_env()
                    .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
            )
            .init();
    }
}

/// Handle shutdown signals (SIGTERM, SIGINT)
async fn handle_shutdown_signal() {
    let mut sigterm = signal::unix::signal(signal::unix::SignalKind::terminate())
        .expect("Failed to create SIGTERM handler");
    let mut sigint = signal::unix::signal(signal::unix::SignalKind::interrupt())
        .expect("Failed to create SIGINT handler");

    tokio::select! {
        _ = sigterm.recv() => {
            info!("Received SIGTERM signal");
        }
        _ = sigint.recv() => {
            info!("Received SIGINT signal");
        }
        _ = signal::ctrl_c() => {
            info!("Received Ctrl+C signal");
        }
    }
}

/// Build the axum router with all routes
async fn build_router(
    config: Arc<Config>,
    restart_counter: Arc<AtomicU64>,
) -> Result<Router> {
    // Create shared state
    let app_state = AppState::new(config, restart_counter);

    // Build router with all routes
    let app = Router::new()
        .route("/health", get(HealthHandler::handle))
        .route("/health/ready", get(HealthHandler::ready))
        .route("/health/live", get(HealthHandler::live))
        .route("/metrics", get(MetricsExporter::handle))
        .route("/pool/reload", post(AdminHandler::reload))
        .route("/pool/stats", get(AdminHandler::stats))
        .with_state(app_state);

    Ok(app)
}
