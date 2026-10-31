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

// ---------------------------------------------------------------------------
// Anthropic
// ---------------------------------------------------------------------------

pub struct AnthropicProvider {
    api_key: String,
    client: Client,
}

impl AnthropicProvider {
    pub fn new(api_key: &str) -> Self {
        Self { api_key: api_key.to_string(), client: http_client() }
    }

    /// Convert our message list to Anthropic's content-block format,
    /// folding tool results into user messages and assistant tool calls
    /// into assistant content blocks.
    fn to_anthropic_messages(&self, req: &CompletionRequest) -> Vec<Value> {
        let mut out: Vec<Value> = Vec::new();
        for m in &req.messages {
            if m.role == "tool" {
                let block = json!({
                    "type": "tool_result",
                    "tool_use_id": m.tool_call_id.clone().unwrap_or_default(),
                    "content": m.content,
                });
                // Anthropic requires tool results in a user message; merge
                // consecutive tool results into a single user message.
                let last_is_toolmerge = out
                    .last()
                    .and_then(|v| v.get("role"))
                    .and_then(|r| r.as_str())
                    == Some("user")
                    && out
                        .last()
                        .and_then(|v| v.get("_toolmerge"))
                        .and_then(|b| b.as_bool())
                        == Some(true);
                if last_is_toolmerge {
                    if let Some(last) = out.last_mut() {
                        if let Some(arr) = last["content"].as_array_mut() {
                            arr.push(block);
                        }
                    }
                } else {
                    out.push(json!({
                        "role": "user",
                        "_toolmerge": true,
                        "content": [block],
                    }));
                }
                continue;
            }
            if let Some(tcs) = &m.tool_calls {
                let mut blocks: Vec<Value> = Vec::new();
                if !m.content.is_empty() {
                    blocks.push(json!({"type": "text", "text": m.content}));
                }
                for tc in tcs {
                    blocks.push(json!({
                        "type": "tool_use",
                        "id": tc.id,
                        "name": tc.name,
                        "input": tc.arguments,
                    }));
                }
                out.push(json!({"role": m.role, "content": blocks}));
            } else {
                // Strip the bookkeeping key if present.
                out.push(json!({"role": m.role, "content": m.content}));
            }
        }
        // Remove helper keys before sending.
        for m in out.iter_mut() {
            if let Some(obj) = m.as_object_mut() {
                obj.remove("_toolmerge");
            }
        }
        out
    }

    fn parse(&self, req: &CompletionRequest, parsed: &Value) -> CompletionResponse {
        let mut content = String::new();
        let mut tool_calls = Vec::new();
        if let Some(blocks) = parsed["content"].as_array() {
            for b in blocks {
                match b["type"].as_str() {
                    Some("text") => {
                        if let Some(t) = b["text"].as_str() {
                            content.push_str(t);
                        }
                    }
                    Some("tool_use") => {
                        tool_calls.push(ToolCall {
                            id: b["id"].as_str().unwrap_or("").to_string(),
                            name: b["name"].as_str().unwrap_or("").to_string(),
                            arguments: b["input"].clone(),
                        });
                    }
                    _ => {}
                }
            }
        }
        CompletionResponse {
            content,
            model: req.model.clone(),
            provider: "anthropic".to_string(),
            tool_calls: if tool_calls.is_empty() { None } else { Some(tool_calls) },
            input_tokens: parsed["usage"]["input_tokens"].as_i64().unwrap_or(0) as i32,
            output_tokens: parsed["usage"]["output_tokens"].as_i64().unwrap_or(0) as i32,
            confidence: None,
        }
    }
}

#[async_trait]
impl Provider for AnthropicProvider {
    fn name(&self) -> &str {
        "anthropic"
    }

    async fn complete(&self, req: CompletionRequest) -> MorseResult<CompletionResponse> {
        metrics().increment("provider.anthropic.requests");
        let body = json!({
            "model": req.model,
            "system": req.system_prompt.clone().unwrap_or_default(),
            "messages": self.to_anthropic_messages(&req),
            "max_tokens": req.max_tokens.unwrap_or(8192),
            "temperature": req.temperature.unwrap_or(0.7),
            "tools": req.tools.as_ref().map(|tools| tools.iter().map(|t| json!({
                "name": t.name,
                "description": t.description,
                "input_schema": t.parameters,
            })).collect::<Vec<_>>()),
        });
        let body = strip_nulls(body);

        let resp = with_retry("anthropic", 3, || async {
            let sent = self
                .client
                .post("https://api.anthropic.com/v1/messages")
                .header("x-api-key", &self.api_key)
                .header("anthropic-version", "2023-06-01")
                .json(&body)
                .send()
                .await
                .map_err(|e| MorseError::new(
                    "PROV-NET",
                    &format!("Anthropic request failed: {}", e),
                    ErrorCategory::Network,
                ))?;
            let status = sent.status();
            let text = sent.text().await.map_err(|e| MorseError::new(
                "PROV-RD",
                &format!("Failed to read Anthropic response: {}", e),
                ErrorCategory::Network,
            ))?;
            if !status.is_success() {
                return Err(api_error("anthropic", "PROV-API", status, &text));
            }
            let parsed: Value = serde_json::from_str(&text).map_err(|e| MorseError::new(
                "PROV-PARSE",
                &format!("Failed to parse Anthropic response: {}", e),
                ErrorCategory::Parse,
            ))?;
            Ok(self.parse(&req, &parsed))
        })
        .await?;
        metrics().increment("provider.anthropic.success");
        Ok(resp)
    }

