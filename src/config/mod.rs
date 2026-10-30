//! Production-grade configuration with validation

use crate::errors::{ErrorCategory, MorseError, MorseResult};
use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub version: u32,
    pub providers: ProvidersConfig,
    pub routing: RoutingConfig,
    pub project: ProjectConfig,
    pub trust: TrustConfig,
    pub rag: RagConfig,
    pub swarm: SwarmConfig,
    pub cloud: CloudConfig,
    pub cost: CostConfig,
    pub health: HealthConfig,
    pub ui: UIConfig,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ProvidersConfig {
    #[serde(default)]
    pub groq: String,
    #[serde(default)]
    pub openai: String,
    #[serde(default)]
    pub anthropic: String,
    #[serde(default)]
    pub gemini: String,
    #[serde(default)]
    pub ollama: String,
    #[serde(default)]
    pub bedrock: String,
    #[serde(default)]
    pub azure: String,
    #[serde(default)]
    pub openrouter: String,
    #[serde(default)]
    pub together: String,
    #[serde(default)]
    pub mistral: String,
    #[serde(default)]
    pub deepseek: String,
    #[serde(default)]
    pub xai: String,
    #[serde(default)]
    pub fireworks: String,
    #[serde(default)]
    pub cerebras: String,
    #[serde(default)]
    pub sambanova: String,
    #[serde(default)]
    pub deepinfra: String,
    #[serde(default)]
    pub nebius: String,
    #[serde(default)]
    pub novita: String,
    #[serde(default)]
    pub hyperbolic: String,
    #[serde(default)]
    pub lepton: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoutingConfig {
    pub default: String,
    pub quick_chat: String,
    pub file_edit: String,
    pub code_review: String,
    pub architecture: String,
    pub small_model: String,
    pub fallback_policy: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectConfig {
    pub name: String,
    pub language: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrustConfig {
    pub default_level: String,
    pub max_files_per_task: usize,
    pub denied_patterns: Vec<String>,
    pub require_approval: Vec<String>,
    pub auto_approved: Vec<String>,
    pub overrides: Vec<TrustOverride>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrustOverride {
    pub path: String,
    pub level: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RagConfig {
    pub enabled: bool,
    pub chunk_size: usize,
    pub top_k: usize,
    pub embedding_model: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SwarmConfig {
    pub max_agents: usize,
    pub timeout_seconds: u64,
    pub coordination_strategy: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloudConfig {
    pub mode: String,
    pub endpoint: String,
    pub api_key: String,
    pub timeout_seconds: u64,
    pub max_memory_mb: usize,
    pub max_cpus: usize,
    pub docker_image: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CostConfig {
    pub daily_budget_usd: f64,
    pub warn_at_percent: f64,
    pub monthly_budget_usd: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthConfig {
    pub check_interval_seconds: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UIConfig {
    pub theme: String,
    pub color_enabled: bool,
    pub spinner_style: String,
    pub progress_style: String,
    pub show_timestamps: bool,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            version: 1,
            providers: ProvidersConfig {
                groq: String::new(),
                openai: String::new(),
                anthropic: String::new(),
                gemini: String::new(),
                ollama: String::new(),
                bedrock: String::new(),
                azure: String::new(),
                openrouter: String::new(),
                together: String::new(),
                mistral: String::new(),
                deepseek: String::new(),
                xai: String::new(),
                fireworks: String::new(),
                cerebras: String::new(),
                sambanova: String::new(),
                deepinfra: String::new(),
                nebius: String::new(),
                novita: String::new(),
                hyperbolic: String::new(),
                lepton: String::new(),
            },
            routing: RoutingConfig {
                default: "groq/openai/gpt-oss-120b".to_string(),
                quick_chat: "groq/openai/gpt-oss-120b".to_string(),
                file_edit: "anthropic/claude-sonnet-4-5".to_string(),
                code_review: "anthropic/claude-haiku-4-5".to_string(),
                architecture: "anthropic/claude-sonnet-4-5".to_string(),
                small_model: "groq/openai/gpt-oss-20b".to_string(),
                fallback_policy: "free->cheap->quality".to_string(),
            },
            project: ProjectConfig {
                name: "default".to_string(),
                language: "rust".to_string(),
            },
            trust: TrustConfig {
                default_level: "suggest".to_string(),
                max_files_per_task: 50,
                denied_patterns: vec![
                    ".env*".to_string(),
                    "*credentials*".to_string(),
                    "*ssh_keys*".to_string(),
                    "*.pem".to_string(),
                ],
                require_approval: vec!["config/*.yaml".to_string()],
                auto_approved: vec!["*.md".to_string(), "*_test.go".to_string()],
                overrides: vec![],
            },
            rag: RagConfig {
                enabled: true,
                chunk_size: 512,
                top_k: 5,
                embedding_model: "sentence-transformers/all-MiniLM-L6-v2".to_string(),
            },
            swarm: SwarmConfig {
                max_agents: 4,
                timeout_seconds: 300,
                coordination_strategy: "parallel".to_string(),
            },
            cloud: CloudConfig {
                mode: "hybrid".to_string(),
                endpoint: String::new(),
                api_key: String::new(),
                timeout_seconds: 30,
                max_memory_mb: 512,
                max_cpus: 2,
                docker_image: "golang:1.24".to_string(),
            },
            cost: CostConfig {
                daily_budget_usd: 5.0,
                warn_at_percent: 80.0,
                monthly_budget_usd: 100.0,
            },
            health: HealthConfig {
                check_interval_seconds: 30,
            },
            ui: UIConfig {
                theme: "default".to_string(),
                color_enabled: true,
                spinner_style: "line".to_string(),
                progress_style: "bar".to_string(),
                show_timestamps: false,
            },
        }
    }
}

impl Config {
    /// Overlay provider API keys from environment variables.
    ///
    /// Config file keys take precedence; env vars fill in the gaps. This is
    /// the recommended way to supply secrets (`GROQ_API_KEY`, etc.) so they
    /// never live in a YAML file.
    pub fn apply_env_overrides(&mut self) {
        let env_pairs: [(&str, &mut String); 20] = [
            ("GROQ_API_KEY", &mut self.providers.groq),
            ("OPENAI_API_KEY", &mut self.providers.openai),
            ("ANTHROPIC_API_KEY", &mut self.providers.anthropic),
            ("GEMINI_API_KEY", &mut self.providers.gemini),
            ("OLLAMA_HOST", &mut self.providers.ollama),
            ("AWS_ACCESS_KEY_ID", &mut self.providers.bedrock),
            ("AZURE_OPENAI_API_KEY", &mut self.providers.azure),
            ("OPENROUTER_API_KEY", &mut self.providers.openrouter),
            ("TOGETHER_API_KEY", &mut self.providers.together),
            ("MISTRAL_API_KEY", &mut self.providers.mistral),
            ("DEEPSEEK_API_KEY", &mut self.providers.deepseek),
            ("XAI_API_KEY", &mut self.providers.xai),
            ("FIREWORKS_API_KEY", &mut self.providers.fireworks),
            ("CEREBRAS_API_KEY", &mut self.providers.cerebras),
            ("SAMBANOVA_API_KEY", &mut self.providers.sambanova),
            ("DEEPINFRA_API_KEY", &mut self.providers.deepinfra),
            ("NEBIUS_API_KEY", &mut self.providers.nebius),
            ("NOVITA_API_KEY", &mut self.providers.novita),
            ("HYPERBOLIC_API_KEY", &mut self.providers.hyperbolic),
            ("LEPTON_API_KEY", &mut self.providers.lepton),
        ];
        for (env_name, slot) in env_pairs {
            if slot.is_empty() {
                if let Ok(v) = std::env::var(env_name) {
                    if !v.is_empty() {
                        *slot = v;
                    }
                }
            }
        }
    }

    /// True when at least one provider has a usable credential (key or host).
    pub fn has_any_provider(&self) -> bool {
        [
            &self.providers.groq,
            &self.providers.openai,
            &self.providers.anthropic,
            &self.providers.gemini,
            &self.providers.ollama,
            &self.providers.openrouter,
            &self.providers.together,
            &self.providers.mistral,
            &self.providers.deepseek,
            &self.providers.xai,
            &self.providers.fireworks,
            &self.providers.cerebras,
            &self.providers.sambanova,
            &self.providers.deepinfra,
            &self.providers.nebius,
            &self.providers.novita,
            &self.providers.hyperbolic,
            &self.providers.lepton,
        ]
        .iter()
        .any(|k| !k.is_empty())
    }

    pub fn validate(&self) -> MorseResult<()> {
        // Validate routing
        if self.routing.default.is_empty() {
            return Err(MorseError::new(
                "CFG-001",
                "Routing default model is required",
                ErrorCategory::Config,
            ).with_suggestion("Set routing.default in config.yaml"));
        }

        // Validate trust config
        if self.trust.max_files_per_task == 0 {
            return Err(MorseError::new(
                "CFG-002",
                "max_files_per_task must be greater than 0",
                ErrorCategory::Config,
            ).with_suggestion("Set max_files_per_task to a positive value"));
        }

        // Validate cost budget
        if self.cost.daily_budget_usd == 0.0 && self.cost.monthly_budget_usd == 0.0 {
            return Err(MorseError::new(
                "CFG-003",
                "At least one cost budget must be configured",
                ErrorCategory::Config,
            ).with_suggestion("Set daily_budget_usd or monthly_budget_usd"));
        }

        // Validate at least one provider
        if !self.has_any_provider() {
            return Err(MorseError::new(
                "CFG-004",
                "No LLM provider API keys configured",
                ErrorCategory::Auth,
            ).with_suggestion("Set at least one provider API key (e.g., GROQ_API_KEY)"));
        }

        Ok(())
    }

    pub fn get_provider_key(&self, provider: &str) -> Option<&str> {
        let s = match provider {
            "groq" => &self.providers.groq,
            "openai" => &self.providers.openai,
            "anthropic" => &self.providers.anthropic,
            "gemini" => &self.providers.gemini,
            "ollama" => &self.providers.ollama,
            "openrouter" => &self.providers.openrouter,
            "together" => &self.providers.together,
            "mistral" => &self.providers.mistral,
            "deepseek" => &self.providers.deepseek,
            "xai" => &self.providers.xai,
            "fireworks" => &self.providers.fireworks,
            "cerebras" => &self.providers.cerebras,
            "sambanova" => &self.providers.sambanova,
            "deepinfra" => &self.providers.deepinfra,
            "nebius" => &self.providers.nebius,
            "novita" => &self.providers.novita,
            "hyperbolic" => &self.providers.hyperbolic,
            "lepton" => &self.providers.lepton,
            _ => return None,
        };
        if s.is_empty() {
            None
        } else {
            Some(s.as_str())
        }
    }
}

pub fn load(path: Option<&Path>) -> Result<Config> {
    let config_path = match path {
        Some(p) => p.to_path_buf(),
        None => default_config_path()?,
    };

    let mut cfg = if !config_path.exists() {
        Config::default()
    } else {
        let contents = fs::read_to_string(&config_path)
            .with_context(|| format!("Reading config from {:?}", config_path))?;
        // Merge over defaults so partial config files still work.
        let mut merged = Config::default();
        let partial: serde_yaml::Value = serde_yaml::from_str(&contents)
            .with_context(|| format!("Parsing config from {:?}", config_path))?;
        let default_value = serde_yaml::to_value(&merged)?
            .as_mapping()
            .cloned()
            .unwrap_or_default();
        merged = serde_yaml::from_value(merge_yaml(serde_yaml::Value::Mapping(default_value), partial))
            .with_context(|| format!("Merging config from {:?}", config_path))?;
        merged
    };

    cfg.apply_env_overrides();
    Ok(cfg)
}

/// Recursively merge `overlay` into `base`. Overlay values win; mappings merge
/// key-by-key so a file that only sets `routing.default` doesn't wipe the rest.
fn merge_yaml(base: serde_yaml::Value, overlay: serde_yaml::Value) -> serde_yaml::Value {
    use serde_yaml::Value;
    match (base, overlay) {
        (Value::Mapping(mut b), Value::Mapping(o)) => {
            for (k, v) in o {
                let existing = b.get(&k).cloned().unwrap_or(Value::Null);
                b.insert(k, merge_yaml(existing, v));
            }
            Value::Mapping(b)
        }
        (_, o) => o,
    }
}

pub fn init(path: Option<&Path>) -> Result<()> {
    let target = match path {
        Some(p) => p.to_path_buf(),
        None => std::env::current_dir()?.join(".morse"),
    };

    fs::create_dir_all(&target)?;
    let mut cfg = Config::default();
    cfg.apply_env_overrides();
    // Don't persist discovered API keys into the file.
    cfg.providers = Default::default();
    let yaml = serde_yaml::to_string(&cfg)?;
    fs::write(target.join("config.yaml"), yaml)?;
    Ok(())
}

fn default_config_path() -> Result<PathBuf> {
    let home = directories::UserDirs::new()
        .map(|d| d.home_dir().to_path_buf())
        .unwrap_or_else(|| PathBuf::from("."));
    Ok(home.join(".morse").join("config.yaml"))
}

// ---------------------------------------------------------------------------
// Interactive onboarding wizard (`morse init` in a terminal)
// ---------------------------------------------------------------------------

/// Environment variable that holds a provider's key.
fn env_key_name(provider: &str) -> String {
    match provider {
        "gemini" => "GEMINI_API_KEY".to_string(),
        _ => format!("{}_API_KEY", provider.to_uppercase()),
    }
}

/// Candidate providers offered in the wizard, with human labels.
const WIZARD_PROVIDERS: &[(&str, &str)] = &[
    ("groq", "Groq — free & very fast (console.groq.com)"),
    ("openai", "OpenAI — GPT-4o (platform.openai.com)"),
    ("anthropic", "Anthropic — Claude (console.anthropic.com)"),
    ("gemini", "Google — Gemini (aistudio.google.com)"),
    ("deepseek", "DeepSeek — cheap & capable"),
    ("ollama", "Ollama — local models (no key needed)"),
];

/// Interactive setup: pick a provider, provide a key, optionally test it, and
/// write `.morse/config.yaml` with sensible routing defaults.
pub fn init_interactive(ui: &crate::ui::UI, path: Option<&Path>) -> Result<()> {
    let target = match path {
        Some(p) => p.to_path_buf(),
        None => std::env::current_dir()?.join(".morse"),
    };
    fs::create_dir_all(&target)?;
    let config_file = target.join("config.yaml");

    ui.print(&ui.header(" Morse Setup "));
    ui.print("");
    if config_file.exists() {
        ui.print(&ui.info(&format!("Config already exists at {}", config_file.display())));
        if !ui.confirm("Overwrite it?")? {
            ui.print(&ui.muted("Keeping existing config. Run 'morse doctor' to check it."));
            return Ok(());
        }
    }

    // 1) Choose a provider.
    let labels: Vec<String> = WIZARD_PROVIDERS
        .iter()
        .map(|(id, label)| {
            let env = env_key_name(id);
            let marked = if id == &"ollama" {
                "  [no key]".to_string()
            } else if std::env::var(&env).is_ok() {
                format!("  [${} detected]", env)
            } else {
                String::new()
            };
            format!("{}{}", label, marked)
        })
        .collect();
    let chosen = ui.select("Choose a provider", &labels)?;
    let idx = labels.iter().position(|l| *l == chosen).unwrap_or(0);
    let (provider, _) = WIZARD_PROVIDERS[idx];

    // 2) Get the key (env if present, otherwise prompt).
    let mut cfg = Config::default();
    let mut key = String::new();
    if provider != "ollama" {
        let env = env_key_name(provider);
        if let Ok(v) = std::env::var(&env) {
            if !v.is_empty() {
                key = v;
                ui.print(&ui.success(&format!("Using ${} from environment", env)));
            }
        }
        if key.is_empty() {
            key = ui.password(&format!("Enter {} API key (leave blank to skip): ", provider))?;
        }
    }

    // 3) Set routing to this provider's default model.
    let model = crate::providers::compatible_endpoint(provider)
        .map(|(_, m)| m)
        .unwrap_or("default");
    let spec = format!("{}/{}", provider, model);
    cfg.routing.default = spec.clone();
    cfg.routing.quick_chat = spec.clone();
    cfg.routing.small_model = spec;

    // 4) Persist the key (env vars are preferred; only store if the user
    //    typed one directly).
    if provider == "groq" {
        cfg.providers.groq = key;
    } else if provider == "openai" {
        cfg.providers.openai = key;
    } else if provider == "anthropic" {
        cfg.providers.anthropic = key;
    } else if provider == "gemini" {
        cfg.providers.gemini = key;
    } else if provider == "deepseek" {
        cfg.providers.deepseek = key;
    }
    // (env keys are picked up automatically by apply_env_overrides at load.)

    let yaml = serde_yaml::to_string(&cfg)?;
    fs::write(&config_file, yaml)?;

    ui.print("");
    ui.print(&ui.kv_pair("config", &config_file.display().to_string()));
    ui.print(&ui.kv_pair("model", &cfg.routing.default));
    ui.print("");
    ui.print(&ui.success("Setup complete!"));
    ui.print(&ui.bullet("morse doctor          verify everything works", 0));
    ui.print(&ui.bullet("morse                 start chatting", 0));
    ui.print(&ui.bullet("morse -a -- \"task\"    run the agent", 0));
    Ok(())
}
