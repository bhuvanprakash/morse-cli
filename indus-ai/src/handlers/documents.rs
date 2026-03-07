//! Document Handlers
//!
//! HTTP handlers for document management endpoints

use axum::{
    extract::{Path, Query, State},
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
use crate::models::document::{Document, UpsertDocumentRequest, UpsertDocumentResponse};
use crate::router::AppState;

/// Request to upsert documents
#[derive(Debug, Deserialize, Serialize)]
pub struct UpsertDocumentsRequest {
    /// List of documents to upsert
    pub documents: Vec<UpsertDocumentRequest>,
}

/// Response for document upsert operation
#[derive(Debug, Serialize)]
pub struct UpsertDocumentsResponse {
    /// List of upserted documents
    pub documents: Vec<UpsertDocumentResponse>,
    /// Number of documents processed
    pub count: usize,
}

/// Query params for listing documents.
#[derive(Debug, Deserialize, Serialize)]
pub struct ListDocumentsQuery {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

/// Response for document listing.
#[derive(Debug, Serialize)]
pub struct ListDocumentsResponse {
    pub documents: Vec<Document>,
    pub count: usize,
}

/// List documents in a collection.
///
/// GET /ai/collections/:name/documents
pub async fn list_documents(
    State(state): State<AppState>,
    Path(collection_name): Path<String>,
    Query(query): Query<ListDocumentsQuery>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    info!("Listing documents in collection: {}", collection_name);

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

    let limit = query.limit.unwrap_or(100).clamp(1, 500);
    let offset = query.offset.unwrap_or(0).max(0);

    let rows = sqlx::query(
        r#"
        SELECT id, collection_id, content, metadata, created_at, updated_at
        FROM indusbase_ai.documents
        WHERE collection_id = $1
        ORDER BY updated_at DESC
        LIMIT $2
        OFFSET $3
        "#,
    )
    .bind(collection_id)
    .bind(limit)
    .bind(offset)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        error!("Failed to list documents: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": "Failed to list documents"})),
        )
    })?;

    let mut documents = Vec::with_capacity(rows.len());
    for row in rows {
        documents.push(Document {
            id: row.get("id"),
            collection_id: row.get("collection_id"),
            content: row.get("content"),
            metadata: row.get("metadata"),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
        });
    }

    let count = documents.len();
    Ok(Json(ListDocumentsResponse { documents, count }))
}

/// Upsert documents into a collection
///
/// POST /ai/collections/:name/documents
pub async fn upsert_documents(
    State(state): State<AppState>,
    Path(collection_name): Path<String>,
    Json(payload): Json<UpsertDocumentsRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    info!(
        "Upserting {} documents into collection: {}",
        payload.documents.len(),
        collection_name
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

    // Extract texts for embedding
    let texts: Vec<String> = payload.documents.iter().map(|d| d.content.clone()).collect();

    // Generate embeddings
    let embeddings = state
        .embedding_provider
        .embed(&texts)
        .await
        .map_err(|e| {
            error!("Failed to generate embeddings: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "Failed to generate embeddings"})),
            )
        })?;

    // Upsert each document
    let mut results = Vec::new();
    for (doc, embedding) in payload.documents.iter().zip(embeddings.iter()) {
        // Truncate embedding to 1536 dimensions if needed (vector(1536) max)
        let embedding_vec: Vec<f32> = if embedding.embedding.len() > 1536 {
            embedding.embedding[..1536].to_vec()
        } else {
            embedding.embedding.clone()
        };

        // Convert to pgvector Vector
        let vector = Vector::from(embedding_vec);

        // Upsert the document (insert or update if id exists)
        let result = sqlx::query(
            r#"
            INSERT INTO indusbase_ai.documents (id, collection_id, content, metadata, embedding)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (id) DO UPDATE SET
                content = EXCLUDED.content,
                metadata = EXCLUDED.metadata,
                embedding = EXCLUDED.embedding,
                updated_at = NOW()
            RETURNING id, collection_id, content, metadata, created_at, updated_at
            "#,
        )
        .bind(&doc.id)
        .bind(collection_id)
        .bind(&doc.content)
        .bind(serde_json::to_value(&doc.metadata).unwrap_or(serde_json::json!({})))
        .bind(vector)
        .fetch_one(&state.pool)
        .await;

        match result {
            Ok(row) => {
                results.push(UpsertDocumentResponse {
                    id: row.get("id"),
                    content: row.get("content"),
                    metadata: row.get("metadata"),
                    created_at: row.get("created_at"),
                });
            }
            Err(e) => {
                error!("Failed to upsert document {:?}: {}", doc.id, e);
                // Continue with other documents
            }
        }
    }

    info!(
        "Successfully upserted {} documents into collection: {}",
        results.len(),
        collection_name
    );

    let count = results.len();
    Ok(Json(UpsertDocumentsResponse {
        documents: results,
        count,
    }))
}

/// Get a single document
///
/// GET /ai/collections/:name/documents/:id
pub async fn get_document(
    State(state): State<AppState>,
    Path((collection_name, doc_id)): Path<(String, String)>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    info!("Getting document: {} from collection: {}", doc_id, collection_name);

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

    // Get the document
    let result = sqlx::query(
        "SELECT id, collection_id, content, metadata, created_at, updated_at FROM indusbase_ai.documents WHERE id = $1 AND collection_id = $2"
    )
    .bind(&doc_id)
    .bind(collection_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        error!("Failed to get document: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": "Failed to get document"})),
        )
    })?;

    match result {
        Some(row) => {
            let document = Document {
                id: row.get("id"),
                collection_id: row.get("collection_id"),
                content: row.get("content"),
                metadata: row.get("metadata"),
                created_at: row.get("created_at"),
                updated_at: row.get("updated_at"),
            };
            Ok(Json(serde_json::json!({ "document": document })))
        }
        None => Err((
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({"error": "Document not found"})),
        )),
    }
}

/// Delete a document
///
/// DELETE /ai/collections/:name/documents/:id
pub async fn delete_document(
    State(state): State<AppState>,
    Path((collection_name, doc_id)): Path<(String, String)>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    info!("Deleting document: {} from collection: {}", doc_id, collection_name);

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

    // Delete the document
    let result = sqlx::query("DELETE FROM indusbase_ai.documents WHERE id = $1 AND collection_id = $2")
        .bind(&doc_id)
        .bind(collection_id)
        .execute(&state.pool)
        .await
        .map_err(|e| {
            error!("Failed to delete document: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "Failed to delete document"})),
            )
        })?;

    if result.rows_affected() == 0 {
        return Err((
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({"error": "Document not found"})),
        ));
    }

    info!("Document deleted: {}", doc_id);

    Ok(Json(serde_json::json!({ "message": "Document deleted successfully" })))
}
