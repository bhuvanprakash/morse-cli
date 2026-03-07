//! OpenAI Embedding Provider
//!
//! Provides embeddings using OpenAI's text-embedding models

use async_trait::async_trait;
use reqwest::Client;
use serde::{Deserialize, Serialize};

use super::provider::{EmbeddingError, EmbeddingProvider, EmbeddingResult};

/// OpenAI API request body
#[derive(Debug, Serialize)]
struct OpenAIRequest {
    /// Input texts to embed
    input: Vec<String>,
    /// Model to use
    model: String,
}

/// OpenAI API response
#[derive(Debug, Deserialize)]
struct OpenAIResponse {
    /// List of embeddings
    data: Vec<OpenAIEmbedding>,
    /// Model used
    model: String,
    /// Usage information
    usage: OpenAIUsage,
}

/// Individual embedding from OpenAI
#[derive(Debug, Deserialize)]
struct OpenAIEmbedding {
    /// Embedding vector
    embedding: Vec<f32>,
    /// Index of the embedding
    index: usize,
}

/// Usage information
#[derive(Debug, Deserialize)]
struct OpenAIUsage {
    /// Number of tokens used
    #[serde(rename = "prompt_tokens")]
    prompt_tokens: usize,
    /// Total tokens
    #[serde(rename = "total_tokens")]
    total_tokens: usize,
}

/// OpenAI Embedding Provider
///
/// Uses the OpenAI API to generate text embeddings
pub struct OpenAIProvider {
    /// HTTP client
    client: Client,
    /// OpenAI API key
    api_key: String,
    /// Model name
    model: String,
    /// Number of dimensions
    dimensions: usize,
}

impl OpenAIProvider {
    /// Create a new OpenAI provider
    ///
    /// # Arguments
    /// * `api_key` - OpenAI API key
    /// * `model` - Model name (e.g., "text-embedding-3-small")
    pub fn new(api_key: String, model: String) -> Self {
        // Determine dimensions based on model
        let dimensions = match model.as_str() {
            "text-embedding-3-small" | "text-embedding-ada-002" => 1536,
            "text-embedding-3-large" => 3072,
            _ => 1536, // Default to 1536
        };

        Self {
            client: Client::new(),
            api_key,
            model,
            dimensions,
        }
    }
}

#[async_trait]
impl EmbeddingProvider for OpenAIProvider {
    /// Generate embeddings for texts using OpenAI API
    async fn embed(&self, texts: &[String]) -> Result<Vec<EmbeddingResult>, EmbeddingError> {
        let request = OpenAIRequest {
            input: texts.to_vec(),
            model: self.model.clone(),
        };

        let response = self
            .client
            .post("https://api.openai.com/v1/embeddings")
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(EmbeddingError::Api(format!(
                "OpenAI API error ({}): {}",
                status, body
            )));
        }

        let response: OpenAIResponse = response.json().await.map_err(|e| {
            EmbeddingError::Parse(format!("Failed to parse OpenAI response: {}", e))
        })?;

        // Sort by index to maintain order
        let mut embeddings: Vec<_> = response.data;
        embeddings.sort_by_key(|e| e.index);

        let results: Vec<EmbeddingResult> = embeddings
            .into_iter()
            .map(|e| EmbeddingResult {
                embedding: e.embedding,
                model: response.model.clone(),
                dimensions: self.dimensions,
            })
            .collect();

        Ok(results)
    }

    /// Get the number of dimensions
    fn dimensions(&self) -> usize {
        self.dimensions
    }

    /// Get the model name
    fn model(&self) -> &str {
        &self.model
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_provider_creation() {
        let provider = OpenAIProvider::new(
            "test-key".to_string(),
            "text-embedding-3-small".to_string(),
        );
        assert_eq!(provider.dimensions(), 1536);
        assert_eq!(provider.model(), "text-embedding-3-small");
    }
}
