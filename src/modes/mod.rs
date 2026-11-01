use crate::config::Config;
use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomMode {
    pub name: String,
    pub description: String,
    pub system_prompt: String,
    pub tools: Vec<String>,
    pub model: String,
    pub temperature: f64,
    pub max_tokens: i32,
}

pub struct ModeManager {
    modes: HashMap<String, CustomMode>,
    current_mode: Option<String>,
}

impl Default for ModeManager {
    fn default() -> Self {
        Self::new()
    }
}

impl ModeManager {
    pub fn new() -> Self {
        let mut modes = HashMap::new();

        modes.insert("coder".to_string(), CustomMode {
            name: "coder".to_string(),
            description: "Code generation and editing".to_string(),
            system_prompt: "You are an expert software engineer. Write clean, well-documented, production-quality code.".to_string(),
            tools: vec!["read_file".to_string(), "write_file".to_string(), "edit_file".to_string(), "grep".to_string(), "glob".to_string()],
            model: "anthropic/claude-sonnet-4-5".to_string(),
            temperature: 0.3,
            max_tokens: 8192,
        });

        modes.insert("architect".to_string(), CustomMode {
            name: "architect".to_string(),
            description: "System design and architecture".to_string(),
            system_prompt: "You are a software architect. Design scalable, maintainable systems and justify trade-offs.".to_string(),
            tools: vec!["read_file".to_string(), "grep".to_string(), "glob".to_string(), "list_dir".to_string()],
            model: "anthropic/claude-sonnet-4-5".to_string(),
            temperature: 0.5,
            max_tokens: 8192,
        });

        modes.insert("debugger".to_string(), CustomMode {
            name: "debugger".to_string(),
            description: "Bug finding and fixing".to_string(),
            system_prompt: "You are a debugging expert. Find root causes, not symptoms, and fix bugs efficiently.".to_string(),
            tools: vec!["read_file".to_string(), "grep".to_string(), "bash".to_string(), "edit_file".to_string()],
            model: "anthropic/claude-sonnet-4-5".to_string(),
            temperature: 0.2,
            max_tokens: 8192,
        });

        modes.insert("reviewer".to_string(), CustomMode {
            name: "reviewer".to_string(),
            description: "Code review and analysis".to_string(),
            system_prompt: "You are a senior code reviewer. Identify bugs, security issues, and improvements ranked by severity with file:line references.".to_string(),
            tools: vec!["read_file".to_string(), "grep".to_string(), "glob".to_string()],
            model: "anthropic/claude-haiku-4-5".to_string(),
            temperature: 0.1,
            max_tokens: 8192,
        });

        modes.insert("explainer".to_string(), CustomMode {
            name: "explainer".to_string(),
            description: "Teach and explain concepts".to_string(),
            system_prompt: "You are a patient teacher. Explain concepts clearly with analogies and examples, pitched to the reader's level.".to_string(),
            tools: vec!["read_file".to_string(), "grep".to_string()],
            model: "groq/openai/gpt-oss-120b".to_string(),
            temperature: 0.6,
            max_tokens: 8192,
        });

        Self { modes, current_mode: None }
    }

    pub fn get_mode(&self, name: &str) -> Option<&CustomMode> {
        self.modes.get(name)
    }

    pub fn list_modes(&self) -> Vec<&CustomMode> {
        self.modes.values().collect()
    }

    pub fn set_current(&mut self, name: &str) {
        if self.modes.contains_key(name) {
            self.current_mode = Some(name.to_string());
        }
    }

    pub fn current(&self) -> Option<&CustomMode> {
        self.current_mode.as_deref().and_then(|n| self.modes.get(n))
    }
}

pub fn run(cfg: &Config) -> Result<()> {
    let _ = cfg;
    let manager = ModeManager::new();

    println!("Custom Modes (apply one with 'morse --mode <name>'):\n");
    let mut names: Vec<&CustomMode> = manager.list_modes();
    names.sort_by(|a, b| a.name.cmp(&b.name));
    for mode in names {
        println!("  {:<12} {}", mode.name, mode.description);
        println!("      model {} · temp {} · {} tools", mode.model, mode.temperature, mode.tools.len());
    }
    Ok(())
}

pub fn get_mode<'a>(manager: &'a ModeManager, name: &str) -> Option<&'a CustomMode> {
    manager.get_mode(name)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builtin_modes_exist_and_are_current() {
        let m = ModeManager::new();
        for name in ["coder", "architect", "debugger", "reviewer", "explainer"] {
            let mode = m.get_mode(name).unwrap_or_else(|| panic!("missing mode {}", name));
            assert!(!mode.system_prompt.is_empty());
            assert!(!mode.tools.is_empty(), "mode {} needs tools", name);
            assert!(mode.max_tokens >= 4096);
        }
        // No dead model names.
        for mode in m.list_modes() {
            assert!(!mode.model.contains("claude-3"), "stale model in {}: {}", mode.name, mode.model);
        }
    }

    #[test]
    fn set_current_and_get() {
        let mut m = ModeManager::new();
        m.set_current("debugger");
        assert_eq!(m.current().unwrap().name, "debugger");
        m.set_current("nonexistent");
        assert_eq!(m.current().unwrap().name, "debugger", "invalid name ignored");
    }
}
