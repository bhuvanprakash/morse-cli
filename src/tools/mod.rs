//! Built-in tools exposed to the agent loop.
//!
//! Each tool is a small, well-defined operation. Tools return a
//! `ToolResult` with `success`/`output`/`error` so the agent loop can feed
//! structured results back to the model.

use anyhow::{bail, Context, Result};
use serde_json::Value;
use std::fs;
use std::path::Path;

#[derive(Debug)]
pub struct ToolResult {
    pub success: bool,
    pub output: String,
    pub error: Option<String>,
}

impl ToolResult {
    fn ok(output: String) -> Self {
        Self { success: true, output, error: None }
    }
    fn err(error: String) -> Self {
        Self { success: false, output: String::new(), error: Some(error) }
    }
}

#[async_trait::async_trait]
pub trait Tool: Send + Sync {
    fn name(&self) -> &str;
    async fn execute(&self, args: Value) -> Result<ToolResult>;
    /// Optional provider-style schema (used by externally-defined tools such
    /// as MCP adapters). Built-in tools return `None` and use hardcoded schemas.
    fn schema(&self) -> Option<crate::providers::ToolDef> {
        None
    }
}

pub struct ToolRegistry {
    tools: std::collections::HashMap<String, Box<dyn Tool>>,
}

impl ToolRegistry {
    pub fn new() -> Self {
        Self { tools: std::collections::HashMap::new() }
    }

    pub fn register(&mut self, tool: Box<dyn Tool>) {
        self.tools.insert(tool.name().to_string(), tool);
    }

    pub fn get(&self, name: &str) -> Option<&dyn Tool> {
        self.tools.get(name).map(|t| t.as_ref())
    }

    pub fn list(&self) -> Vec<String> {
        let mut names: Vec<String> = self.tools.keys().cloned().collect();
        names.sort();
        names
    }
}

impl Default for ToolRegistry {
    fn default() -> Self {
        Self::new()
    }
}

// ---------------------------------------------------------------------------
// read_file
// ---------------------------------------------------------------------------

pub struct ReadFile;

#[async_trait::async_trait]
impl Tool for ReadFile {
    fn name(&self) -> &str {
        "read_file"
    }

    async fn execute(&self, args: Value) -> Result<ToolResult> {
        let path = args["path"].as_str().context("missing 'path' argument")?;
        let content = fs::read_to_string(path).with_context(|| format!("reading {}", path))?;
        let offset = args["offset"].as_u64().unwrap_or(1).max(1) as usize;
        let limit = args["limit"].as_u64().map(|l| l as usize).unwrap_or(2000);

        let lines: Vec<&str> = content.lines().collect();
        let start = (offset - 1).min(lines.len());
        let end = (start + limit).min(lines.len());

        let mut out = String::new();
        for (i, line) in lines[start..end].iter().enumerate() {
            out.push_str(&format!("{:>6}\t{}\n", start + i + 1, line));
        }
        if out.is_empty() {
            out.push_str("(empty file or range)\n");
        }
        Ok(ToolResult::ok(out))
    }
}

// ---------------------------------------------------------------------------
// write_file
// ---------------------------------------------------------------------------

pub struct WriteFile;

#[async_trait::async_trait]
impl Tool for WriteFile {
    fn name(&self) -> &str {
        "write_file"
    }

    async fn execute(&self, args: Value) -> Result<ToolResult> {
        let path = args["path"].as_str().context("missing 'path' argument")?;
        let content = args["content"].as_str().context("missing 'content' argument")?;
        if let Some(parent) = Path::new(path).parent() {
            if !parent.as_os_str().is_empty() {
                fs::create_dir_all(parent).with_context(|| format!("creating {}", parent.display()))?;
            }
        }
        fs::write(path, content).with_context(|| format!("writing {}", path))?;
        Ok(ToolResult::ok(format!(
            "Wrote {} bytes ({} lines) to {}",
            content.len(),
            content.lines().count(),
            path
        )))
    }
}

// ---------------------------------------------------------------------------
// edit_file
// ---------------------------------------------------------------------------

pub struct EditFile;

#[async_trait::async_trait]
impl Tool for EditFile {
    fn name(&self) -> &str {
        "edit_file"
    }

    async fn execute(&self, args: Value) -> Result<ToolResult> {
        let path = args["path"].as_str().context("missing 'path' argument")?;
        let old_str = args["old_string"].as_str().context("missing 'old_string' argument")?;
        let new_str = args["new_string"].as_str().context("missing 'new_string' argument")?;

        if old_str.is_empty() {
            bail!("old_string must not be empty");
        }
        let content = fs::read_to_string(path).with_context(|| format!("reading {}", path))?;
        let matches = content.matches(old_str).count();
        if matches == 0 {
            bail!("old_string not found in {} — re-read the file and match exactly", path);
        }
        if matches > 1 {
            bail!(
                "old_string is ambiguous ({} occurrences) in {} — include more surrounding context",
                matches,
                path
            );
        }
        let new_content = content.replacen(old_str, new_str, 1);
        fs::write(path, &new_content).with_context(|| format!("writing {}", path))?;
        Ok(ToolResult::ok(format!("Edited {}", path)))
    }
}

