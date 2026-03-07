//! Collection Model
//!
//! Data models for collections

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Collection model representing a document collection
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Collection {
    /// Unique identifier
    pub id: Uuid,
    /// Collection name (unique identifier)
    pub name: String,
    /// Optional description
    pub description: Option<String>,
    /// Creation timestamp
    pub created_at: DateTime<Utc>,
    /// Last update timestamp
    pub updated_at: DateTime<Utc>,
}

impl Collection {
    /// Create a new collection
    pub fn new(name: String, description: Option<String>) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4(),
            name,
            description,
            created_at: now,
            updated_at: now,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_collection_creation() {
        let collection = Collection::new(
            "test-collection".to_string(),
            Some("Test description".to_string()),
        );
        assert!(!collection.id.is_nil());
        assert_eq!(collection.name, "test-collection");
        assert_eq!(collection.description, Some("Test description".to_string()));
    }
}
