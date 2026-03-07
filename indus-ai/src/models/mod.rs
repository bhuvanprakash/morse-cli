//! Models module
//!
//! Data models for indus-ai

pub mod collection;
pub mod document;

pub use collection::Collection;
pub use document::{Document, SearchResult, UpsertDocumentRequest, UpsertDocumentResponse};
