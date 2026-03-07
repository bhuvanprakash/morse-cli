//! Search Handlers
//!
//! HTTP handlers for semantic search endpoints

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use pgvector::Vector;
use serde::{Deserialize, Serialize};
use sqlx::Row;
use tracing::{error, info};

use crate::db;
use crate::embeddings::EmbeddingProvider;
use crate::models::document::SearchResult;
use crate::router::AppState;

/// Request for semantic search
#[derive(Debug, Deserialize, Serialize)]
pub struct SearchRequest {
    /// The search query
    pub query: String,
    /// Maximum number of results to return (default: 10)
    pub limit: Option<usize>,
    /// Minimum similarity threshold (default: 0.0)
    pub min_similarity: Option<f32>,
    /// Optional metadata filter (JSON)
    pub filter: Option<serde_json::Value>,
}

/// Response for semantic search
#[derive(Debug, Serialize)]
pub struct SearchResponse {
    /// List of search results
    pub results: Vec<SearchResult>,
    /// Total number of results
    pub count: usize,
}

/// Perform semantic search on a collection
///
/// POST /ai/collections/:name/search
pub async fn semantic_search(
    State(state): State<AppState>,
    Path(collection_name): Path<String>,
    Json(payload): Json<SearchRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    info!(
        "Searching collection: {} with query: {}",
        collection_name, payload.query
    );

    // Get collection ID
    let collection_id = match db::get_collection_id(&state.pool, &collection_name).await {
        Ok(Some(id)) => id,
        Ok(None) => {
            return Err((
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({"error": "Collection not found"})),
            ))
        }
        Err(e) => {
            error!("Failed to get collection ID: {}", e);
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "Failed to get collection"})),
            ));
        }
    };

    // Generate embedding for the query
    let embeddings = state
        .embedding_provider
        .embed(&[payload.query.clone()])
        .await
        .map_err(|e| {
            error!("Failed to generate query embedding: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "Failed to generate query embedding"})),
            )
        })?;

    let query_embedding = &embeddings[0].embedding;

    // Set defaults
    let limit = payload.limit.unwrap_or(10);
    let min_similarity = payload.min_similarity.unwrap_or(0.0);
    let filter_json = payload.filter.map(|f| serde_json::to_string(&f).ok()).flatten();

    // Convert embedding to pgvector Vector for the SQL query
    let vector = Vector::from(query_embedding.clone());

    // Use the CTE pattern with pgvector for similarity search
    // Note: We use 1 - (embedding <=> $1::vector) to convert cosine distance to similarity
    let query = r#"
        WITH ranked AS (
            SELECT id, content, metadata, created_at,
                   1 - (embedding <=> $1::vector) AS similarity
            FROM indusbase_ai.documents
            WHERE collection_id = $2
              AND ($3::jsonb IS NULL OR metadata @> $3)
        )
        SELECT * FROM ranked
        WHERE similarity >= $4
        ORDER BY similarity DESC
        LIMIT $5
    "#;

    let rows = sqlx::query(query)
        .bind(vector)
        .bind(collection_id)
        .bind(filter_json.as_deref())
        .bind(min_similarity as f64)
        .bind(limit as i64)
        .fetch_all(&state.pool)
        .await
        .map_err(|e| {
            error!("Failed to execute search query: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "Search failed"})),
            )
        })?;

    let mut results = Vec::new();
    for row in rows {
        let similarity: f64 = row.get("similarity");

        results.push(SearchResult {
            id: row.get("id"),
            content: row.get("content"),
            metadata: row.get("metadata"),
            similarity: similarity as f32,
            created_at: row.get("created_at"),
        });
    }

    info!(
        "Search completed: found {} results in collection: {}",
        results.len(),
        collection_name
    );

    let count = results.len();

    Ok(Json(SearchResponse { results, count }))
}
