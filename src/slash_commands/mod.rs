use crate::config::Config;
use anyhow::Result;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SlashCommand {
    pub name: String,
    pub description: String,
    pub handler: String,
}

pub struct SlashCommandRegistry {
    commands: Vec<SlashCommand>,
}

impl Default for SlashCommandRegistry {
    fn default() -> Self {
        Self::new()
    }
}

impl SlashCommandRegistry {
    pub fn new() -> Self {
        Self {
            commands: vec![
                SlashCommand { name: "/help".to_string(), description: "Show help".to_string(), handler: "help".to_string() },
                SlashCommand { name: "/skills".to_string(), description: "List available skills".to_string(), handler: "skills".to_string() },
                SlashCommand { name: "/save".to_string(), description: "Save current session".to_string(), handler: "save".to_string() },
                SlashCommand { name: "/resume".to_string(), description: "Resume a session".to_string(), handler: "resume".to_string() },
                SlashCommand { name: "/list-sessions".to_string(), description: "List all sessions".to_string(), handler: "list-sessions".to_string() },
                SlashCommand { name: "/delete-session".to_string(), description: "Delete a session".to_string(), handler: "delete-session".to_string() },
                SlashCommand { name: "/info".to_string(), description: "Show session info".to_string(), handler: "info".to_string() },
                SlashCommand { name: "/stats".to_string(), description: "Show usage statistics".to_string(), handler: "stats".to_string() },
                SlashCommand { name: "/providers".to_string(), description: "List providers".to_string(), handler: "providers".to_string() },
                SlashCommand { name: "/reset".to_string(), description: "Reset context".to_string(), handler: "reset".to_string() },
                SlashCommand { name: "/feedback".to_string(), description: "Submit feedback".to_string(), handler: "feedback".to_string() },
                SlashCommand { name: "/cost".to_string(), description: "Show cost dashboard".to_string(), handler: "cost".to_string() },
                SlashCommand { name: "/history".to_string(), description: "Show command history".to_string(), handler: "history".to_string() },
                SlashCommand { name: "/mode".to_string(), description: "Change execution mode".to_string(), handler: "mode".to_string() },
            ],
        }
    }

    pub fn list(&self) -> &[SlashCommand] {
        &self.commands
    }

    pub fn find(&self, name: &str) -> Option<&SlashCommand> {
        self.commands.iter().find(|c| c.name == name)
    }

    pub fn execute(&self, name: &str, args: &[String]) -> Result<String> {
        let cmd = self.find(name)
            .ok_or_else(|| anyhow::anyhow!("Unknown command: {}", name))?;
        Ok(format!("Executed {} with args: {:?}", cmd.handler, args))
    }
}

pub fn run(cfg: &Config, command: Option<&str>) -> Result<()> {
    let _ = cfg;
    let registry = SlashCommandRegistry::new();

    match command {
        Some(cmd) => {
            let result = registry.execute(cmd, &[])?;
            println!("{}", result);
        }
        None => {
            println!("Available slash commands:");
            for cmd in registry.list() {
                println!("  {} - {}", cmd.name, cmd.description);
            }
        }
    }
    Ok(())
}

pub fn list_commands() -> Vec<SlashCommand> {
    let registry = SlashCommandRegistry::new();
    registry.list().to_vec()
}
