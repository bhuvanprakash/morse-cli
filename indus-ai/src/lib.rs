//! indus-ai - AI-native vector search and embeddings service
//!
//! This library provides:
//! - Vector storage using pgvector in PostgreSQL
//! - Semantic search capabilities
//! - Support for multiple embedding providers (OpenAI, Cohere, Ollama)
//! - RAG pipeline support

pub mod config;
pub mod db;
pub mod embeddings;
pub mod handlers;
pub mod middleware;
pub mod models;
pub mod router;

// Re-export commonly used types
pub use config::Config;
pub use embeddings::EmbeddingProvider;
pub use router::AppState;
