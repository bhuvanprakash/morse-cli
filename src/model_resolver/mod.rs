use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    pub provider: String,
    pub model: String,
    pub display_name: String,
    pub context_window: usize,
    pub supports_tools: bool,
    pub supports_streaming: bool,
    pub cost_per_1k_input: f64,
    pub cost_per_1k_output: f64,
}

pub struct ModelResolver {
    models: Vec<ModelInfo>,
}

impl ModelResolver {
    pub fn new() -> Self {
        let models = vec![
            ModelInfo {
                provider: "groq".to_string(),
                model: "llama-3.1-8b-instant".to_string(),
                display_name: "Llama 3.1 8B Instant".to_string(),
                context_window: 131072,
                supports_tools: true,
                supports_streaming: true,
                cost_per_1k_input: 0.05,
                cost_per_1k_output: 0.05,
            },
            ModelInfo {
                provider: "groq".to_string(),
                model: "llama-3.3-70b-versatile".to_string(),
                display_name: "Llama 3.3 70B Versatile".to_string(),
                context_window: 131072,
                supports_tools: true,
                supports_streaming: true,
                cost_per_1k_input: 0.59,
                cost_per_1k_output: 0.79,
            },
            ModelInfo {
                provider: "openai".to_string(),
                model: "gpt-4o".to_string(),
                display_name: "GPT-4o".to_string(),
                context_window: 128000,
                supports_tools: true,
                supports_streaming: true,
                cost_per_1k_input: 2.50,
                cost_per_1k_output: 10.00,
            },
            ModelInfo {
                provider: "openai".to_string(),
                model: "gpt-4o-mini".to_string(),
                display_name: "GPT-4o Mini".to_string(),
                context_window: 128000,
                supports_tools: true,
                supports_streaming: true,
                cost_per_1k_input: 0.15,
                cost_per_1k_output: 0.60,
            },
            ModelInfo {
                provider: "anthropic".to_string(),
                model: "claude-3-5-sonnet".to_string(),
                display_name: "Claude 3.5 Sonnet".to_string(),
                context_window: 200000,
                supports_tools: true,
                supports_streaming: true,
                cost_per_1k_input: 3.00,
                cost_per_1k_output: 15.00,
            },
            ModelInfo {
                provider: "anthropic".to_string(),
                model: "claude-3-haiku".to_string(),
                display_name: "Claude 3 Haiku".to_string(),
                context_window: 200000,
                supports_tools: true,
                supports_streaming: true,
                cost_per_1k_input: 0.25,
                cost_per_1k_output: 1.25,
            },
            ModelInfo {
                provider: "anthropic".to_string(),
                model: "claude-3-opus".to_string(),
                display_name: "Claude 3 Opus".to_string(),
                context_window: 200000,
                supports_tools: true,
                supports_streaming: true,
                cost_per_1k_input: 15.00,
                cost_per_1k_output: 75.00,
            },
        ];

        Self { models }
    }

    pub fn resolve(&self, provider: &str, model: &str) -> Option<&ModelInfo> {
        self.models.iter().find(|m| m.provider == provider && m.model == model)
    }

    pub fn list_by_provider(&self, provider: &str) -> Vec<&ModelInfo> {
        self.models.iter().filter(|m| m.provider == provider).collect()
    }

    pub fn all(&self) -> &[ModelInfo] {
        &self.models
    }

    pub fn estimate_cost(&self, provider: &str, model: &str, input_tokens: u64, output_tokens: u64) -> Option<f64> {
        let info = self.resolve(provider, model)?;
        Some(
            (input_tokens as f64 / 1000.0) * info.cost_per_1k_input +
            (output_tokens as f64 / 1000.0) * info.cost_per_1k_output
        )
    }
}

impl Default for ModelResolver {
    fn default() -> Self {
        Self::new()
    }
}
