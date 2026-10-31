//! LLM Provider system with production-grade error handling.
//!
//! One generic OpenAI-compatible implementation covers Groq, OpenAI,
//! DeepSeek, Together, Mistral, xAI, Fireworks, Cerebras, SambaNova,
//! DeepInfra, Nebius, Novita, Hyperbolic, Lepton, OpenRouter and Ollama.
//! Anthropic and Gemini have their own wire formats. All providers support
//! streaming (SSE) and tool calling.

use crate::config::Config;
use crate::errors::{ErrorCategory, MorseError, MorseResult};
use crate::observability::metrics;
use crate::ui::UI;
use anyhow::Result;
use async_trait::async_trait;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::path::Path;
use std::time::Duration;

// ---------------------------------------------------------------------------
// Core types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone)]
pub struct CompletionRequest {
    pub model: String,
    pub system_prompt: Option<String>,
    pub messages: Vec<Message>,
    pub tools: Option<Vec<ToolDef>>,
    pub max_tokens: Option<i32>,
    pub temperature: Option<f64>,
    pub stream: bool,
}

impl CompletionRequest {
    pub fn new(model: &str, prompt: &str) -> Self {
        Self {
            model: model.to_string(),
            system_prompt: None,
            messages: vec![Message::user(prompt)],
            tools: None,
            max_tokens: None,
            temperature: None,
            stream: false,
        }
    }

    pub fn with_system(mut self, system: &str) -> Self {
        self.system_prompt = Some(system.to_string());
        self
    }

    pub fn with_tools(mut self, tools: Vec<ToolDef>) -> Self {
        self.tools = Some(tools);
        self
    }