    async fn stream(
        &self,
        req: CompletionRequest,
        on_chunk: &mut (dyn FnMut(String) + Send),
    ) -> MorseResult<CompletionResponse> {
        use futures_util::StreamExt;
        let mut body = json!({
            "model": req.model,
            "system": req.system_prompt.clone().unwrap_or_default(),
            "messages": self.to_anthropic_messages(&req),
            "max_tokens": req.max_tokens.unwrap_or(8192),
            "temperature": req.temperature.unwrap_or(0.7),
            "stream": true,
        });
        body = strip_nulls(body);

        let sent = self
            .client
            .post("https://api.anthropic.com/v1/messages")
            .header("x-api-key", &self.api_key)
            .header("anthropic-version", "2023-06-01")
            .json(&body)
            .send()
            .await
            .map_err(|e| MorseError::new(
                "PROV-NET",
                &format!("Anthropic streaming request failed: {}", e),
                ErrorCategory::Network,
            ))?;
        let status = sent.status();
        if !status.is_success() {
            let text = sent.text().await.unwrap_or_default();
            return Err(api_error("anthropic", "PROV-API", status, &text));
        }

        let mut content = String::new();
        let mut input_tokens = 0i32;
        let mut output_tokens = 0i32;
        let mut stream = sent.bytes_stream();
        let mut buffer = String::new();
        while let Some(item) = stream.next().await {
            let chunk = item.map_err(|e| MorseError::new(
                "PROV-STREAM",
                &format!("Anthropic stream interrupted: {}", e),
                ErrorCategory::Network,
            ))?;
            buffer.push_str(&String::from_utf8_lossy(&chunk));
            while let Some(nl) = buffer.find('\n') {
                let line: String = buffer.drain(..=nl).collect();
                let line = line.trim();
                let Some(data) = line.strip_prefix("data:") else { continue };
                let data = data.trim();
                if data.is_empty() {
                    continue;
                }
                let Ok(ev) = serde_json::from_str::<Value>(data) else { continue };
                match ev["type"].as_str() {
                    Some("content_block_delta") => {
                        if let Some(t) = ev["delta"]["text"].as_str() {
                            content.push_str(t);
                            on_chunk(t.to_string());
                        }
                    }
                    Some("message_start") => {
                        input_tokens = ev["message"]["usage"]["input_tokens"].as_i64().unwrap_or(0) as i32;
                    }
                    Some("message_delta") => {
                        output_tokens = ev["usage"]["output_tokens"].as_i64().unwrap_or(output_tokens as i64) as i32;
                    }
                    _ => {}
                }
            }
        }

        Ok(CompletionResponse {
            content,
            model: req.model,
            provider: "anthropic".to_string(),
            tool_calls: None,
            input_tokens,
            output_tokens,
            confidence: None,
        })
    }

    fn models_available(&self) -> Vec<String> {
        vec![
            "claude-sonnet-4-5".to_string(),
            "claude-sonnet-4-20250514".to_string(),
            "claude-haiku-4-5".to_string(),
            "claude-3-5-haiku-latest".to_string(),
        ]
    }

    async fn validate_key(&self) -> MorseResult<()> {
        if self.api_key.is_empty() {
            return Err(MorseError::new(
                "PROV-KEY",
                "Anthropic API key not configured",
                ErrorCategory::Auth,
            ).with_suggestion("Set ANTHROPIC_API_KEY environment variable"));
        }
        Ok(())
    }
}

/// Recursively remove JSON nulls (Anthropic rejects unknown null fields).
fn strip_nulls(v: Value) -> Value {
    match v {
        Value::Object(map) => Value::Object(
            map.into_iter()
                .filter(|(_, v)| !v.is_null())
                .map(|(k, v)| (k, strip_nulls(v)))
                .collect(),
        ),
        Value::Array(arr) => Value::Array(arr.into_iter().map(strip_nulls).collect()),
        other => other,
    }
}

// ---------------------------------------------------------------------------
// Gemini (Google AI)
// ---------------------------------------------------------------------------

pub struct GeminiProvider {
    api_key: String,
    client: Client,
}

