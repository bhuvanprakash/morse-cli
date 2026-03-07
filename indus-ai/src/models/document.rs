//! Document Model
//!
//! Data models for documents

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Document model representing a document with embedding
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Document {
    /// Unique identifier
    pub id: Uuid,
    /// Collection ID this document belongs to
    pub collection_id: Uuid,
    /// Document content
    pub content: String,
    /// Optional metadata (JSON)
    pub metadata: serde_json::Value,
    /// Creation timestamp
    pub created_at: DateTime<Utc>,
    /// Last update timestamp
    pub updated_at: DateTime<Utc>,
}

/// Request to upsert a document
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct UpsertDocumentRequest {
    /// Document ID (optional, will generate if not provided)
    pub id: Option<Uuid>,
    /// Document content
    pub content: String,
    /// Optional metadata
    pub metadata: Option<serde_json::Value>,
}

impl UpsertDocumentRequest {
    /// Get the document ID or generate a new one
    pub fn get_id(&self) -> Uuid {
        self.id.unwrap_or_else(Uuid::new_v4)
    }
}

/// Response for upserted document
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpsertDocumentResponse {
    /// Document ID
    pub id: Uuid,
    /// Document content
    pub content: String,
    /// Document metadata
    pub metadata: serde_json::Value,
    /// Creation timestamp
    pub created_at: DateTime<Utc>,
}

/// Search result model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    /// Document ID
    pub id: Uuid,
    /// Document content
    pub content: String,
    /// Document metadata
    pub metadata: serde_json::Value,
    /// Similarity score (0-1)
    pub similarity: f32,
    /// Creation timestamp
    pub created_at: DateTime<Utc>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_upsert_document_request() {
        let req = UpsertDocumentRequest {
            id: None,
            content: "Test content".to_string(),
            metadata: Some(serde_json::json!({"key": "value"})),
        };
        
        let id = req.get_id();
        assert!(!id.is_nil());
        assert_eq!(req.content, "Test content");
    }
}
