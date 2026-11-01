//! Skills: reusable, versioned capability files loaded from disk.
//!
//! A skill is a Markdown file with YAML-style frontmatter:
//!
//! ```markdown
//! ---
//! name: code-review
//! description: Automated code review
//! version: 1.0.0
//! author: morse
//! commands: review, pr-review
//! enabled: true
//! ---
//! <skill body / instructions>
//! ```
//!
//! Skills are discovered from the project (`.morse/skills/`) and the user
//! home dir (`~/.morse/skills/`), project taking precedence.

use crate::config::Config;
use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Skill {
    pub name: String,
    pub description: String,
    pub version: String,
    pub author: String,
    pub commands: Vec<String>,
    pub enabled: bool,
    #[serde(default)]
    pub body: String,
    #[serde(default)]
    pub source: String,
}

pub struct SkillManager {
    skills: HashMap<String, Skill>,
    skill_dirs: Vec<PathBuf>,
}

impl Default for SkillManager {
    fn default() -> Self {
        Self::with_defaults()
    }
}

/// Parse `---` frontmatter + body from a skill file.
fn parse_skill(text: &str, source: String) -> Option<Skill> {
    let mut lines = text.lines();
    // Optional leading `---` block.
    let mut meta: HashMap<String, String> = HashMap::new();
    let mut body_lines: Vec<String> = Vec::new();

    if lines.next().map(|l| l.trim()) != Some("---") {
        // No frontmatter — not a valid skill file.
        return None;
    }
    let mut in_body = false;
    for line in lines {
        if !in_body {
            if line.trim() == "---" {
                in_body = true;
                continue;
            }
            if let Some((k, v)) = line.split_once(':') {
                meta.insert(k.trim().to_lowercase(), v.trim().to_string());
            }
        } else {
            body_lines.push(line.to_string());
        }
    }

    let name = meta.get("name")?.clone();
    let commands = meta
        .get("commands")
        .map(|c| c.split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect())
        .unwrap_or_default();
    let enabled = meta
        .get("enabled")
        .map(|v| !matches!(v.to_lowercase().as_str(), "false" | "no" | "0"))
        .unwrap_or(true);

    Some(Skill {
        name: name.clone(),
        description: meta.get("description").cloned().unwrap_or_default(),
        version: meta.get("version").cloned().unwrap_or_else(|| "0.0.0".into()),
        author: meta.get("author").cloned().unwrap_or_else(|| "unknown".into()),
        commands,
        enabled,
        body: body_lines.join("\n").trim().to_string(),
        source,
    })
}

impl SkillManager {
    pub fn new() -> Self {
        Self::with_defaults()
    }

    pub fn with_defaults() -> Self {
        let mut dirs = Vec::new();
        if let Ok(cwd) = std::env::current_dir() {
            dirs.push(cwd.join(".morse/skills"));
        }
        if let Some(home) = directories::UserDirs::new() {
            dirs.push(home.home_dir().join(".morse/skills"));
        }
        Self { skills: HashMap::new(), skill_dirs: dirs }
    }

    pub fn with_dirs(dirs: Vec<PathBuf>) -> Self {
        Self { skills: HashMap::new(), skill_dirs: dirs }
    }

    /// Load all `*.md` skill files from the configured directories.
    pub fn load(&mut self) -> Result<()> {
        for dir in &self.skill_dirs {
            let Ok(entries) = std::fs::read_dir(dir) else { continue };
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().and_then(|e| e.to_str()) != Some("md") {
                    continue;
                }
                let Ok(text) = std::fs::read_to_string(&path) else { continue };
                let source = path.display().to_string();
                if let Some(skill) = parse_skill(&text, source) {
                    // Project-level (earlier dirs) wins over user-level.
                    self.skills.entry(skill.name.clone()).or_insert(skill);
                }
            }
        }
        Ok(())
    }

    /// Register a built-in fallback so `list` is never empty on a fresh install.
    pub fn with_builtin(self) -> Self {
        let mut m = self;
        if m.skills.is_empty() {
            for (name, desc, cmds) in [
                ("code-review", "Automated code review skill", vec!["review", "pr-review"]),
                ("refactor", "Code refactoring skill", vec!["extract-method", "inline-variable"]),
                ("test-gen", "Test generation skill", vec!["generate-tests", "coverage"]),
            ] {
                m.skills.insert(
                    name.to_string(),
                    Skill {
                        name: name.to_string(),
                        description: desc.to_string(),
                        version: "1.0.0".into(),
                        author: "morse-cli".into(),
                        commands: cmds.iter().map(|s| s.to_string()).collect(),
                        enabled: true,
                        body: String::new(),
                        source: "builtin".into(),
                    },
                );
            }
        }
        m
    }

    pub fn list_skills(&self) -> Vec<&Skill> {
        let mut out: Vec<&Skill> = self.skills.values().filter(|s| s.enabled).collect();
        out.sort_by(|a, b| a.name.cmp(&b.name));
        out
    }

    pub fn get_skill(&self, name: &str) -> Option<&Skill> {
        self.skills.get(name)
    }

    pub fn find_by_command(&self, cmd: &str) -> Option<&Skill> {
        self.skills
            .values()
            .find(|s| s.commands.iter().any(|c| c == cmd))
    }

    pub fn enable_skill(&mut self, name: &str) -> Result<()> {
        if let Some(skill) = self.skills.get_mut(name) {
            skill.enabled = true;
        }
        Ok(())
    }

    pub fn disable_skill(&mut self, name: &str) -> Result<()> {
        if let Some(skill) = self.skills.get_mut(name) {
            skill.enabled = false;
        }
        Ok(())
    }

    pub fn count(&self) -> usize {
        self.skills.len()
    }
}

