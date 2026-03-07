//! indus-ai - AI-native vector search and embeddings service
//!
//! This service provides:
//! - Vector storage using pgvector in PostgreSQL
//! - Semantic search capabilities
//! - Support for multiple embedding providers (OpenAI, Cohere, Ollama)
//! - RAG pipeline support

use std::net::SocketAddr;

use axum::{
    routing::{delete, get, post},
    Router,
};
use axum_prometheus::PrometheusMetricLayer;
use tokio::net::TcpListener;
use tower::ServiceBuilder;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing::info;

use indus_ai::{
    config::Config,
    db,
    middleware::auth,
    router,
};

/// Initialize tracing with the specified filter level
fn init_tracing() {
    use tracing_subscriber::{fmt, EnvFilter};

    let filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info"));

    fmt()
        .with_env_filter(filter)
        .with_target(true)
        .with_thread_ids(true)
        .with_file(true)
        .with_line_number(true)
        .init();
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing
    init_tracing();

    // Load configuration from environment
    let config = Config::from_env()?;

    info!(
        "Starting indus-ai service on {}:{}",
        config.host, config.port
    );

    // Initialize database connection pool
    let pool = db::create_pool(&config.database_url).await?;

    // Ensure pgvector extension and schema exist
    db::initialize_schema(&pool).await?;

    info!("Database schema initialized successfully");

    // Create embedding provider based on configuration
    let embedding_provider = config.create_embedding_provider()?;

    info!(
        "Using embedding provider: {:?}",
        config.embedding_provider
    );

    // Build the Axum router with all routes
    let app = build_app(pool, embedding_provider, config.clone());

    // Bind to the specified address
    let addr = SocketAddr::from(([0, 0, 0, 0], config.port));
    let listener = TcpListener::bind(addr).await?;

    info!("Server listening on {}", addr);

    // Start the server
    axum::serve(listener, app)
        .with_graceful_shutdown(async {
            tokio::signal::ctrl_c()
                .await
                .expect("Failed to listen for Ctrl+C");
            info!("Shutting down server...");
        })
        .await?;

    Ok(())
}

/// Build the Axum application router
fn build_app(
    pool: sqlx::PgPool,
    embedding_provider: Box<dyn indus_ai::embeddings::provider::EmbeddingProvider>,
    config: Config,
) -> Router {
    let (prometheus_layer, metric_handle) = PrometheusMetricLayer::pair();
    let metrics_handle = metric_handle.clone();

    // CORS configuration
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // Shared state for the application
    let state = router::AppState {
        pool,
        embedding_provider: embedding_provider.into(),
        config: config.clone(),
    };

    Router::new()
        // Health check endpoint (no auth required)
        .route("/health", get(indus_ai::handlers::health::health_check))
        .route("/metrics", get(move || {
            let handle = metrics_handle.clone();
            async move { handle.render() }
        }))
        // AI API routes (auth required via middleware)
        .route(
            "/ai/collections",
            get(indus_ai::handlers::collections::list_collections)
                .post(indus_ai::handlers::collections::create_collection),
        )
        .route(
            "/ai/collections/:name",
            delete(indus_ai::handlers::collections::delete_collection),
        )
        .route(
            "/ai/collections/:name/documents",
            get(indus_ai::handlers::documents::list_documents)
                .post(indus_ai::handlers::documents::upsert_documents),
        )
        .route(
            "/ai/collections/:name/documents/:id",
            get(indus_ai::handlers::documents::get_document)
                .delete(indus_ai::handlers::documents::delete_document),
        )
        .route(
            "/ai/collections/:name/search",
            post(indus_ai::handlers::search::semantic_search),
        )
        .route(
            "/ai/embed",
            post(indus_ai::handlers::embed::generate_embeddings),
        )
        .layer(
            ServiceBuilder::new()
                .layer(TraceLayer::new_for_http())
                .layer(cors)
                .layer(axum::middleware::from_fn_with_state(
                    state.clone(),
                    auth::validate_jwt,
                ))
                .into_inner(),
        )
        .layer(prometheus_layer)
        .with_state(state)
}
