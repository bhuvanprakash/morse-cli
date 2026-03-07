//! Embed Handler
//!
//! HTTP handler for generating embeddings without storage

use axum::{
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use tracing::{error, info};

use crate::embeddings::EmbeddingProvider;
use crate::router::AppState;

/// Request to generate embeddings
#[derive(Debug, Deserialize, Serialize)]
pub struct EmbedRequest {
    /// List of texts to embed
    pub texts: Vec<String>,
}

/// Response for embedding generation
#[derive(Debug, Serialize)]
pub struct EmbedResponse {
    /// Generated embeddings
    pub embeddings: Vec<Vec<f32>>,
    /// Model used
    pub model: String,
    /// Number of dimensions
    pub dimensions: usize,
}

/// Generate embeddings for texts
///
/// POST /ai/embed
pub async fn generate_embeddings(
    State(state): State<AppState>,
    Json(payload): Json<EmbedRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    info!("Generating embeddings for {} texts", payload.texts.len());

    if payload.texts.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error": "No texts provided"})),
        ));
    }

    if payload.texts.len() > 1000 {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error": "Maximum 1000 texts allowed per request"})),
        ));
    }

    // Generate embeddings
    let results = state
        .embedding_provider
        .embed(&payload.texts)
        .await
        .map_err(|e| {
            error!("Failed to generate embeddings: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "Failed to generate embeddings"})),
            )
        })?;

    // Extract just the embedding vectors
    let embeddings: Vec<Vec<f32>> = results.iter().map(|r| r.embedding.clone()).collect();

    let model = state.embedding_provider.model().to_string();
    let dimensions = state.embedding_provider.dimensions();

    info!(
        "Successfully generated {} embeddings with {} dimensions",
        embeddings.len(),
        dimensions
    );

    Ok(Json(EmbedResponse {
        embeddings,
        model,
        dimensions,
    }))
}