    pub fn with_temperature(mut self, t: f64) -> Self {
        self.temperature = Some(t);
        self
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub role: String,
    pub content: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<Vec<ToolCall>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tool_call_id: Option<String>,
}

impl Message {
    pub fn user(content: &str) -> Self {
        Self { role: "user".into(), content: content.to_string(), tool_calls: None, tool_call_id: None }
    }
    pub fn assistant(content: &str) -> Self {
        Self { role: "assistant".into(), content: content.to_string(), tool_calls: None, tool_call_id: None }
    }
    pub fn tool_result(id: &str, content: &str) -> Self {
        Self { role: "tool".into(), content: content.to_string(), tool_calls: None, tool_call_id: Some(id.to_string()) }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolDef {
    pub name: String,
    pub description: String,
    pub parameters: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCall {
    pub id: String,
    pub name: String,
    pub arguments: Value,
}

#[derive(Debug, Clone)]
pub struct CompletionResponse {
    pub content: String,
    pub model: String,
    pub provider: String,
    pub tool_calls: Option<Vec<ToolCall>>,
    pub input_tokens: i32,
    pub output_tokens: i32,
    pub confidence: Option<f64>,
}

// ---------------------------------------------------------------------------
// Provider trait
// ---------------------------------------------------------------------------

#[async_trait]
pub trait Provider: Send + Sync {
    fn name(&self) -> &str;
    async fn complete(&self, req: CompletionRequest) -> MorseResult<CompletionResponse>;

    /// Streaming completion. `on_chunk` is called with each text delta as it
    /// arrives. The final accumulated response is returned.
    async fn stream(
        &self,
        req: CompletionRequest,
        on_chunk: &mut (dyn FnMut(String) + Send),
    ) -> MorseResult<CompletionResponse> {
        // Default: no native streaming, degrade to one shot.
        let _ = on_chunk;
        self.complete(req).await
    }

    fn models_available(&self) -> Vec<String>;
    async fn validate_key(&self) -> MorseResult<()>;
}

// ---------------------------------------------------------------------------
// Shared HTTP helpers
// ---------------------------------------------------------------------------

fn http_client() -> Client {
    Client::builder()
        .timeout(Duration::from_secs(300))
        .connect_timeout(Duration::from_secs(15))
        .build()
        .unwrap_or_else(|_| Client::new())
}

fn api_error(provider: &str, code: &str, status: reqwest::StatusCode, body: &str) -> MorseError {
    let hint = if status.as_u16() == 401 || status.as_u16() == 403 {
        "Verify your API key (env var or ~/.morse/config.yaml)"
    } else if status.as_u16() == 429 {
        "Rate limited or out of quota — wait and retry, or switch models with --model"
    } else if status.as_u16() == 404 {
        "Model name may be wrong — run 'morse models' to list what this provider supports"
    } else {
        "Check provider status; Morse will retry transient failures automatically"
    };
    MorseError::new(code, &format!("{} API error {status}: {}", provider, truncate(body, 400)), ErrorCategory::Provider)
        .with_suggestion(hint)
}

fn truncate(s: &str, max: usize) -> String {
    if s.len() <= max {
        s.to_string()
    } else {
        let mut end = max;
        while !s.is_char_boundary(end) {
            end -= 1;
        }
        format!("{}…", &s[..end])
    }
}

/// Retry wrapper with exponential backoff for transient failures.
async fn with_retry<T, F, Fut>(op_name: &str, attempts: u32, mut f: F) -> MorseResult<T>
where
    F: FnMut() -> Fut,
    Fut: std::future::Future<Output = MorseResult<T>>,
{
    let mut last_err = None;
    for attempt in 0..attempts {
        match f().await {
            Ok(v) => return Ok(v),
            Err(e) => {
                let retryable = matches!(e.category, ErrorCategory::Network)
                    || (matches!(e.category, ErrorCategory::Provider) && e.message.contains(" 5"));
                if !retryable || attempt + 1 == attempts {
                    return Err(e);
                }
                let backoff_ms = 400u64 * 2u64.pow(attempt);
                tracing::warn!(op = op_name, attempt, backoff_ms, error = %e.message, "retrying after failure");
                tokio::time::sleep(Duration::from_millis(backoff_ms)).await;
                last_err = Some(e);
            }
        }
    }
    Err(last_err.unwrap_or_else(|| MorseError::new("PROV-RTY", "retry budget exhausted", ErrorCategory::Network)))
}

// ---------------------------------------------------------------------------
// OpenAI-compatible provider (Groq, OpenAI, DeepSeek, Together, Mistral, ...)
// ---------------------------------------------------------------------------

/// Static catalog of OpenAI-compatible endpoints.
pub fn compatible_endpoint(provider: &str) -> Option<(&'static str, &'static str)> {
    // (base_url, default_model)
    let pair = match provider {
        "groq" => ("https://api.groq.com/openai/v1", "openai/gpt-oss-120b"),
        "openai" => ("https://api.openai.com/v1", "gpt-4o-mini"),
        "deepseek" => ("https://api.deepseek.com/v1", "deepseek-chat"),
        "together" => ("https://api.together.xyz/v1", "meta-llama/Llama-3.3-70B-Instruct-Turbo"),
        "mistral" => ("https://api.mistral.ai/v1", "mistral-large-latest"),
        "xai" => ("https://api.x.ai/v1", "grok-2-latest"),
        "fireworks" => ("https://api.fireworks.ai/inference/v1", "accounts/fireworks/models/llama-v3p3-70b-instruct"),
        "cerebras" => ("https://api.cerebras.ai/v1", "llama-3.3-70b"),
        "sambanova" => ("https://api.sambanova.ai/v1", "Meta-Llama-3.3-70B-Instruct"),
        "deepinfra" => ("https://api.deepinfra.com/v1/openai", "meta-llama/Llama-3.3-70B-Instruct"),
        "nebius" => ("https://api.staging.nebius.ai/v1", "meta-llama/Llama-3.1-70B-Instruct"),
        "novita" => ("https://api.novita.ai/v3/openai", "meta-llama/llama-3.3-70b-instruct"),
        "hyperbolic" => ("https://api.hyperbolic.xyz/v1", "meta-llama/Meta-Llama-3.1-70B-Instruct"),
        "lepton" => ("https://api.lepton.ai/api/v1", "llama-3.3-70b-instruct"),
        "openrouter" => ("https://openrouter.ai/api/v1", "meta-llama/llama-3.3-70b-instruct"),
        "ollama" => ("http://localhost:11434/v1", "llama3.2"),
        _ => return None,
    };
    Some(pair)
}

pub struct OpenAICompatProvider {
    provider_name: String,
    base_url: String,
    api_key: String,
    default_model: String,
    client: Client,
}

impl OpenAICompatProvider {
    pub fn new(provider_name: &str, base_url: &str, api_key: &str, default_model: &str) -> Self {
        Self {
            provider_name: provider_name.to_string(),
            base_url: base_url.trim_end_matches('/').to_string(),
            api_key: api_key.to_string(),
            default_model: default_model.to_string(),
            client: http_client(),
        }
    }

    fn url(&self) -> String {
        format!("{}/chat/completions", self.base_url)
    }

    fn auth_headers(&self, req: reqwest::RequestBuilder) -> reqwest::RequestBuilder {
        // OpenRouter and Lepton require a bearer token; Ollama needs none but
        // tolerates one. All others use standard bearer auth.
        req.header("Authorization", format!("Bearer {}", self.api_key))
    }

    fn to_openai_messages(&self, req: &CompletionRequest) -> Vec<Value> {
        let mut out: Vec<Value> = Vec::new();
        if let Some(sys) = &req.system_prompt {
            out.push(json!({"role": "system", "content": sys}));
        }
        for m in &req.messages {
            if m.role == "tool" {
                out.push(json!({
                    "role": "tool",
                    "tool_call_id": m.tool_call_id.clone().unwrap_or_default(),
                    "content": m.content,
                }));
            } else if let Some(tcs) = &m.tool_calls {
                let tcs: Vec<Value> = tcs
                    .iter()
                    .map(|tc| json!({
                        "id": tc.id,
                        "type": "function",
                        "function": {
                            "name": tc.name,
                            "arguments": tc.arguments.to_string(),
                        }
                    }))
                    .collect();
                out.push(json!({"role": m.role, "content": m.content, "tool_calls": tcs}));
            } else {
                out.push(json!({"role": m.role, "content": m.content}));
            }
        }
        out
    }

    fn body(&self, req: &CompletionRequest, stream: bool) -> Value {
        let mut body = json!({
            "model": req.model,
            "messages": self.to_openai_messages(req),
            "max_tokens": req.max_tokens.unwrap_or(8192),
            "temperature": req.temperature.unwrap_or(0.7),
            "stream": stream,
        });
        if let Some(tools) = &req.tools {
            let defs: Vec<Value> = tools
                .iter()
                .map(|t| json!({
                    "type": "function",
                    "function": {
                        "name": t.name,
                        "description": t.description,
                        "parameters": t.parameters,
                    }
                }))
                .collect();
            body["tools"] = json!(defs);
        }
        body
    }

    fn parse_response(&self, req: &CompletionRequest, parsed: &Value) -> MorseResult<CompletionResponse> {
        let choice = &parsed["choices"][0];
        let msg = &choice["message"];
        let content = msg["content"].as_str().unwrap_or("").to_string();
        let tool_calls = msg["tool_calls"].as_array().map(|arr| {
            arr.iter()
                .filter_map(|tc| {
                    let id = tc["id"].as_str()?.to_string();
                    let name = tc["function"]["name"].as_str()?.to_string();
                    // Arguments arrive as a JSON-encoded string; tolerate
                    // providers that already send an object.
                    let raw = &tc["function"]["arguments"];
                    let arguments = match raw {
                        Value::String(s) => serde_json::from_str(s)
                            .unwrap_or_else(|_| json!({"_raw": s})),
                        other => other.clone(),
                    };
                    Some(ToolCall { id, name, arguments })
                })
                .collect::<Vec<_>>()
        });

        Ok(CompletionResponse {
            content,
            model: req.model.clone(),
            provider: self.provider_name.clone(),
            tool_calls: tool_calls.filter(|t| !t.is_empty()),
            input_tokens: parsed["usage"]["prompt_tokens"].as_i64().unwrap_or(0) as i32,
            output_tokens: parsed["usage"]["completion_tokens"].as_i64().unwrap_or(0) as i32,
            confidence: None,
        })
    }
}

#[async_trait]
impl Provider for OpenAICompatProvider {
    fn name(&self) -> &str {
        &self.provider_name
    }

    async fn complete(&self, mut req: CompletionRequest) -> MorseResult<CompletionResponse> {
        metrics().increment(&format!("provider.{}.requests", self.provider_name));
        req.stream = false;
        let provider = self.provider_name.clone();
        let resp = with_retry(&provider, 3, || async {
            let sent = self
                .auth_headers(self.client.post(self.url()))
                .json(&self.body(&req, false))
                .send()
                .await
                .map_err(|e| MorseError::new(
                    "PROV-NET",
                    &format!("{} request failed: {}", provider, e),
                    ErrorCategory::Network,
                ).with_suggestion("Check your internet connection"))?;

            let status = sent.status();
            let text = sent.text().await.map_err(|e| MorseError::new(
                "PROV-RD",
                &format!("Failed to read {} response: {}", provider, e),
                ErrorCategory::Network,
            ))?;
            if !status.is_success() {
                return Err(api_error(&provider, "PROV-API", status, &text));
            }
            let parsed: Value = serde_json::from_str(&text).map_err(|e| MorseError::new(
                "PROV-PARSE",
                &format!("Failed to parse {} response: {}", provider, e),
                ErrorCategory::Parse,
            ))?;
            self.parse_response(&req, &parsed)
        })
        .await?;
        metrics().increment(&format!("provider.{}.success", self.provider_name));
        Ok(resp)
    }

    async fn stream(
        &self,
        mut req: CompletionRequest,
        on_chunk: &mut (dyn FnMut(String) + Send),
    ) -> MorseResult<CompletionResponse> {
        metrics().increment(&format!("provider.{}.stream_requests", self.provider_name));
        req.stream = true;
        let provider = self.provider_name.clone();

        let sent = self
            .auth_headers(self.client.post(self.url()))
            .json(&self.body(&req, true))
            .send()
            .await
            .map_err(|e| MorseError::new(
                "PROV-NET",
                &format!("{} streaming request failed: {}", provider, e),
                ErrorCategory::Network,
            ).with_suggestion("Check your internet connection"))?;

        let status = sent.status();
        if !status.is_success() {
            let text = sent.text().await.unwrap_or_default();
            return Err(api_error(&provider, "PROV-API", status, &text));
        }

        use futures_util::StreamExt;
        let mut content = String::new();
        let mut tool_call_acc: Vec<ToolCall> = Vec::new();
        // Partial tool-call arguments streamed as fragments keyed by index.
        let mut partial_args: std::collections::BTreeMap<usize, (String, String, String)> =
            std::collections::BTreeMap::new();
        let mut input_tokens = 0i32;
        let mut output_tokens = 0i32;

        let mut stream = sent.bytes_stream();
        let mut buffer = String::new();
        while let Some(item) = stream.next().await {
            let chunk = item.map_err(|e| MorseError::new(
                "PROV-STREAM",
                &format!("{} stream interrupted: {}", provider, e),
                ErrorCategory::Network,
            ))?;
            buffer.push_str(&String::from_utf8_lossy(&chunk));
            // SSE frames are newline-delimited; process complete lines.
            while let Some(nl) = buffer.find('\n') {
                let line: String = buffer.drain(..=nl).collect();
                let line = line.trim();
                let Some(data) = line.strip_prefix("data:") else { continue };
                let data = data.trim();
                if data.is_empty() || data == "[DONE]" {
                    continue;
                }
                let Ok(parsed) = serde_json::from_str::<Value>(data) else { continue };
                if let Some(u) = parsed["usage"]["prompt_tokens"].as_i64() {
                    input_tokens = u as i32;
                }
                if let Some(u) = parsed["usage"]["completion_tokens"].as_i64() {
                    output_tokens = u as i32;
                }
                let delta = &parsed["choices"][0]["delta"];
                if let Some(t) = delta["content"].as_str() {
                    if !t.is_empty() {
                        content.push_str(t);
                        on_chunk(t.to_string());
                    }
                }
                if let Some(tcs) = delta["tool_calls"].as_array() {
                    for tc in tcs {
                        let idx = tc["index"].as_u64().unwrap_or(0) as usize;
                        let entry = partial_args.entry(idx).or_default();
                        if let Some(id) = tc["id"].as_str() {
                            entry.0 = id.to_string();
                        }
                        if let Some(name) = tc["function"]["name"].as_str() {
                            entry.1 = name.to_string();
                        }
                        if let Some(args) = tc["function"]["arguments"].as_str() {
                            entry.2.push_str(args);
                        }
                    }
                }
            }
        }

        for (idx, (id, name, args)) in partial_args {
            let arguments = serde_json::from_str(&args).unwrap_or_else(|_| json!({"_raw": args}));
            tool_call_acc.push(ToolCall {
                id: if id.is_empty() { format!("call_{}", idx) } else { id },
                name,
                arguments,
            });
        }

        Ok(CompletionResponse {
            content,
            model: req.model.clone(),
            provider: self.provider_name.clone(),
            tool_calls: if tool_call_acc.is_empty() { None } else { Some(tool_call_acc) },
            input_tokens,
            output_tokens,
            confidence: None,
        })
    }

    fn models_available(&self) -> Vec<String> {
        vec![self.default_model.clone()]
    }

    async fn validate_key(&self) -> MorseResult<()> {
        // Ollama is local and keyless.
        if self.provider_name == "ollama" {
            return Ok(());
        }
        if self.api_key.is_empty() {
            return Err(MorseError::new(
                "PROV-KEY",
                &format!("{} API key not configured", self.provider_name),
                ErrorCategory::Auth,
            ).with_suggestion(&format!(
                "Set {}_API_KEY environment variable",
                self.provider_name.to_uppercase()
            )));
        }
        Ok(())
    }
}
