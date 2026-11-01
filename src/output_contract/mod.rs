use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum OutputFormat {
    Text,
    Json,
    StreamJson,
}

impl OutputFormat {
    /// Total parser: unknown formats default to `Text`. Intentionally not
    /// `FromStr` (which is fallible by contract).
    #[allow(clippy::should_implement_trait)]
    pub fn from_str(s: &str) -> Self {
        match s {
            "json" => OutputFormat::Json,
            "stream-json" => OutputFormat::StreamJson,
            _ => OutputFormat::Text,
        }
    }

    pub fn as_str(&self) -> &str {
        match self {
            OutputFormat::Text => "text",
            OutputFormat::Json => "json",
            OutputFormat::StreamJson => "stream-json",
        }
    }
}

pub struct OutputContract {
    format: OutputFormat,
}

impl OutputContract {
    pub fn new(format: OutputFormat) -> Self {
        Self { format }
    }

    pub fn render_success(&self, data: serde_json::Value) -> String {
        match self.format {
            OutputFormat::Json => serde_json::to_string_pretty(&data).unwrap_or_default(),
            OutputFormat::StreamJson => serde_json::to_string(&data).unwrap_or_default() + "\n",
            OutputFormat::Text => data.to_string(),
        }
    }

    pub fn render_error(&self, message: &str) -> String {
        match self.format {
            OutputFormat::Json => serde_json::to_string_pretty(&serde_json::json!({
                "error": message,
                "success": false
            })).unwrap_or_default(),
            OutputFormat::StreamJson => serde_json::to_string(&serde_json::json!({
                "error": message,
                "success": false
            })).unwrap_or_default() + "\n",
            OutputFormat::Text => format!("Error: {}", message),
        }
    }

    pub fn render_chat(&self, content: String, provider: String, model: String) -> String {
        match self.format {
            OutputFormat::Json => serde_json::to_string_pretty(&serde_json::json!({
                "content": content,
                "provider": provider,
                "model": model,
                "success": true
            })).unwrap_or_default(),
            OutputFormat::StreamJson => serde_json::to_string(&serde_json::json!({
                "content": content,
                "provider": provider,
                "model": model,
                "success": true
            })).unwrap_or_default() + "\n",
            OutputFormat::Text => format!("\n{} ({}):\n{}", provider, model, content),
        }
    }
}
