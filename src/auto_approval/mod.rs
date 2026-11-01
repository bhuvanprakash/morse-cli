use crate::config::Config;
use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApprovalRule {
    pub id: String,
    pub pattern: String,
    pub action: ApprovalAction,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ApprovalAction {
    Allow,
    Deny,
    RequireApproval,
}

#[derive(Debug, Clone)]
pub struct AutoApprovalEngine {
    rules: Vec<ApprovalRule>,
}

impl Default for AutoApprovalEngine {
    fn default() -> Self {
        Self::new()
    }
}

impl AutoApprovalEngine {
    pub fn new() -> Self {
        Self { rules: Vec::new() }
    }

    pub fn add_rule(&mut self, rule: ApprovalRule) {
        self.rules.push(rule);
    }

    pub fn check(&self, _tool: &str, args: &HashMap<String, String>) -> ApprovalAction {
        let path = args.get("path").map(|s| s.as_str()).unwrap_or("");
        for rule in &self.rules {
            if rule.enabled && path.contains(&rule.pattern) {
                return rule.action.clone();
            }
        }
        ApprovalAction::Allow
    }

    pub fn list_rules(&self) -> &[ApprovalRule] {
        &self.rules
    }
}

pub fn run(cfg: &Config) -> Result<()> {
    let _ = cfg;
    let mut engine = AutoApprovalEngine::new();

    engine.add_rule(ApprovalRule {
        id: "deny-env".to_string(),
        pattern: ".env".to_string(),
        action: ApprovalAction::Deny,
        enabled: true,
    });

    engine.add_rule(ApprovalRule {
        id: "deny-credentials".to_string(),
        pattern: "credentials".to_string(),
        action: ApprovalAction::Deny,
        enabled: true,
    });

    engine.add_rule(ApprovalRule {
        id: "deny-ssh".to_string(),
        pattern: "ssh_keys".to_string(),
        action: ApprovalAction::Deny,
        enabled: true,
    });

    engine.add_rule(ApprovalRule {
        id: "approve-config".to_string(),
        pattern: "config".to_string(),
        action: ApprovalAction::RequireApproval,
        enabled: true,
    });

    engine.add_rule(ApprovalRule {
        id: "allow-tests".to_string(),
        pattern: "_test".to_string(),
        action: ApprovalAction::Allow,
        enabled: true,
    });

    println!("Auto-Approval Rules:");
    for rule in engine.list_rules() {
        let action = match rule.action {
            ApprovalAction::Allow => "allow",
            ApprovalAction::Deny => "deny",
            ApprovalAction::RequireApproval => "require_approval",
        };
        println!("  {}: {} -> {}", rule.id, rule.pattern, action);
    }
    Ok(())
}

pub fn check_approval(engine: &AutoApprovalEngine, tool: &str, args: &HashMap<String, String>) -> ApprovalAction {
    engine.check(tool, args)
}
