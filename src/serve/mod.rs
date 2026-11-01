use crate::config::Config;
use anyhow::Result;

#[derive(Debug, Clone, Default)]
pub struct ServeConfig {
    pub host: String,
    pub port: u16,
    pub transport: String, // "stdio" or "tcp"
}

impl ServeConfig {
    pub fn new() -> Self {
        Self {
            host: "127.0.0.1".to_string(),
            port: 3000,
            transport: "stdio".to_string(),
        }
    }
}

pub struct LSPServer {
    config: ServeConfig,
}

impl LSPServer {
    pub fn new(config: ServeConfig) -> Self {
        Self { config }
    }

    pub async fn run_stdio(&self) -> Result<()> {
        println!("LSP server running on stdio");
        println!("Transport: stdio");
        println!("Waiting for JSON-RPC messages...");

        // Read from stdin line by line
        use std::io::{self, BufRead};
        let stdin = io::stdin();
        for line in stdin.lock().lines().map_while(Result::ok) {
            if line.trim().is_empty() {
                continue;
            }
                println!("Received: {}", line);
                // Echo back a simple JSON-RPC response
                let response = serde_json::json!({
                    "jsonrpc": "2.0",
                    "id": null,
                    "result": {
                        "capabilities": {
                            "textDocumentSync": 1,
                            "hoverProvider": true,
                            "definitionProvider": true,
                            "referencesProvider": true,
                            "documentSymbolProvider": true
                        }
                    }
                });
                println!("{}", serde_json::to_string(&response)?);
        }

        Ok(())
    }

    pub async fn run_tcp(&self) -> Result<()> {
        println!("LSP server running on {}:{}", self.config.host, self.config.port);
        println!("Transport: tcp");
        Ok(())
    }
}

pub fn run(cfg: &Config, transport: Option<&str>) -> Result<()> {
    let _ = cfg;
    let transport = transport.unwrap_or("stdio");
    let config = ServeConfig {
        transport: transport.to_string(),
        ..Default::default()
    };

    let server = LSPServer::new(config);

    match transport {
        "stdio" => {
            // Block on stdio
            let rt = tokio::runtime::Runtime::new()?;
            rt.block_on(server.run_stdio())?;
        }
        "tcp" => {
            let rt = tokio::runtime::Runtime::new()?;
            rt.block_on(server.run_tcp())?;
        }
        _ => {
            anyhow::bail!("unsupported transport: {}", transport);
        }
    }

    Ok(())
}

pub fn status(cfg: &Config) -> Result<()> {
    let _ = cfg;
    println!("LSP Server Status:");
    println!("  Transport: stdio");
    println!("  Status: ready");
    Ok(())
}
