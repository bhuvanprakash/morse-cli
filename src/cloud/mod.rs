use crate::config::Config;
use anyhow::Result;
use std::time::{Duration, Instant};

#[derive(Clone)]
pub enum ExecutionMode {
    Local,
    Cloud,
    Hybrid,
}

#[derive(Clone)]
pub struct ExecutorConfig {
    pub mode: ExecutionMode,
    pub cloud_endpoint: String,
    pub api_key: String,
    pub timeout: Duration,
    pub max_memory_mb: usize,
    pub max_cpus: usize,
    pub docker_image: String,
}

pub struct ExecutionRequest {
    pub id: String,
    pub code: String,
    pub language: String,
    pub timeout: Duration,
    pub memory_limit: usize,
    pub cpu_limit: usize,
}

pub struct ExecutionResult {
    pub mode: String,
    pub duration: Duration,
    pub exit_code: i32,
    pub output: String,
    pub error: String,
}

pub struct CloudExecutor {
    config: ExecutorConfig,
}

impl CloudExecutor {
    pub fn new(config: ExecutorConfig) -> Self {
        Self { config }
    }

    pub fn execute(&self, req: ExecutionRequest) -> Result<ExecutionResult> {
        let start = Instant::now();
        let mode = match self.config.mode {
            ExecutionMode::Local => "local",
            ExecutionMode::Cloud => "cloud",
            ExecutionMode::Hybrid => "hybrid",
        };

        let output = std::process::Command::new("sh")
            .arg("-c")
            .arg(&req.code)
            .output()
            .map_err(|e| anyhow::anyhow!("Execution failed: {}", e))?;

        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();

        Ok(ExecutionResult {
            mode: mode.to_string(),
            duration: start.elapsed(),
            exit_code: if output.status.success() { 0 } else { 1 },
            output: format!("{}\n{}", stdout, stderr),
            error: if output.status.success() { String::new() } else { stderr },
        })
    }
}

pub fn run(cfg: &Config, code: &str) -> Result<()> {
    let _ = cfg;
    let mode = match cfg.cloud.mode.as_str() {
        "local" => ExecutionMode::Local,
        "cloud" => ExecutionMode::Cloud,
        _ => ExecutionMode::Hybrid,
    };

    let config = ExecutorConfig {
        mode,
        cloud_endpoint: cfg.cloud.endpoint.clone(),
        api_key: String::new(),
        timeout: Duration::from_secs(cfg.cloud.timeout_seconds),
        max_memory_mb: cfg.cloud.max_memory_mb,
        max_cpus: cfg.cloud.max_cpus,
        docker_image: cfg.cloud.docker_image.clone(),
    };

    let executor = CloudExecutor::new(config.clone());
    let req = ExecutionRequest {
        id: format!("exec-{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()),
        code: code.to_string(),
        language: "bash".to_string(),
        timeout: config.timeout,
        memory_limit: config.max_memory_mb,
        cpu_limit: config.max_cpus,
    };

    let result = executor.execute(req)?;
    println!("\nExecution Result:");
    println!("  Mode: {}", result.mode);
    println!("  Duration: {:?}", result.duration);
    println!("  Exit Code: {}", result.exit_code);
    println!("  Output:\n{}", result.output);
    if !result.error.is_empty() {
        println!("  Error:\n{}", result.error);
    }
    Ok(())
}

pub fn status(cfg: &Config) -> Result<()> {
    let _ = cfg;
    println!("Cloud Execution Status:");
    println!("  Mode: {}", cfg.cloud.mode);
    println!("  Endpoint: {}", cfg.cloud.endpoint);
    println!("  Docker Image: {}", cfg.cloud.docker_image);
    Ok(())
}

pub fn config(cfg: &Config) -> Result<()> {
    println!("Cloud Configuration:");
    println!("  Mode: {}", cfg.cloud.mode);
    println!("  Endpoint: {}", cfg.cloud.endpoint);
    println!("  Timeout: {}s", cfg.cloud.timeout_seconds);
    println!("  Max Memory: {}MB", cfg.cloud.max_memory_mb);
    println!("  Max CPUs: {}", cfg.cloud.max_cpus);
    println!("  Docker Image: {}", cfg.cloud.docker_image);
    Ok(())
}