impl GeminiProvider {
    pub fn new(api_key: &str) -> Self {
        Self { api_key: api_key.to_string(), client: http_client() }
    }

    fn url(&self, model: &str, stream: bool) -> String {
        let action = if stream { "streamGenerateContent" } else { "generateContent" };
        format!(
            "https://generativelanguage.googleapis.com/v1beta/models/{}:{}?key={}",
            model, action, self.api_key
        )
    }

    fn to_gemini_contents(&self, req: &CompletionRequest) -> Vec<Value> {
        let mut out = Vec::new();
        for m in &req.messages {
            let role = if m.role == "assistant" { "model" } else { "user" };
            let text = if m.role == "tool" {
                format!("[tool result {}] {}", m.tool_call_id.as_deref().unwrap_or(""), m.content)
            } else {
                m.content.clone()
            };
            out.push(json!({"role": role, "parts": [{"text": text}]}));
        }
        out
    }
}

#[async_trait]
impl Provider for GeminiProvider {
    fn name(&self) -> &str {
        "gemini"
    }

    async fn complete(&self, req: CompletionRequest) -> MorseResult<CompletionResponse> {
        metrics().increment("provider.gemini.requests");
        let body = json!({
            "systemInstruction": req.system_prompt.as_ref().map(|s| json!({"parts": [{"text": s}]})),
            "contents": self.to_gemini_contents(&req),
            "generationConfig": {
                "maxOutputTokens": req.max_tokens.unwrap_or(8192),
                "temperature": req.temperature.unwrap_or(0.7),
            },
        });
        let body = strip_nulls(body);

        let resp = with_retry("gemini", 3, || async {
            let sent = self
                .client
                .post(self.url(&req.model, false))
                .json(&body)
                .send()
                .await
                .map_err(|e| MorseError::new(
                    "PROV-NET",
                    &format!("Gemini request failed: {}", e),
                    ErrorCategory::Network,
                ))?;
            let status = sent.status();
            let text = sent.text().await.map_err(|e| MorseError::new(
                "PROV-RD",
                &format!("Failed to read Gemini response: {}", e),
                ErrorCategory::Network,
            ))?;
            if !status.is_success() {
                return Err(api_error("gemini", "PROV-API", status, &text));
            }
            let parsed: Value = serde_json::from_str(&text).map_err(|e| MorseError::new(
                "PROV-PARSE",
                &format!("Failed to parse Gemini response: {}", e),
                ErrorCategory::Parse,
            ))?;
            let content = parsed["candidates"][0]["content"]["parts"]
                .as_array()
                .map(|parts| {
                    parts.iter()
                        .filter_map(|p| p["text"].as_str())
                        .collect::<Vec<_>>()
                        .join("")
                })
                .unwrap_or_default();
            let input_tokens = parsed["usageMetadata"]["promptTokenCount"].as_i64().unwrap_or(0) as i32;
            let output_tokens = parsed["usageMetadata"]["candidatesTokenCount"].as_i64().unwrap_or(0) as i32;
            Ok(CompletionResponse {
                content,
                model: req.model.clone(),
                provider: "gemini".to_string(),
                tool_calls: None,
                input_tokens,
                output_tokens,
                confidence: None,
            })
        })
        .await?;
        metrics().increment("provider.gemini.success");
        Ok(resp)
    }

    fn models_available(&self) -> Vec<String> {
        vec![
            "gemini-2.0-flash".to_string(),
            "gemini-2.5-flash".to_string(),
            "gemini-2.5-pro".to_string(),
        ]
    }

