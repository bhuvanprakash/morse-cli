//! Trust boundaries system with production-grade authority enforcement

use crate::config::Config;
use crate::errors::{ErrorCategory, MorseError, MorseResult};
use crate::observability::metrics;
use crate::ui::UI;
use anyhow::Result;
use glob::Pattern;
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum AuthorityLevel {
    Read,
    Suggest,
    Auto,
    Full,
}

impl AuthorityLevel {
    /// Total parser: unknown values default to `Suggest` (safe). This is
    /// intentionally *not* `FromStr`, which is fallible by contract.
    #[allow(clippy::should_implement_trait)]
    pub fn from_str(s: &str) -> Self {
        match s {
            "read" => AuthorityLevel::Read,
            "auto" => AuthorityLevel::Auto,
            "full" => AuthorityLevel::Full,
            _ => AuthorityLevel::Suggest,
        }
    }

    pub fn as_str(&self) -> &str {
        match self {
            AuthorityLevel::Read => "read",
            AuthorityLevel::Suggest => "suggest",
            AuthorityLevel::Auto => "auto",
            AuthorityLevel::Full => "full",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrustConfig {
    pub default_level: AuthorityLevel,
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

pub struct TrustEngine {
    config: TrustConfig,
    project_root: std::path::PathBuf,
}

impl TrustEngine {
    pub fn new(project_root: &Path, config: TrustConfig) -> Self {
        Self {
            config,
            project_root: project_root.to_path_buf(),
        }
    }

    pub fn can_read(&self, path: &Path) -> MorseResult<bool> {
        metrics().increment("trust.checks");
        let full = self.resolve(path).map_err(|e| MorseError::new(
            "TRUST-001",
            &format!("Failed to resolve path: {}", e),
            ErrorCategory::FileSystem,
        ))?;

        if self.matches_denied(&full).map_err(|e| MorseError::new(
            "TRUST-002",
            &format!("Failed to check denied patterns: {}", e),
            ErrorCategory::Trust,
        ))? {
            return Ok(false);
        }

        Ok(true)
    }

    pub fn can_write(&self, path: &Path) -> MorseResult<bool> {
        metrics().increment("trust.write_checks");
        let full = self.resolve(path).map_err(|e| MorseError::new(
            "TRUST-003",
            &format!("Failed to resolve path: {}", e),
            ErrorCategory::FileSystem,
        ))?;

        if self.matches_denied(&full).map_err(|e| MorseError::new(
            "TRUST-004",
            &format!("Failed to check denied patterns: {}", e),
            ErrorCategory::Trust,
        ))? {
            return Ok(false);
        }

        Ok(true)
    }

    pub fn authority_level(&self, path: &Path) -> MorseResult<AuthorityLevel> {
        let full = self.resolve(path).map_err(|e| MorseError::new(
            "TRUST-005",
            &format!("Failed to resolve path: {}", e),
            ErrorCategory::FileSystem,
        ))?;

        let s = full.to_str().unwrap_or("");

        for override_ in &self.config.overrides {
            if Pattern::new(&override_.path).map_err(|e| MorseError::new(
                "TRUST-006",
                &format!("Invalid pattern: {}", e),
                ErrorCategory::Parse,
            ))?.matches(s) {
                return Ok(AuthorityLevel::from_str(&override_.level));
            }
        }

        for pattern in &self.config.auto_approved {
            if Pattern::new(pattern).map_err(|e| MorseError::new(
                "TRUST-007",
                &format!("Invalid pattern: {}", e),
                ErrorCategory::Parse,
            ))?.matches(s) {
                return Ok(AuthorityLevel::Auto);
            }
        }

        for pattern in &self.config.require_approval {
            if Pattern::new(pattern).map_err(|e| MorseError::new(
                "TRUST-008",
                &format!("Invalid pattern: {}", e),
                ErrorCategory::Parse,
            ))?.matches(s) {
                return Ok(AuthorityLevel::Suggest);
            }
        }

        Ok(self.config.default_level.clone())
    }

    pub fn check_max_files(&self, count: usize) -> MorseResult<()> {
        if count > self.config.max_files_per_task {
            return Err(MorseError::new(
                "TRUST-009",
                &format!("File limit exceeded: {} > {}", count, self.config.max_files_per_task),
                ErrorCategory::Trust,
            ).with_suggestion("Increase max_files_per_task in trust config or reduce file scope"));
        }
        Ok(())
    }

    fn resolve(&self, path: &Path) -> MorseResult<std::path::PathBuf> {
        if path.is_absolute() {
            Ok(path.to_path_buf())
        } else {
            Ok(self.project_root.join(path))
        }
    }

    fn matches_denied(&self, path: &Path) -> MorseResult<bool> {
        let s = path.to_str().unwrap_or("");
        for pattern in &self.config.denied_patterns {
            if Pattern::new(pattern).map_err(|e| MorseError::new(
                "TRUST-010",
                &format!("Invalid denied pattern: {}", e),
                ErrorCategory::Parse,
            ))?.matches(s) {
                return Ok(true);
            }
        }
        Ok(false)
    }
}

pub fn init(ui: &UI, cfg: &Config) -> Result<()> {
    let _spinner = ui.spinner("Initializing trust boundaries...");
    let trust_dir = std::env::current_dir()?.join(".morse");
    std::fs::create_dir_all(&trust_dir)?;
    let yaml = serde_yaml::to_string(&crate::config::TrustConfig {
        default_level: cfg.trust.default_level.clone(),
        max_files_per_task: cfg.trust.max_files_per_task,
        denied_patterns: cfg.trust.denied_patterns.clone(),
        require_approval: cfg.trust.require_approval.clone(),
        auto_approved: cfg.trust.auto_approved.clone(),
        overrides: vec![],
    })?;
    std::fs::write(trust_dir.join("authority.yaml"), yaml)?;
    ui.print(&ui.success("Trust configuration initialized"));
    Ok(())
}

pub fn status(ui: &UI, cfg: &Config) -> Result<()> {
    ui.print(&ui.section("Trust Configuration"));
    ui.print(&ui.kv_pair("Default level", &cfg.trust.default_level));
    ui.print(&ui.kv_pair("Max files/task", &cfg.trust.max_files_per_task.to_string()));
    ui.print(&ui.section("Denied Patterns"));
    for p in &cfg.trust.denied_patterns {
        ui.print(&ui.bullet(p, 1));
    }
    ui.print(&ui.section("Require Approval"));
    for p in &cfg.trust.require_approval {
        ui.print(&ui.bullet(p, 1));
    }
    ui.print(&ui.section("Auto-Approved"));
    for p in &cfg.trust.auto_approved {
        ui.print(&ui.bullet(p, 1));
    }
    Ok(())
}

pub fn check(ui: &UI, cfg: &Config, path: &Path) -> Result<()> {
    let engine = TrustEngine::new(std::env::current_dir()?.as_path(), TrustConfig {
        default_level: AuthorityLevel::from_str(&cfg.trust.default_level),
        max_files_per_task: cfg.trust.max_files_per_task,
        denied_patterns: cfg.trust.denied_patterns.clone(),
        require_approval: cfg.trust.require_approval.clone(),
        auto_approved: cfg.trust.auto_approved.clone(),
        overrides: vec![],
    });

    let readable = engine.can_read(path).map_err(|e| anyhow::anyhow!(e.display()))?;
    let writable = engine.can_write(path).map_err(|e| anyhow::anyhow!(e.display()))?;
    let level = engine.authority_level(path).map_err(|e| anyhow::anyhow!(e.display()))?;

    ui.print(&ui.section_owned(format!("Trust Check: {}", path.display())));
    ui.print(&ui.kv_pair("Read", if readable { "allowed" } else { "DENIED" }));
    ui.print(&ui.kv_pair("Write", if writable { "allowed" } else { "DENIED" }));
    ui.print(&ui.kv_pair("Authority", level.as_str()));

    if !readable || !writable {
        ui.print(&ui.error("Access denied by trust boundaries"));
        std::process::exit(1);
    }
    Ok(())
}