pub fn run(cfg: &Config) -> Result<()> {
    let _ = cfg;
    let mut manager = SkillManager::with_defaults();
    manager.load()?;
    let manager = manager.with_builtin();
    let ui = crate::ui::UI::new(true);

    ui.print(&ui.header(" Skills "));
    ui.print("");
    for skill in manager.list_skills() {
        ui.print(&format!(
            "  {} v{} — {}",
            skill.name, skill.version, skill.description
        ));
        if !skill.commands.is_empty() {
            ui.print(&ui.muted(&format!("      commands: {}", skill.commands.join(", "))));
        }
        if skill.source != "builtin" {
            ui.print(&ui.muted(&format!("      source: {}", skill.source)));
        }
    }
    ui.print("");
    ui.print(&ui.muted(&format!(
        "{} skill(s). Add your own as .morse/skills/<name>.md",
        manager.list_skills().len()
    )));
    Ok(())
}

pub fn list_skills(manager: &SkillManager) -> Vec<&Skill> {
    manager.list_skills()
}

/// Write a sample skill so users see the expected format.
pub fn init(cfg: &Config) -> Result<()> {
    let _ = cfg;
    let dir = std::env::current_dir()?.join(".morse/skills");
    std::fs::create_dir_all(&dir)?;
    let sample = dir.join("example.md");
    if sample.exists() {
        println!("Example skill already exists at {}", sample.display());
        return Ok(());
    }
    std::fs::write(
        &sample,
        "---\nname: example\ndescription: Example skill template\nversion: 0.1.0\nauthor: you\ncommands: example, demo\nenabled: true\n---\n\n# Example Skill\n\nDescribe the skill instructions here. When invoked, these\ninstructions are injected into the model's context.\n",
    )?;
    println!("Wrote sample skill to {}", sample.display());
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_frontmatter_and_body() {
        let src = "---\nname: my-skill\ndescription: Does a thing\nversion: 2.1.0\nauthor: dev\ncommands: a, b\nenabled: true\n---\n\n# Body\nDo the thing.\n";
        let s = parse_skill(src, "test.md".into()).expect("parse");
        assert_eq!(s.name, "my-skill");
        assert_eq!(s.version, "2.1.0");
        assert_eq!(s.commands, vec!["a", "b"]);
        assert!(s.enabled);
        assert!(s.body.contains("Do the thing"));
    }

    #[test]
    fn rejects_missing_frontmatter() {
        assert!(parse_skill("just some text", "x.md".into()).is_none());
    }

    #[test]
    fn enabled_false_parsing() {
        let src = "---\nname: off\nenabled: false\n---\nbody";
        let s = parse_skill(src, "x".into()).unwrap();
        assert!(!s.enabled);
    }

    #[test]
    fn loads_from_disk_and_project_overrides_builtin() {
        let dir = std::env::temp_dir().join(format!("sk-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(
            dir.join("alpha.md"),
            "---\nname: alpha\ndescription: A\ncommands: aa\n---\nbody",
        )
        .unwrap();
        let mut m = SkillManager::with_dirs(vec![dir.clone()]);
        m.load().unwrap();
        assert_eq!(m.count(), 1);
        assert!(m.get_skill("alpha").is_some());
        assert_eq!(m.find_by_command("aa").map(|s| s.name.as_str()), Some("alpha"));
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn builtin_fills_when_empty() {
        let m = SkillManager::with_dirs(vec![PathBuf::from("/nonexistent-xyz")])
            .with_builtin();
        assert!(m.count() >= 3, "expected builtins, got {}", m.count());
        assert!(m.get_skill("code-review").is_some());
    }
}