// ---------------------------------------------------------------------------
// list_dir
// ---------------------------------------------------------------------------

pub struct ListDir;

#[async_trait::async_trait]
impl Tool for ListDir {
    fn name(&self) -> &str {
        "list_dir"
    }

    async fn execute(&self, args: Value) -> Result<ToolResult> {
        let path = args["path"].as_str().unwrap_or(".");
        let entries = fs::read_dir(path).with_context(|| format!("reading dir {}", path))?;
        let mut dirs = Vec::new();
        let mut files = Vec::new();
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with('.') {
                continue;
            }
            if entry.path().is_dir() {
                dirs.push(format!("{}/", name));
            } else {
                let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
                files.push(format!("{} ({} B)", name, size));
            }
        }
        dirs.sort();
        files.sort();
        let mut out = dirs.join("\n");
        if !out.is_empty() && !files.is_empty() {
            out.push('\n');
        }
        out.push_str(&files.join("\n"));
        if out.is_empty() {
            out.push_str("(empty directory)");
        }
        Ok(ToolResult::ok(out))
    }
}

// ---------------------------------------------------------------------------
// grep
// ---------------------------------------------------------------------------

const BINARY_EXTENSIONS: &[&str] = &[
    "png", "jpg", "jpeg", "gif", "webp", "ico", "pdf", "zip", "gz", "tar", "exe", "dll",
    "so", "dylib", "bin", "o", "a", "class", "jar", "woff", "woff2", "ttf", "mp4", "mp3",
];
const IGNORED_DIRS: &[&str] = &[
    "node_modules", "target", ".git", "dist", "build", "vendor", ".venv", "__pycache__",
];

pub struct Grep;

#[async_trait::async_trait]
impl Tool for Grep {
    fn name(&self) -> &str {
        "grep"
    }

    async fn execute(&self, args: Value) -> Result<ToolResult> {
        let pattern = args["pattern"].as_str().context("missing 'pattern' argument")?;
        let root = args["path"].as_str().unwrap_or(".");
        let re = regex::Regex::new(pattern).with_context(|| format!("invalid regex: {}", pattern))?;

        let mut results = Vec::new();
        let mut matches = 0usize;
        const MAX_RESULTS: usize = 200;

        for entry in walkdir::WalkDir::new(root)
            .into_iter()
            .filter_entry(|e| {
                if e.depth() == 0 {
                    return true;
                }
                if e.file_type().is_dir() {
                    let name = e.file_name().to_string_lossy();
                    return !IGNORED_DIRS.contains(&name.as_ref()) && !name.starts_with('.');
                }
                true
            })
            .filter_map(|e| e.ok())
        {
            if matches >= MAX_RESULTS {
                break;
            }
            if !entry.file_type().is_file() {
                continue;
            }
            if let Some(ext) = entry.path().extension().and_then(|e| e.to_str()) {
                if BINARY_EXTENSIONS.contains(&ext.to_lowercase().as_str()) {
                    continue;
                }
            }
            let Ok(content) = fs::read_to_string(entry.path()) else { continue };
            // Skip files with NUL bytes (binary).
            if content.contains('\0') {
                continue;
            }
            for (i, line) in content.lines().enumerate() {
                if matches >= MAX_RESULTS {
                    break;
                }
                if re.is_match(line) {
                    results.push(format!("{}:{}: {}", entry.path().display(), i + 1, line.trim()));
                    matches += 1;
                }
            }
        }

        if results.is_empty() {
            Ok(ToolResult::ok(format!("No matches for /{}/", pattern)))
        } else {
            let suffix = if matches >= MAX_RESULTS {
                format!("\n… truncated at {} matches", MAX_RESULTS)
            } else {
                String::new()
            };
            Ok(ToolResult::ok(format!("{}{}", results.join("\n"), suffix)))
        }
    }
}

// ---------------------------------------------------------------------------
// glob
// ---------------------------------------------------------------------------

pub struct Glob;

#[async_trait::async_trait]
impl Tool for Glob {
    fn name(&self) -> &str {
        "glob"
    }

