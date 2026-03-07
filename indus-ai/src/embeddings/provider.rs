//! Embedding Provider trait
//!
//! Defines the interface for embedding providers that convert text to vectors

use async_trait::async_trait;
use serde::{Deserialize, Serialize};

/// Error type for embedding provider operations
#[derive(Debug, thiserror::Error)]
pub enum EmbeddingError {
    #[error("API request failed: {0}")]
    Request(#[from] reqwest::Error),

    #[error("API response parsing failed: {0}")]
    Parse(String),

    #[error("API error: {0}")]
    Api(String),

    #[error("Invalid input: {0}")]
    InvalidInput(String),
}

/// Embedding result from a provider
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmbeddingResult {
    /// The embedding vector
    pub embedding: Vec<f32>,
    /// The model used to generate the embedding
    pub model: String,
    /// Number of dimensions in the embedding
    pub dimensions: usize,
}

/// EmbeddingProvider trait
///
/// All embedding providers must implement this trait to generate text embeddings
#[async_trait]
pub trait EmbeddingProvider: Send + Sync {
    /// Generate embeddings for a list of texts
    ///
    /// # Arguments
    /// * `texts` - A list of text strings to embed
    ///
    /// # Returns
    /// * A list of EmbeddingResult, one for each input text
    async fn embed(&self, texts: &[String]) -> Result<Vec<EmbeddingResult>, EmbeddingError>;

    /// Get the number of dimensions this provider produces
    fn dimensions(&self) -> usize;

    /// Get the model name this provider uses
    fn model(&self) -> &str;
}
