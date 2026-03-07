//! Embeddings module
//!
//! Provides support for multiple embedding providers

pub mod cohere;
pub mod local;
pub mod openai;
pub mod provider;

pub use provider::EmbeddingProvider;
