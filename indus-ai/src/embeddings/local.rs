//! Ollama Local Embedding Provider
//!
//! Uses local Ollama embeddings endpoint and processes one text per request.

use async_trait::async_trait;
use reqwest::Client;
use serde::{Deserialize, Serialize};

use super::provider::{EmbeddingError, EmbeddingProvider, EmbeddingResult};

#[derive(Debug, Serialize)]
struct OllamaEmbedRequest<'a> {
    model: &'a str,
    prompt: &'a str,
}

#[derive(Debug, Deserialize)]
struct OllamaEmbedResponse {
    embedding: Vec<f32>,
}

pub struct OllamaProvider {
    base_url: String,
    model: String,
    dimensions: usize,
    client: Client,
}

impl OllamaProvider {
    pub fn new(base_url: String, model: String) -> Self {
        let dimensions = match model.as_str() {
            "nomic-embed-text" => 768,
            "mxbai-embed-large" => 1536,
            "bge-m3" => 1024,
            "bge-large" => 1024,
            "bge-small" => 384,
            _ => 768,
        };
        Self {
            base_url,
            model,
            dimensions,
            client: Client::new(),
        }
    }
}

#[async_trait]
impl EmbeddingProvider for OllamaProvider {
    async fn embed(&self, texts: &[String]) -> Result<Vec<EmbeddingResult>, EmbeddingError> {
        let mut results = Vec::with_capacity(texts.len());
        for text in texts {
            let req = OllamaEmbedRequest {
                model: &self.model,
                prompt: text.as_str(),
            };
            let resp: OllamaEmbedResponse = self
                .client
                .post(format!("{}/api/embeddings", self.base_url))
                .json(&req)
                .send()
                .await?
                .error_for_status()
                .map_err(|e| EmbeddingError::Api(format!("Ollama API request failed: {}", e)))?
                .json()
                .await
                .map_err(|e| EmbeddingError::Parse(format!("Failed to parse Ollama response: {}", e)))?;

            results.push(EmbeddingResult {
                dimensions: resp.embedding.len(),
                embedding: resp.embedding,
                model: format!("ollama/{}", self.model),
            });
        }
        Ok(results)
    }

    fn dimensions(&self) -> usize {
        self.dimensions
    }

    fn model(&self) -> &str {
        &self.model
    }
}
