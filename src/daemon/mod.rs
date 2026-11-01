use crate::config::Config;
use anyhow::Result;
use std::process::Command;

pub struct Daemon {
    pid_file: std::path::PathBuf,
}

impl Default for Daemon {
    fn default() -> Self {
        Self::new()
    }
}

impl Daemon {
    pub fn new() -> Self {
        let dir = std::env::current_dir().unwrap_or_default().join(".morse");
        let _ = std::fs::create_dir_all(&dir);
        Self {
            pid_file: dir.join("morse.pid"),
        }
    }

    pub fn start(&self) -> Result<()> {
        if self.is_running() {
            println!("Daemon already running (PID: {})", self.read_pid()?);
            return Ok(());
        }

        let pid = std::process::id();
        std::fs::write(&self.pid_file, pid.to_string())?;

        // Spawn daemon process in background
        let _ = Command::new(std::env::current_exe()?)
            .arg("serve")
            .arg("--transport")
            .arg("stdio")
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .stdin(std::process::Stdio::null())
            .spawn();

        println!("Daemon started (PID: {})", pid);
        Ok(())
    }

    pub fn stop(&self) -> Result<()> {
        if !self.is_running() {
            println!("Daemon not running");
            return Ok(());
        }

        let pid = self.read_pid()?;

        #[cfg(unix)]
        {
            let _ = Command::new("kill").arg("-TERM").arg(pid.to_string()).spawn();
        }
        #[cfg(not(unix))]
        {
            let _ = Command::new("taskkill").args(["/PID", &pid.to_string(), "/F"]).spawn();
        }

        let _ = std::fs::remove_file(&self.pid_file);
        println!("Daemon stopped");
        Ok(())
    }

    pub fn status(&self) -> Result<()> {
        if self.is_running() {
            println!("Daemon running (PID: {})", self.read_pid()?);
        } else {
            println!("Daemon not running");
        }
        Ok(())
    }

    fn is_running(&self) -> bool {
        if !self.pid_file.exists() {
            return false;
        }
        let pid = match self.read_pid() {
            Ok(p) => p,
            Err(_) => return false,
        };

        #[cfg(unix)]
        {
            let output = Command::new("kill").arg("-0").arg(pid.to_string()).output();
            output.is_ok_and(|o| o.status.success())
        }
        #[cfg(not(unix))]
        {
            true
        }
    }

    fn read_pid(&self) -> Result<u32> {
        let contents = std::fs::read_to_string(&self.pid_file)?;
        Ok(contents.trim().parse()?)
    }
}

pub fn run(cfg: &Config) -> Result<()> {
    let _ = cfg;
    let daemon = Daemon::new();
    daemon.start()
}

pub fn stop_daemon(cfg: &Config) -> Result<()> {
    let _ = cfg;
    let daemon = Daemon::new();
    daemon.stop()
}

pub fn daemon_status(cfg: &Config) -> Result<()> {
    let _ = cfg;
    let daemon = Daemon::new();
    daemon.status()
}
