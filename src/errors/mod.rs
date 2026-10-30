//! Production-grade error handling for Morse CLI

use serde::{Deserialize, Serialize};
use std::fmt;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MorseError {
    pub code: String,
    pub message: String,
    pub category: ErrorCategory,
    pub severity: ErrorSeverity,
    pub source: Option<String>,
    pub suggestion: Option<String>,
    pub timestamp: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ErrorCategory {
    Config,
    Provider,
    Network,
    Auth,
    FileSystem,
    Parse,
    Validation,
    Tool,
    Trust,
    Graph,
    RAG,
    Cloud,
    Daemon,
    LSP,
    MCP,
    Storage,
    RateLimit,
    Internal,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ErrorSeverity {
    Info,
    Warning,
    Error,
    Critical,
    Fatal,
}

impl MorseError {
    pub fn new(code: &str, message: &str, category: ErrorCategory) -> Self {
        Self {
            code: code.to_string(),
            message: message.to_string(),
            category,
            severity: ErrorSeverity::Error,
            source: None,
            suggestion: None,
            timestamp: chrono::Utc::now(),
        }
    }

    pub fn with_severity(mut self, severity: ErrorSeverity) -> Self {
        self.severity = severity;
        self
    }

    pub fn with_source(mut self, source: &str) -> Self {
        self.source = Some(source.to_string());
        self
    }

    pub fn with_suggestion(mut self, suggestion: &str) -> Self {
        self.suggestion = Some(suggestion.to_string());
        self
    }

    pub fn from_anyhow(e: anyhow::Error) -> Self {
        Self {
            code: "INTERNAL".to_string(),
            message: e.to_string(),
            category: ErrorCategory::Internal,
            severity: ErrorSeverity::Error,
            source: None,
            suggestion: None,
            timestamp: chrono::Utc::now(),
        }
    }

    pub fn display(&self) -> String {
        let mut lines = Vec::new();

        let severity_icon = match self.severity {
            ErrorSeverity::Info => "ℹ",
            ErrorSeverity::Warning => "⚠",
            ErrorSeverity::Error => "✖",
            ErrorSeverity::Critical => "‼",
            ErrorSeverity::Fatal => "💀",
        };

        lines.push(format!(
            "{} [{}] {}",
            severity_icon, self.code, self.message
        ));

        if let Some(ref source) = self.source {
            lines.push(format!("  Source: {}", source));
        }

        if let Some(ref suggestion) = self.suggestion {
            lines.push(format!("  💡 Suggestion: {}", suggestion));
        }

        lines.join("\n")
    }
}

impl fmt::Display for MorseError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.display())
    }
}

impl std::error::Error for MorseError {}

impl From<anyhow::Error> for MorseError {
    fn from(e: anyhow::Error) -> Self {
        Self::from_anyhow(e)
    }
}

pub type MorseResult<T> = Result<T, MorseError>;

pub fn handle_error<T>(result: Result<T, anyhow::Error>) -> MorseResult<T> {
    result.map_err(MorseError::from_anyhow)
}

pub fn wrap_error<T, E: std::error::Error + Send + Sync + 'static>(
    result: Result<T, E>,
    code: &str,
    category: ErrorCategory,
) -> MorseResult<T> {
    result.map_err(|e| {
        MorseError::new(code, &e.to_string(), category).with_source(&e.to_string())
    })
}

pub trait ContextExt<T, E> {
    fn with_morse_context(self, code: &str, category: ErrorCategory) -> MorseResult<T>;
}

impl<T, E: std::error::Error + Send + Sync + 'static> ContextExt<T, E> for Result<T, E> {
    fn with_morse_context(self, code: &str, category: ErrorCategory) -> MorseResult<T> {
        self.map_err(|e| MorseError::new(code, &e.to_string(), category).with_source(&e.to_string()))
    }
}
