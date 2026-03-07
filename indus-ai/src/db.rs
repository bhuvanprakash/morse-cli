//! Database module for indus-ai
//!
//! Handles PostgreSQL connection pool creation and schema initialization

use std::str::FromStr;

use sqlx::postgres::{PgConnectOptions, PgPoolOptions};
use sqlx::{PgPool, Row};
use tracing::{info, warn};

/// Database error types
#[derive(Debug, thiserror::Error)]
pub enum DbError {
    #[error("Database connection error: {0}")]
    Connection(#[from] sqlx::Error),

    #[error("Schema initialization error: {0}")]
    Schema(String),
}

/// Create a PostgreSQL connection pool
///
/// # Arguments
/// * `database_url` - PostgreSQL connection URL
///
/// # Returns
/// * A configured PgPool for database operations
pub async fn create_pool(database_url: &str) -> Result<PgPool, DbError> {
    let options = PgConnectOptions::from_str(database_url)
        .map_err(|e| DbError::Connection(sqlx::Error::Configuration(e.to_string().into())))?;

    let pool = PgPoolOptions::new()
        .max_connections(10)
        .min_connections(2)
        .acquire_timeout(std::time::Duration::from_secs(30))
        .idle_timeout(std::time::Duration::from_secs(600))
        .connect_with(options)
        .await?;

    info!("Database connection pool created successfully");

    Ok(pool)
}

/// Initialize the database schema
///
/// This function:
/// 1. Enables the pgvector extension
/// 2. Creates the indusbase_ai schema
/// 3. Creates the collections table
/// 4. Creates the documents table with ivfflat index
pub async fn initialize_schema(pool: &PgPool) -> Result<(), DbError> {
    // Enable pgvector extension
    info!("Enabling pgvector extension...");
    sqlx::query("CREATE EXTENSION IF NOT EXISTS vector")
        .execute(pool)
        .await?;

    // Create schema
    info!("Creating indusbase_ai schema...");
    sqlx::query("CREATE SCHEMA IF NOT EXISTS indusbase_ai")
        .execute(pool)
        .await?;

    // Create collections table
    info!("Creating collections table...");
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS indusbase_ai.collections (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(255) NOT NULL UNIQUE,
            description TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
        "#,
    )
    .execute(pool)
    .await?;

    // Create documents table
    info!("Creating documents table...");
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS indusbase_ai.documents (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            collection_id UUID NOT NULL REFERENCES indusbase_ai.collections(id) ON DELETE CASCADE,
            content TEXT NOT NULL,
            metadata JSONB DEFAULT '{}',
            embedding vector(1536),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
        "#,
    )
    .execute(pool)
    .await?;

    // Create ivfflat index for vector similarity search
    // Note: This requires the table to have data for the index to be effective
    info!("Creating ivfflat index for vector search...");
    let index_result = sqlx::query(
        r#"
        CREATE INDEX IF NOT EXISTS idx_documents_collection_embedding 
        ON indusbase_ai.documents 
        USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100)
        "#,
    )
    .execute(pool)
    .await;

    if let Err(e) = index_result {
        warn!(
            "Failed to create ivfflat index (this is OK if table is empty): {}",
            e
        );
    }

    // Create GIN index for metadata filtering
    info!("Creating GIN index for metadata filtering...");
    sqlx::query(
        r#"
        CREATE INDEX IF NOT EXISTS idx_documents_metadata 
        ON indusbase_ai.documents USING gin(metadata)
        "#,
    )
    .execute(pool)
    .await?;

    // Create index on collection_id for faster lookups
    sqlx::query(
        r#"
        CREATE INDEX IF NOT EXISTS idx_documents_collection_id 
        ON indusbase_ai.documents(collection_id)
        "#,
    )
    .execute(pool)
    .await?;

    info!("Database schema initialized successfully");
    Ok(())
}

/// Check if a collection exists by name
pub async fn collection_exists(pool: &PgPool, name: &str) -> Result<bool, DbError> {
    let result = sqlx::query(
        "SELECT EXISTS(SELECT 1 FROM indusbase_ai.collections WHERE name = $1)",
    )
    .bind(name)
    .fetch_one(pool)
    .await?;

    Ok(result.get::<bool, _>(0))
}

/// Get collection ID by name
pub async fn get_collection_id(pool: &PgPool, name: &str) -> Result<Option<uuid::Uuid>, DbError> {
    let result = sqlx::query("SELECT id FROM indusbase_ai.collections WHERE name = $1")
        .bind(name)
        .fetch_optional(pool)
        .await?;

    Ok(result.map(|r| r.get::<uuid::Uuid, _>(0)))
}
