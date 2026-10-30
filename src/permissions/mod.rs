//! Permission rules for tool actions, evaluated with glob patterns.
//!
//! Ordered, first-match-wins: later `allow` rules can override earlier
//! defaults only if listed after. Sensitive paths (.env, keys) default to
//! deny, mutating config requires approval, docs auto-allow.

use crate::config::Config;
use anyhow::Result;
use glob::Pattern;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PermissionAction {
    Allow,
    Deny,
    RequireApproval,
}

impl PermissionAction {
    pub fn as_str(&self) -> &'static str {
        match self {
            PermissionAction::Allow => "allow",
            PermissionAction::Deny => "deny",
            PermissionAction::RequireApproval => "require_approval",
        }
    }
}

#[derive(Debug, Clone)]
pub struct PermissionRule {
    pub pattern: String,
    pub action: PermissionAction,
}

pub struct PermissionEngine {
    rules: Vec<PermissionRule>,
}

impl Default for PermissionEngine {
    fn default() -> Self {
        Self::with_defaults()
    }
}

impl PermissionEngine {
    pub fn new() -> Self {
        Self { rules: Vec::new() }
    }

    /// Default rules protecting secrets and gating mutations.
    pub fn with_defaults() -> Self {
        let mut e = Self::new();
        // Denies first (most specific security rules).
        for p in [
            "**/.env",
            "**/.env.*",
            "**/*credentials*",
            "**/*.pem",
            "**/id_rsa*",
            "**/id_ed25519*",
            "**/*.key",
            "**/secrets*",
        ] {
            e.add_rule(p.to_string(), PermissionAction::Deny);
        }
        // Approval for config/state mutations.
        for p in ["**/.morse/**", "**/*.yaml", "**/*.yml", "**/*.toml"] {
            e.add_rule(p.to_string(), PermissionAction::RequireApproval);
        }
        // Safe defaults for docs and tests.
        for p in ["**/*.md", "**/*_test.*", "**/tests/**"] {
            e.add_rule(p.to_string(), PermissionAction::Allow);
        }
        e
    }

    pub fn add_rule(&mut self, pattern: String, action: PermissionAction) {
        self.rules.push(PermissionRule { pattern, action });
    }

    pub fn rules(&self) -> &[PermissionRule] {
        &self.rules
    }

    /// First matching rule wins; falls back to `RequireApproval` for unknown
    /// paths (safe default: don't silently allow).
    pub fn check(&self, path: &str) -> PermissionAction {
        for rule in &self.rules {
            // Patterns like `**/.env` should also match a bare `.env`.
            let candidate = if path.starts_with('/') {
                path
            } else {
                // glob Pattern matches against the whole path; prefix `./`-less
                // relative paths are matched directly and also against `/`+path.
                path
            };
            if let Ok(pat) = Pattern::new(&rule.pattern) {
                if pat.matches(candidate) || pat.matches(&format!("/{}", path)) {
                    return rule.action;
                }
            }
        }
        PermissionAction::RequireApproval
    }

    /// Convenience for boolean queries.
    pub fn is_denied(&self, path: &str) -> bool {
        self.check(path) == PermissionAction::Deny
    }

    pub fn allows(&self, path: &str) -> bool {
        self.check(path) == PermissionAction::Allow
    }
}

pub fn run(cfg: &Config) -> Result<()> {
    let _ = cfg;
    let engine = PermissionEngine::with_defaults();
    let ui = crate::ui::UI::new(true);

    ui.print(&ui.header(" Permission Rules "));
    ui.print("");
    for rule in engine.rules() {
        let action = match rule.action {
            PermissionAction::Deny => ui.error(rule.action.as_str()),
            PermissionAction::Allow => ui.success(rule.action.as_str()),
            PermissionAction::RequireApproval => ui.warning(rule.action.as_str()),
        };
        ui.print(&format!("  {:<24} → {}", rule.pattern, action));
    }
    ui.print("");
    ui.print(&ui.muted("First matching rule wins; unknown paths require approval."));
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn secret_paths_are_denied() {
        let e = PermissionEngine::with_defaults();
        assert!(e.is_denied(".env"), "bare .env should match");
        assert!(e.is_denied("config/.env.local"));
        assert!(e.is_denied("certs/server.pem"));
        assert!(e.is_denied("secrets.yaml"));
        assert!(e.is_denied("id_rsa"));
    }

    #[test]
    fn docs_allow_and_config_requires_approval() {
        let e = PermissionEngine::with_defaults();
        assert_eq!(e.check("README.md"), PermissionAction::Allow);
        assert_eq!(e.check("docs/guide.md"), PermissionAction::Allow);
        assert_eq!(e.check("config.yaml"), PermissionAction::RequireApproval);
        assert_eq!(e.check(".morse/config.yaml"), PermissionAction::RequireApproval);
    }

    #[test]
    fn unknown_path_requires_approval() {
        let e = PermissionEngine::with_defaults();
        assert_eq!(e.check("src/main.rs"), PermissionAction::RequireApproval);
        assert!(!e.allows("src/main.rs"));
    }

    #[test]
    fn custom_rule_overrides_default() {
        let mut e = PermissionEngine::with_defaults();
        e.add_rule("src/**/*.rs".to_string(), PermissionAction::Allow);
        assert_eq!(e.check("src/main.rs"), PermissionAction::Allow);
    }

    #[test]
    fn invalid_glob_does_not_panic() {
        let mut e = PermissionEngine::new();
        e.add_rule("[invalid".to_string(), PermissionAction::Deny);
        // Falls through to default.
        assert_eq!(e.check("anything"), PermissionAction::RequireApproval);
    }
}
