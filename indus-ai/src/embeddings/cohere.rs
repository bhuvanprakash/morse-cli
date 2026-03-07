//! Cohere Embedding Provider
//!
//! Uses Cohere embed API with chunking (max 96 texts per request).

use async_trait::async_trait;
use reqwest::Client;
use serde::{Deserialize, Serialize};

use super::provider::{EmbeddingError, EmbeddingProvider, EmbeddingResult};

#[derive(Debug, Serialize)]
struct CohereEmbedRequest<'a> {
    texts: &'a [String],
    model: &'a str,
    input_type: &'a str,
}

#[derive(Debug, Deserialize)]
struct CohereEmbedResponse {
    embeddings: Vec<Vec<f32>>,
}

pub struct CohereProvider {
    api_key: String,
    model: String,
    dimensions: usize,
    client: Client,
}

impl CohereProvider {
    pub fn new(api_key: String, model: String) -> Self {
        let dimensions = match model.as_str() {
            "embed-multilingual-v3.0" => 1024,
            "embed-english-v3.0" => 1024,
            "embed-multilingual-v2.0" => 768,
            "embed-english-v2.0" => 4096,
            _ => 1024,
        };
        Self {
            api_key,
            model,
            dimensions,
            client: Client::new(),
        }
    }
}

#[async_trait]
impl EmbeddingProvider for CohereProvider {
    async fn embed(&self, texts: &[String]) -> Result<Vec<EmbeddingResult>, EmbeddingError> {
        let mut all_embeddings = Vec::with_capacity(texts.len());
        for chunk in texts.chunks(96) {
            let req = CohereEmbedRequest {
                texts: chunk,
                model: &self.model,
                input_type: "search_document",
            };
            let resp: CohereEmbedResponse = self
                .client
                .post("https://api.cohere.com/v1/embed")
                .bearer_auth(&self.api_key)
                .json(&req)
                .send()
                .await?
                .error_for_status()
                .map_err(|e| EmbeddingError::Api(format!("Cohere API request failed: {}", e)))?
                .json()
                .await
                .map_err(|e| EmbeddingError::Parse(format!("Failed to parse Cohere response: {}", e)))?;
            all_embeddings.extend(resp.embeddings);
        }

        Ok(all_embeddings
            .into_iter()
            .map(|embedding| EmbeddingResult {
                dimensions: embedding.len(),
                embedding,
                model: format!("cohere/{}", self.model),
            })
            .collect())
    }

    fn dimensions(&self) -> usize {
        self.dimensions
    }

    fn model(&self) -> &str {
        &self.model
    }
}

pub struct CohereQueryProvider(pub CohereProvider);

#[async_trait]
impl EmbeddingProvider for CohereQueryProvider {
    async fn embed(&self, texts: &[String]) -> Result<Vec<EmbeddingResult>, EmbeddingError> {
        let mut all_embeddings = Vec::with_capacity(texts.len());
        for chunk in texts.chunks(96) {
            let req = CohereEmbedRequest {
                texts: chunk,
                model: &self.0.model,
                input_type: "search_query",
            };
            let resp: CohereEmbedResponse = self
                .0
                .client
                .post("https://api.cohere.com/v1/embed")
                .bearer_auth(&self.0.api_key)
                .json(&req)
                .send()
                .await?
                .error_for_status()
                .map_err(|e| EmbeddingError::Api(format!("Cohere API request failed: {}", e)))?
                .json()
                .await
                .map_err(|e| EmbeddingError::Parse(format!("Failed to parse Cohere response: {}", e)))?;
            all_embeddings.extend(resp.embeddings);
        }

        Ok(all_embeddings
            .into_iter()
            .map(|embedding| EmbeddingResult {
                dimensions: embedding.len(),
                embedding,
                model: format!("cohere/{}", self.0.model),
            })
            .collect())
    }

    fn dimensions(&self) -> usize {
        self.0.dimensions
    }

    fn model(&self) -> &str {
        &self.0.model
    }
}
