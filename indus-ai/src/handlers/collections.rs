//! Collection Handlers
//!
//! HTTP handlers for collection management endpoints

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use tracing::{error, info};

use crate::db;
use crate::models::collection::Collection;
use crate::router::AppState;

/// Request to create a new collection
#[derive(Debug, Deserialize, Serialize)]
pub struct CreateCollectionRequest {
    /// Collection name (unique identifier)
    pub name: String,
    /// Optional description
    pub description: Option<String>,
}

/// Response for collection operations
#[derive(Debug, Serialize)]
pub struct CollectionResponse {
    /// The created/found collection
    pub collection: Collection,
}

/// List all collections
///
/// GET /ai/collections
pub async fn list_collections(
    State(state): State<AppState>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    info!("Listing all collections");

    let collections = sqlx::query_as::<_, Collection>(
        "SELECT id, name, description, created_at, updated_at FROM indusbase_ai.collections ORDER BY created_at DESC"
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        error!("Failed to list collections: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": "Failed to list collections"})),
        )
    })?;

    Ok(Json(serde_json::json!({ "collections": collections })))
}

/// Create a new collection
///
/// POST /ai/collections
pub async fn create_collection(
    State(state): State<AppState>,
    Json(payload): Json<CreateCollectionRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    info!("Creating collection: {}", payload.name);

    // Check if collection already exists
    if db::collection_exists(&state.pool, &payload.name)
        .await
        .map_err(|e| {
            error!("Failed to check collection existence: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "Failed to create collection"})),
            )
        })?
    {
        return Err((
            StatusCode::CONFLICT,
            Json(serde_json::json!({"error": "Collection already exists"})),
        ));
    }

    // Insert the new collection
    let result = sqlx::query(
        "INSERT INTO indusbase_ai.collections (name, description) VALUES ($1, $2) RETURNING id, name, description, created_at, updated_at"
    )
    .bind(&payload.name)
    .bind(&payload.description)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| {
        error!("Failed to create collection: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": "Failed to create collection"})),
        )
    })?;

    let collection = Collection {
        id: result.get("id"),
        name: result.get("name"),
        description: result.get("description"),
        created_at: result.get("created_at"),
        updated_at: result.get("updated_at"),
    };

    info!("Collection created: {}", collection.name);

    Ok((
        StatusCode::CREATED,
        Json(serde_json::json!({ "collection": collection })),
    ))
}

/// Delete a collection
///
/// DELETE /ai/collections/:name
pub async fn delete_collection(
    State(state): State<AppState>,
    Path(name): Path<String>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    info!("Deleting collection: {}", name);

    // Check if collection exists
    let exists = db::collection_exists(&state.pool, &name)
        .await
        .map_err(|e| {
            error!("Failed to check collection existence: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "Failed to delete collection"})),
            )
        })?;

    if !exists {
        return Err((
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({"error": "Collection not found"})),
        ));
    }

    // Delete the collection (documents will be cascade deleted)
    sqlx::query("DELETE FROM indusbase_ai.collections WHERE name = $1")
        .bind(&name)
        .execute(&state.pool)
        .await
        .map_err(|e| {
            error!("Failed to delete collection: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "Failed to delete collection"})),
            )
        })?;

    info!("Collection deleted: {}", name);

    Ok(Json(serde_json::json!({ "message": "Collection deleted successfully" })))
}
