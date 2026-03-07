//! Configuration module for indus-ai
//!
//! Handles loading and parsing configuration from environment variables

use std::env;

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};

use crate::embeddings::provider::EmbeddingProvider;

/// Supported embedding providers
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum EmbeddingProviderType {
    /// OpenAI embedding models
    Openai,
    /// Cohere embedding models (recommended for Indian languages)
    Cohere,
    /// Local Ollama models
    Local,
}

impl Default for EmbeddingProviderType {
    fn default() -> Self {
        Self::Openai
    }
}

impl std::str::FromStr for EmbeddingProviderType {
    type Err = anyhow::Error;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "openai" => Ok(Self::Openai),
            "cohere" => Ok(Self::Cohere),
            "local" | "ollama" => Ok(Self::Local),
            _ => anyhow::bail!(
                "Unknown embedding provider: {}. Valid options: openai, cohere, local",
                s
            ),
        }
    }
}

/// Application configuration
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Config {
    // Server configuration
    /// Server host (default: 0.0.0.0)
    pub host: String,
    /// Server port (default: 8007)
    pub port: u16,

    // Database configuration
    /// PostgreSQL connection URL
    pub database_url: String,

    // JWT configuration
    /// JWT secret for token validation
    pub jwt_secret: String,

    // Embedding provider configuration
    /// Which embedding provider to use
    pub embedding_provider: EmbeddingProviderType,

    // OpenAI configuration
    /// OpenAI API key
    pub openai_api_key: Option<String>,
    /// OpenAI model to use (default: text-embedding-3-small)
    pub openai_model: Option<String>,

    // Cohere configuration
    /// Cohere API key
    pub cohere_api_key: Option<String>,
    /// Cohere model to use (default: embed-multilingual-v3.0)
    pub cohere_model: Option<String>,

    // Ollama configuration
    /// Ollama base URL (default: http://localhost:11434)
    pub ollama_base_url: Option<String>,
    /// Ollama model to use (default: nomic-embed-text)
    pub ollama_model: Option<String>,
}

impl Config {
    /// Load configuration from environment variables
    pub fn from_env() -> Result<Self> {
        let host = env::var("SERVER_HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
        let port = env::var("SERVER_PORT")
            .unwrap_or_else(|_| "8007".to_string())
            .parse()
            .context("Invalid SERVER_PORT")?;

        let database_url = env::var("DATABASE_URL")
            .context("DATABASE_URL is required")?;

        let jwt_secret = env::var("JWT_SECRET").unwrap_or_else(|_| "dev-secret".to_string());

        let embedding_provider = env::var("EMBEDDING_PROVIDER")
            .unwrap_or_else(|_| "openai".to_string())
            .parse()?;

        let config = Self {
            host,
            port,
            database_url,
            jwt_secret,
            embedding_provider,
            openai_api_key: env::var("OPENAI_API_KEY").ok(),
            openai_model: env::var("OPENAI_MODEL").ok(),
            cohere_api_key: env::var("COHERE_API_KEY").ok(),
            cohere_model: env::var("COHERE_MODEL").ok(),
            ollama_base_url: env::var("OLLAMA_BASE_URL").ok(),
            ollama_model: env::var("OLLAMA_MODEL").ok(),
        };

        Ok(config)
    }

    /// Create an embedding provider based on the current configuration
    pub fn create_embedding_provider(&self) -> Result<Box<dyn EmbeddingProvider>> {
        match self.embedding_provider {
            EmbeddingProviderType::Openai => {
                let api_key = self
                    .openai_api_key
                    .clone()
                    .context("OPENAI_API_KEY is required for OpenAI provider")?;
                let model = self
                    .openai_model
                    .clone()
                    .unwrap_or_else(|| "text-embedding-3-small".to_string());

                Ok(Box::new(
                    crate::embeddings::openai::OpenAIProvider::new(api_key, model),
                ))
            }
            EmbeddingProviderType::Cohere => {
                let api_key = self
                    .cohere_api_key
                    .clone()
                    .context("COHERE_API_KEY is required for Cohere provider")?;
                let model = self
                    .cohere_model
                    .clone()
                    .unwrap_or_else(|| "embed-multilingual-v3.0".to_string());

                Ok(Box::new(
                    crate::embeddings::cohere::CohereProvider::new(api_key, model),
                ))
            }
            EmbeddingProviderType::Local => {
                let base_url = self
                    .ollama_base_url
                    .clone()
                    .unwrap_or_else(|| "http://localhost:11434".to_string());
                let model = self
                    .ollama_model
                    .clone()
                    .unwrap_or_else(|| "nomic-embed-text".to_string());

                Ok(Box::new(
                    crate::embeddings::local::OllamaProvider::new(base_url, model),
                ))
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        // Should not panic
        let _ = Config::from_env();
    }
}