    async fn execute(&self, args: Value) -> Result<ToolResult> {
        let pattern = args["pattern"].as_str().context("missing 'pattern' argument")?;
        let mut results = Vec::new();
        for path in glob::glob(pattern).with_context(|| format!("invalid glob: {}", pattern))?.flatten() {
            results.push(path.display().to_string());
            if results.len() >= 500 {
                break;
            }
        }
        if results.is_empty() {
            Ok(ToolResult::ok(format!("No files match {}", pattern)))
        } else {
            Ok(ToolResult::ok(results.join("\n")))
        }
    }
}

// ---------------------------------------------------------------------------
// bash
// ---------------------------------------------------------------------------

pub struct Bash;

#[async_trait::async_trait]
impl Tool for Bash {
    fn name(&self) -> &str {
        "bash"
    }

    async fn execute(&self, args: Value) -> Result<ToolResult> {
        let cmd = args["command"].as_str().context("missing 'command' argument")?;
        let output = tokio::process::Command::new("sh")
            .arg("-c")
            .arg(cmd)
            .output()
            .await
            .with_context(|| format!("failed to execute: {}", cmd))?;
        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        let mut combined = stdout;
        if !stderr.is_empty() {
            if !combined.is_empty() {
                combined.push('\n');
            }
            combined.push_str(&stderr);
        }
        if combined.is_empty() {
            combined.push_str("(no output)");
        }
        if output.status.success() {
            Ok(ToolResult::ok(combined))
        } else {
            let code = output.status.code().map(|c| c.to_string()).unwrap_or_else(|| "signal".into());
            Ok(ToolResult::err(format!("exit code {}\n{}", code, combined)))
        }
    }
}

pub fn default_registry() -> ToolRegistry {
    let mut reg = ToolRegistry::new();
    reg.register(Box::new(ReadFile));
    reg.register(Box::new(WriteFile));
    reg.register(Box::new(EditFile));
    reg.register(Box::new(ListDir));
    reg.register(Box::new(Grep));
    reg.register(Box::new(Glob));
    reg.register(Box::new(Bash));
    reg
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[tokio::test]
    async fn read_file_respects_offset_and_limit() {
        let dir = std::env::temp_dir().join(format!("morse-tools-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let f = dir.join("sample.txt");
        std::fs::write(&f, "one\ntwo\nthree\nfour\n").unwrap();

        let tool = ReadFile;
        let res = tool
            .execute(json!({"path": f, "offset": 2, "limit": 2}))
            .await
            .unwrap();
        assert!(res.success);
        assert!(res.output.contains("2\ttwo"));
        assert!(res.output.contains("3\tthree"));
        assert!(!res.output.contains("four"));
        std::fs::remove_dir_all(&dir).ok();
    }

    #[tokio::test]
    async fn edit_file_requires_unique_match() {
        let dir = std::env::temp_dir().join(format!("morse-tools-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let f = dir.join("edit.txt");
        std::fs::write(&f, "aa bb aa").unwrap();

        let tool = EditFile;
        // Ambiguous match returns Err (via bail!), which the agent loop
        // surfaces back to the model as an error.
        let res = tool
            .execute(json!({"path": f, "old_string": "aa", "new_string": "cc"}))
            .await;
        assert!(res.is_err(), "ambiguous edit must fail");
        assert!(res.unwrap_err().to_string().contains("ambiguous"));

        let res = tool
            .execute(json!({"path": f, "old_string": "aa bb", "new_string": "cc dd"}))
            .await
            .unwrap();
        assert!(res.success);
        assert_eq!(std::fs::read_to_string(&f).unwrap(), "cc dd aa");
        std::fs::remove_dir_all(&dir).ok();
    }

    #[tokio::test]
    async fn grep_finds_matches_and_skips_binary() {
        let dir = std::env::temp_dir().join(format!("morse-tools-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("code.rs"), "fn hello() {}\nfn world() {}\n").unwrap();
        std::fs::write(dir.join("blob.png"), [0u8, 1, 2, 0, 9]).unwrap();

        let tool = Grep;
        let res = tool
            .execute(json!({"pattern": "fn (hello|world)", "path": dir}))
            .await
            .unwrap();
        assert!(res.success);
        assert!(res.output.contains("fn hello"));
        assert!(res.output.contains("fn world"));
        std::fs::remove_dir_all(&dir).ok();
    }

    #[tokio::test]
    async fn list_dir_separates_dirs_and_files() {
        let dir = std::env::temp_dir().join(format!("morse-tools-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(dir.join("sub")).unwrap();
        std::fs::write(dir.join("a.txt"), "x").unwrap();

        let tool = ListDir;
        let res = tool.execute(json!({"path": dir})).await.unwrap();
        assert!(res.success);
        assert!(res.output.contains("sub/"));
        assert!(res.output.contains("a.txt"));
        std::fs::remove_dir_all(&dir).ok();
    }
}