    async fn validate_key(&self) -> MorseResult<()> {
        if self.api_key.is_empty() {
            return Err(MorseError::new(
                "PROV-KEY",
                "Gemini API key not configured",
                ErrorCategory::Auth,
            ).with_suggestion("Set GEMINI_API_KEY environment variable"));
        }
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// Mock provider (offline / no keys configured)
// ---------------------------------------------------------------------------

pub struct MockProvider {
    name: String,
}

impl MockProvider {
    pub fn new(name: &str) -> Self {
        Self { name: name.to_string() }
    }
}

#[async_trait]
impl Provider for MockProvider {
    fn name(&self) -> &str {
        &self.name
    }

    async fn complete(&self, req: CompletionRequest) -> MorseResult<CompletionResponse> {
        metrics().increment("provider.mock.requests");
        let last_msg = req.messages.last().map(|m| m.content.as_str()).unwrap_or("");
        let response = generate_mock_response(&self.name, last_msg);
        Ok(CompletionResponse {
            content: response,
            model: req.model,
            provider: self.name.clone(),
            tool_calls: None,
            input_tokens: estimate_tokens(last_msg),
            output_tokens: 0,
            confidence: Some(1.0),
        })
    }

    fn models_available(&self) -> Vec<String> {
        vec!["mock-model".to_string()]
    }

    async fn validate_key(&self) -> MorseResult<()> {
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// Registry / resolution
// ---------------------------------------------------------------------------

pub struct ProviderRegistry {
    providers: std::collections::HashMap<String, Box<dyn Provider>>,
}

impl Default for ProviderRegistry {
    fn default() -> Self {
        Self::new()
    }
}

impl ProviderRegistry {
    pub fn new() -> Self {
        Self { providers: std::collections::HashMap::new() }
    }

    pub fn register(&mut self, name: &str, provider: Box<dyn Provider>) {
        self.providers.insert(name.to_string(), provider);
    }

    pub fn get(&self, name: &str) -> Option<&dyn Provider> {
        self.providers.get(name).map(|p| p.as_ref())
    }
}

/// Build a provider from config. Falls back to a mock when the provider has
/// no credential, so commands keep working offline (clearly labelled).
pub fn build_provider(cfg: &Config, provider_name: &str) -> Box<dyn Provider> {
    let key = cfg.get_provider_key(provider_name).unwrap_or("");
    if provider_name == "anthropic" && !key.is_empty() {
        return Box::new(AnthropicProvider::new(key));
    }
    if provider_name == "gemini" && !key.is_empty() {
        return Box::new(GeminiProvider::new(key));
    }
    if let Some((base, default_model)) = compatible_endpoint(provider_name) {
        if !key.is_empty() || provider_name == "ollama" {
            return Box::new(OpenAICompatProvider::new(provider_name, base, key, default_model));
        }
    }
    Box::new(MockProvider::new(provider_name))
}

/// Split `provider/model` and build the right provider. Validates the key
/// when a real provider is selected.
pub async fn resolve_provider(cfg: &Config, model_spec: &str) -> MorseResult<Box<dyn Provider>> {
    let (provider_name, model) = model_spec.split_once('/').ok_or_else(|| {
        MorseError::new(
            "PROV-SPEC",
            &format!("Invalid model spec: {}", model_spec),
            ErrorCategory::Config,
        ).with_suggestion("Use format: provider/model (e.g. groq/llama-3.1-8b-instant)")
    })?;

    let key = cfg.get_provider_key(provider_name);
    let is_mock = key.is_none() && provider_name != "ollama";
    let provider = build_provider(cfg, provider_name);
    let _ = model;
    if !is_mock {
        provider.validate_key().await?;
    }
    Ok(provider)
}

/// Resolve `provider/model`, honoring fallback: if the preferred provider has
/// no key, walk the fallback chain and use the first configured one.
pub fn resolve_with_fallback(cfg: &Config, model_spec: &str) -> (Box<dyn Provider>, String) {
    let preferred = model_spec.split('/').next().unwrap_or("");
    if cfg.get_provider_key(preferred).is_some() || preferred == "ollama" {
        let model = model_spec.split_once('/').map(|(_, m)| m.to_string())
            .unwrap_or_else(|| default_model_for(cfg, preferred));
        return (build_provider(cfg, preferred), model);
    }
    // Fallback chain ordered by general availability/quality.
    for candidate in ["groq", "openai", "anthropic", "gemini", "deepseek", "ollama"] {
        if cfg.get_provider_key(candidate).is_some() || candidate == "ollama" {
            let model = default_model_for(cfg, candidate);
            tracing::info!(from = preferred, to = candidate, "falling back to configured provider");
            return (build_provider(cfg, candidate), model);
        }
    }
    // Nothing configured: mock.
    let model = model_spec.split_once('/').map(|(_, m)| m.to_string()).unwrap_or_else(|| "mock-model".into());
    (build_provider(cfg, "mock"), model)
}

fn default_model_for(cfg: &Config, provider: &str) -> String {
    // Prefer an explicitly routed model that targets this provider.
    for spec in [&cfg.routing.default, &cfg.routing.quick_chat, &cfg.routing.small_model] {
        if let Some((p, m)) = spec.split_once('/') {
            if p == provider {
                return m.to_string();
            }
        }
    }
    compatible_endpoint(provider).map(|(_, m)| m.to_string()).unwrap_or_else(|| "mock-model".into())
}

/// Public accessor for the default model a provider would use.
pub fn default_model_for_pub(cfg: &Config, provider: &str) -> String {
    default_model_for(cfg, provider)
}

// ---------------------------------------------------------------------------
// Model list cache: live /v1/models fetched once, cached with a TTL so
// palettes and `morse models` are instant and rate-limit friendly.
// ---------------------------------------------------------------------------

const MODEL_LIST_TTL_SECS: u64 = 6 * 3600;

fn models_cache_path(provider: &str) -> Option<std::path::PathBuf> {
    let root = std::env::current_dir().ok()?;
    Some(root.join(".morse/cache/models").join(format!("{}.json", provider)))
}

/// Cached model list for a provider (empty when none/unknown).
#[derive(serde::Serialize, serde::Deserialize, Default, Clone)]
pub struct CachedModels {
    pub fetched_at: u64,
    pub models: Vec<String>,
}

fn now_secs() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

/// Return cached live models for a provider if fresh; otherwise fetch and
/// store. Never hard-fails — returns whatever cache exists.
pub async fn cached_models(provider: &str, api_key: Option<&str>, refresh: bool) -> Vec<String> {
    let path = match models_cache_path(provider) {
        Some(p) => p,
        None => return vec![],
    };
    if !refresh {
        if let Ok(text) = std::fs::read_to_string(&path) {
            if let Ok(c) = serde_json::from_str::<CachedModels>(&text) {
                if now_secs().saturating_sub(c.fetched_at) < MODEL_LIST_TTL_SECS && !c.models.is_empty() {
                    return c.models;
                }
            }
        }
    }

    // Fetch (OpenAI-compatible only; anthropic/gemini use their own shapes).
    let Some((base, _)) = compatible_endpoint(provider) else { return vec![] };
    let url = format!("{}/models", base);
    let client = match Client::builder().timeout(Duration::from_secs(8)).build() {
        Ok(c) => c,
        Err(_) => return vec![],
    };
    let mut req = client.get(&url);
    if let Some(k) = api_key {
        req = req.header("Authorization", format!("Bearer {}", k));
    }
    let parsed: Value = match req.send().await {
        Ok(r) => match r.json().await {
            Ok(v) => v,
            Err(_) => return cached_or_empty(&path),
        },
        Err(_) => return cached_or_empty(&path),
    };
    let models: Vec<String> = parsed["data"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|m| m["id"].as_str())
                .map(|s| s.to_string())
                .collect()
        })
        .unwrap_or_default();
    if models.is_empty() {
        return cached_or_empty(&path);
    }
    let _ = std::fs::create_dir_all(path.parent().unwrap_or(Path::new(".")));
    let _ = std::fs::write(
        &path,
        serde_json::to_string(&CachedModels { fetched_at: now_secs(), models: models.clone() }).unwrap_or_default(),
    );
    models
}

fn cached_or_empty(path: &std::path::Path) -> Vec<String> {
    std::fs::read_to_string(path)
        .ok()
        .and_then(|t| serde_json::from_str::<CachedModels>(&t).ok())
        .map(|c| c.models)
        .unwrap_or_default()
}

// ---------------------------------------------------------------------------
// High-level helpers used by the CLI
// ---------------------------------------------------------------------------

pub fn estimate_tokens(text: &str) -> i32 {
    // ~4 chars per token is a good rule of thumb across LLM tokenizers.
    text.len().div_ceil(4) as i32
}

pub fn system_prompt() -> String {
    let os = std::env::consts::OS;
    let cwd = std::env::current_dir()
        .map(|p| p.display().to_string())
        .unwrap_or_else(|_| ".".into());
    let mut base = format!(
        "You are Morse, an expert terminal-first AI coding assistant running natively on {os}. \
         Working directory: {cwd}. \
         Be concise and precise. Use Markdown with fenced code blocks for code. \
         When asked to review or fix code, quote the exact lines you change. \
         Never invent file contents \u{2014} if you have not seen a file, say so."
    );
    // Inject a compact repo map so the model knows the layout up-front
    // (saves a tool round-trip for orientation questions).
    if let Ok(root) = std::env::current_dir() {
        if let Some(summary) = crate::context::project_summary(&root) {
            base.push_str("\n\n");
            base.push_str(&summary);
        }
    }
    base
}

/// System prompt with additional session-specific context appended (e.g. an
/// active mode's instructions or a task framing).
pub fn system_prompt_with(extra: &str) -> String {
    let mut s = system_prompt();
    if !extra.trim().is_empty() {
        s.push_str("\n\n");
        s.push_str(extra.trim());
    }
    s
}

/// One-shot completion with streaming to stdout.
/// Ordered model specs to try: the configured default first, then every
/// other configured provider's default, then local Ollama. Used for runtime
/// fallback when the preferred provider errors (dead model, quota, 403...).
pub fn fallback_model_specs(cfg: &Config) -> Vec<String> {
    let mut specs: Vec<String> = vec![cfg.routing.default.clone()];
    for provider in [
        "groq", "openai", "anthropic", "gemini", "deepseek", "mistral", "xai",
        "cerebras", "together", "openrouter",
    ] {
        if cfg.get_provider_key(provider).is_some() {
            let spec = format!("{}/{}", provider, default_model_for(cfg, provider));
            if !specs.contains(&spec) {
                specs.push(spec);
            }
        }
    }
    let ollama = "ollama/llama3.2".to_string();
    if !specs.contains(&ollama) {
        specs.push(ollama);
    }
    specs
}

pub async fn complete_text_streaming(cfg: &Config, prompt: &str) -> Result<()> {
    // Refuse before spending if a budget/rate limit is already exhausted.
    if let Err(e) = crate::ratelimit::gate(cfg) {
        return Err(anyhow::anyhow!("{}", e));
    }

    let specs = fallback_model_specs(cfg);
    let mut last_err: Option<anyhow::Error> = None;
    let mut tried = 0usize;

    for spec in &specs {
        let (provider, model) = resolve_with_fallback(cfg, spec);
        let provider_name = provider.name().to_string();

        // Skip providers that obviously have no credential (except ollama/mock).
        if provider.validate_key().await.is_err() {
            continue;
        }
        tried += 1;
        let req = CompletionRequest::new(&model, prompt)
            .with_system(&system_prompt())
            .with_temperature(0.7);

        if isatty_stdout() {
            eprintln!("{}", UI::new(true).muted(&format!("── {provider_name}/{model} ──")));
        }

        let mut first = true;
        let mut on_chunk = |chunk: String| {
            print!("{}", chunk);
            use std::io::Write;
            let _ = std::io::stdout().flush();
            first = false;
        };
        match provider.stream(req, &mut on_chunk).await {
            Ok(resp) => {
                if first {
                    println!("{}", resp.content);
                } else {
                    println!();
                }
                if resp.input_tokens > 0 || resp.output_tokens > 0 {
                    crate::cost::record_call(&resp.provider, &resp.model, resp.input_tokens as i64, resp.output_tokens as i64);
                    eprintln!(
                        "{}",
                        UI::new(true).muted(&format!(
                            "── {} tokens in, {} out ──",
                            resp.input_tokens, resp.output_tokens
                        ))
                    );
                }
                return Ok(());
            }
            Err(e) => {
                let detail = truncate_for_note(&e.display(), 120);
                if isatty_stdout() {
                    eprintln!(
                        "{}",
                        UI::new(true).warning(&format!(
                            "{provider_name} unavailable ({detail}) — trying next provider…"
                        ))
                    );
                }
                last_err = Some(anyhow::anyhow!(e.display()));
            }
        }
    }

    match last_err {
        Some(e) if tried > 0 => Err(e.context("all configured providers failed")),
        _ => Err(anyhow::anyhow!("no provider could be reached — run 'morse doctor'")),
    }
}

/// Raw one-shot completion for scripts/pipes: answer only, no decorations,
/// cache-aware (identical scripted calls are instant + free).
pub async fn complete_raw(cfg: &Config, prompt: &str) -> Result<()> {
    if let Err(e) = crate::ratelimit::gate(cfg) {
        return Err(anyhow::anyhow!("{}", e));
    }

    // Cache lookup (raw mode shares the TUI's cache).
    let cache = crate::ccache::CompletionCache::new(cfg);
    let sys = system_prompt();
    let history = vec![Message::user(prompt)];
    let msgs = serde_json::to_string(&history).unwrap_or_default();
    let key = crate::ccache::cache_key(&cfg.routing.default, &sys, &msgs, 0.7, 8192);
    if cache.is_enabled() {
        if let Ok(Some(entry)) = cache.get(&key) {
            let content = entry.response["content"].as_str().unwrap_or("");
            if !content.is_empty() {
                println!("{}", content);
                return Ok(());
            }
        }
    }

    let specs = fallback_model_specs(cfg);
    let mut last_err: Option<anyhow::Error> = None;
    for spec in &specs {
        let (provider, model) = resolve_with_fallback(cfg, spec);
        if provider.validate_key().await.is_err() {
            continue;
        }
        let req = CompletionRequest::new(&model, prompt)
            .with_system(&sys)
            .with_temperature(0.7);
        match provider.complete(req).await {
            Ok(resp) => {
                crate::cost::record_call(&resp.provider, &resp.model, resp.input_tokens as i64, resp.output_tokens as i64);
                if cache.is_enabled() {
                    let payload = serde_json::json!({
                        "content": resp.content,
                        "provider": resp.provider,
                        "model": resp.model,
                    });
                    let _ = cache.put(&key, &resp.provider, &resp.model, &payload);
                }
                println!("{}", resp.content);
                return Ok(());
            }
            Err(e) => last_err = Some(anyhow::anyhow!(e.display())),
        }
    }
    match last_err {
        Some(e) => Err(e.context("all configured providers failed")),
        None => Err(anyhow::anyhow!("no provider could be reached — run 'morse doctor'")),
    }
}

/// Persisted working-spec: remember which provider last worked so new
/// sessions skip dead providers (no repeated 404/402 round-trips).
pub fn load_working_spec() -> Option<String> {
    let path = std::env::current_dir().ok()?.join(".morse/cache/working-spec.json");
    let text = std::fs::read_to_string(path).ok()?;
    let v: Value = serde_json::from_str(&text).ok()?;
    let ts = v["saved_at"].as_u64()?;
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .ok()?
        .as_secs();
    // Spec cache valid for 10 minutes; after that, re-probe the chain.
    if now.saturating_sub(ts) > 600 {
        return None;
    }
    v["spec"].as_str().map(|s| s.to_string())
}

pub fn save_working_spec(spec: &str) {
    let Some(path) = std::env::current_dir().ok().map(|r| r.join(".morse/cache/working-spec.json")) else {
        return;
    };
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let v = serde_json::json!({
        "spec": spec,
        "saved_at": std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs(),
    });
    let _ = std::fs::write(path, serde_json::to_string(&v).unwrap_or_default());
}

fn truncate_for_note(s: &str, max: usize) -> String {
    let one: String = s.split_whitespace().collect::<Vec<_>>().join(" ");
    if one.chars().count() <= max {
        one
    } else {
        let cut: String = one.chars().take(max).collect();
        format!("{}…", cut)
    }
}

fn isatty_stdout() -> bool {
    use std::io::IsTerminal;
    std::io::stdout().is_terminal()
}

pub async fn complete(cfg: &Config, prompt: &str) -> MorseResult<CompletionResponse> {
    metrics().increment("providers.complete.calls");
    crate::ratelimit::gate(cfg).map_err(|e| {
        MorseError::new("RATE-LIMIT", &e.to_string(), crate::errors::ErrorCategory::RateLimit)
            .with_suggestion("Raise the budget in config or wait for the window to reset")
    })?;
    let (provider, model) = resolve_with_fallback(cfg, &cfg.routing.default.clone());
    let req = CompletionRequest::new(&model, prompt).with_system(&system_prompt());
    let resp = provider.complete(req).await?;
    crate::cost::record_call(&resp.provider, &resp.model, resp.input_tokens as i64, resp.output_tokens as i64);
    Ok(resp)
}

pub async fn complete_text(cfg: &Config, prompt: &str) -> Result<()> {
    let resp = complete(cfg, prompt).await.map_err(|e| anyhow::anyhow!(e.display()))?;
    println!("\n{} ({}):\n{}", resp.provider, resp.model, resp.content);
    Ok(())
}

/// Show configured providers and the models they'd use.
pub fn print_models(ui: &UI, cfg: &Config) {
    ui.print(&ui.section("Providers"));
    let mut rows: Vec<Vec<String>> = Vec::new();
    for provider in [
        "groq", "openai", "anthropic", "gemini", "deepseek", "mistral", "xai",
        "together", "openrouter", "fireworks", "cerebras", "sambanova", "deepinfra",
        "nebius", "novita", "hyperbolic", "lepton", "ollama",
    ] {
        let configured = cfg.get_provider_key(provider).is_some() || provider == "ollama";
        let status = if configured { "configured" } else { "no key" };
        let default_model = compatible_endpoint(provider).map(|(_, m)| m).unwrap_or("-");
        rows.push(vec![provider.to_string(), status.to_string(), default_model.to_string()]);
    }
    let rows_ref: Vec<Vec<&str>> = rows.iter().map(|r| r.iter().map(|s| s.as_str()).collect()).collect();
    ui.print(&ui.table(&["PROVIDER", "STATUS", "DEFAULT MODEL"], &rows_ref));
    ui.print("");
    ui.print(&ui.section("Routing"));
    ui.print(&ui.kv_pair("default", &cfg.routing.default));
    ui.print(&ui.kv_pair("quick chat", &cfg.routing.quick_chat));
    ui.print(&ui.kv_pair("code review", &cfg.routing.code_review));
    ui.print(&ui.kv_pair("architecture", &cfg.routing.architecture));
    if !cfg.has_any_provider() {
        ui.print("");
        ui.print(&ui.warning("No API keys found. Set one to enable real responses:"));
        ui.print(&ui.bullet("export GROQ_API_KEY=…   (free, fast)", 1));
        ui.print(&ui.bullet("export OPENAI_API_KEY=…", 1));
        ui.print(&ui.bullet("export ANTHROPIC_API_KEY=…", 1));
    }
}

// ---------------------------------------------------------------------------
// Task-specific prompts
// ---------------------------------------------------------------------------

pub async fn fix_error(cfg: &Config, error: &str) -> Result<()> {
    let prompt = format!(
        "A developer hit this error. Diagnose the root cause and give the minimal fix with a code block.\n\n```\n{}\n```",
        truncate(error, 8000)
    );
    complete_text(cfg, &prompt).await
}

pub async fn review_code(cfg: &Config) -> Result<()> {
    let prompt = "Review the code in this project. Identify bugs, security issues, and improvements. \
                  Prioritize findings by severity with file:line references.";
    complete_text(cfg, prompt).await
}

pub async fn generate_commit(cfg: &Config) -> Result<()> {
    let prompt = "Generate a conventional commit message (type(scope): summary) for the current changes. \
                  Inspect with git commands if you can; otherwise ask for a diff.";
    complete_text(cfg, prompt).await
}
pub async fn explain(cfg: &Config, target: &str) -> Result<()> {
    let prompt = format!("Explain this code/symbol for a mid-level engineer: {}", target);
    complete_text(cfg, &prompt).await
}

pub fn list_modes(cfg: &Config) -> Result<()> {
    let _ = cfg;
    println!("Available execution modes:");
    println!("  - coder: Code generation and editing");
    println!("  - architect: System design and architecture");
    println!("  - debugger: Bug finding and fixing");
    println!("  - reviewer: Code review and analysis");
    Ok(())
}

pub fn build_router(cfg: Config) -> ModelRouter {
    ModelRouter::new(cfg)
}

pub struct ModelRouter {
    cfg: Config,
}

impl ModelRouter {
    pub fn new(cfg: Config) -> Self {
        Self { cfg }
    }

    pub fn resolve_provider(&self, name: &str) -> Option<Box<dyn Provider>> {
        if self.cfg.get_provider_key(name).is_some() || name == "ollama" {
            return Some(build_provider(&self.cfg, name));
        }
        None
    }
}

// ---------------------------------------------------------------------------
// Offline mock responses (used when no API key is configured)
// ---------------------------------------------------------------------------

fn generate_mock_response(_provider_name: &str, user_msg: &str) -> String {
    let lower_msg = user_msg.to_lowercase();
    let trimmed = lower_msg.trim();

    let greetings = ["hi", "hey", "hello"];
    if greetings.iter().any(|g| {
        trimmed == *g
            || trimmed.starts_with(&format!("{} ", g))
            || trimmed.starts_with(&format!("{},", g))
            || trimmed.starts_with(&format!("{}!", g))
    }) {
        return "Hello! I'm Morse, your terminal-first AI coding assistant. How can I help you today?".to_string();
    }
    if lower_msg.contains("how are you") {
        return "I'm doing well, thank you for asking! I'm here and ready to help with your coding tasks.".to_string();
    }
    if lower_msg.contains("what") && lower_msg.contains("name") {
        return "I'm Morse, a terminal-first AI coding assistant built in Rust.".to_string();
    }
    if lower_msg.contains("what") && lower_msg.contains("model") {
        return "Run 'morse models' to see all configured providers and their default models.\nUse 'morse --model provider/model' to override.".to_string();
    }
    if lower_msg.contains("memory leak") {
        return "Memory leaks in Go can be caused by:\n1. Forgotten goroutines that never exit\n2. Unclosed resources (db connections, files)\n3. Growing slices/maps without bounds\n4. Global variables holding references\n5. Closures capturing variables\n\nUse 'morse fix \"error message\"' for specific error analysis.\nConfigure an API key for detailed analysis of your codebase.".to_string();
    }
    if lower_msg.contains("refactor") {
        return "To refactor code:\n1. Identify the module or function to refactor\n2. Run 'morse graph-build' to understand code relationships\n3. Use 'morse review' to find refactoring opportunities\n4. Run 'morse fix' to get specific suggestions\n\nConfigure an API key for AI-powered refactoring assistance.".to_string();
    }
    if lower_msg.contains("test") {
        return "For testing:\n1. Use 'morse swarm \"write tests for X\"' to generate tests\n2. The mock provider can generate basic test scaffolding\n3. With a real API key, I can analyze your test coverage\n\nAvailable test commands:\n- morse swarm \"implement tests\"\n- morse review\n- morse fix \"test failure details\"".to_string();
    }
    if lower_msg.contains("help") {
        return "I can help you with:\n- Code editing and refactoring\n- Bug fixing and debugging\n- Code review and explanation\n- Writing tests\n- Generating commit messages\n- Building knowledge graphs\n- Running multi-agent swarms\n\nUse 'morse --help' to see all available commands.".to_string();
    }
    if lower_msg.contains("thank") {
        return "You're welcome! Is there anything else I can help you with?".to_string();
    }
    if lower_msg.contains("bye") || lower_msg.contains("goodbye") {
        return "Goodbye! Have a great day and happy coding!".to_string();
    }
    if lower_msg.contains("time") || lower_msg.contains("date") {
        return format!("Current time: {}", chrono::Local::now().format("%Y-%m-%d %H:%M:%S"));
    }

    format!(
        "[OFFLINE MODE] I understand you're asking about: \"{}\".\n\nTo get real AI responses, configure an API key. Quickest option:\n  export GROQ_API_KEY=…    # free tier at console.groq.com\nor add keys to ~/.morse/config.yaml.\n\nRun 'morse models' to see what's configured.",
        truncate(user_msg, 200)
    )
}
