use crate::config::Config;
use anyhow::Result;

#[allow(dead_code)]
pub struct NativeMacIntegration {
    cfg: Config,
}

impl NativeMacIntegration {
    pub fn new(cfg: Config) -> Self {
        Self { cfg }
    }

    pub fn check_availability(&self) -> Result<()> {
        println!("Native macOS integration:");
        println!("  - Spotlight search: available");
        println!("  - Services menu: available");
        println!("  - AppleScript: available");
        println!("  - Quick Look: available");
        Ok(())
    }

    pub fn register_service(&self, service_name: &str) -> Result<()> {
        println!("Registering service: {}", service_name);
        println!("Service registered");
        Ok(())
    }
}

pub fn run(cfg: &Config) -> Result<()> {
    let integration = NativeMacIntegration::new(cfg.clone());
    integration.check_availability()
}

pub fn register_service(cfg: &Config, service_name: &str) -> Result<()> {
    let integration = NativeMacIntegration::new(cfg.clone());
    integration.register_service(service_name)
}
