//! Context management: inline `@file` mentions, build a compact project
//! summary for system-prompt injection, and compress chat history so long
//! sessions don't blow the context window.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

const IGNORED_DIRS: &[&str] = &[
    "node_modules", "target", ".git", "dist", "build", "vendor", ".venv", "__pycache__",
];
const MAX_INLINE_FILE_CHARS: usize = 8_000;
const MAX_SUMMARY_FILES: usize = 120;

/// Expand `@relative/path` tokens in a user message into fenced file contents.
/// Unmatched or unreadable paths are left as-is (so `@user` in prose is safe).
pub fn expand_mentions(text: &str, root: &Path) -> String {
    if !text.contains('@') {
        return text.to_string();
    }
    let mut out = String::with_capacity(text.len());
    let mut chars = text.char_indices().peekable();
    while let Some((idx, ch)) = chars.next() {
        if ch != '@' {
            out.push(ch);
            continue;
        }
        // Read the token immediately after '@': path chars until whitespace or
        // a char that can't be in a path.
        let rest = &text[idx + 1..];
        let token: String = rest
            .chars()
            .take_while(|c| {
                c.is_alphanumeric() || matches!(c, '/' | '.' | '_' | '-' | '\\')
            })
            .collect();
        if token.is_empty() {
            out.push('@');
            continue;
        }
        // Only treat as a mention if it looks path-like (has a separator or a
        // known source extension) and the file actually exists.
        let looks_path = token.contains('/')
            || matches!(
                Path::new(&token)
                    .extension()
                    .and_then(|e| e.to_str())
                    .unwrap_or(""),
                "rs" | "go" | "py" | "js" | "ts" | "tsx" | "jsx" | "java" | "c" | "h"
                    | "cpp" | "md" | "toml" | "json" | "yaml" | "yml" | "txt"
            );
        let path = resolve(root, &token);
        if looks_path && path.is_file() {
            if let Ok(content) = std::fs::read_to_string(&path) {
                let shown = truncate_from_start(&content, MAX_INLINE_FILE_CHARS);
                out.push_str(&format!(
                    "\n\n--- {} ---\n```\n{}\n```\n--- end {} ---\n",
                    token, shown, token
                ));
                continue; // consumed the token
            }
            // Read error: fall through, leave the mention as-is.
        }
        // Not a resolvable mention: emit literally.
        out.push('@');
        out.push_str(&token);
        // Note: remaining chars after token are re-processed by the loop only
        // if we didn't consume them; since we sliced from `rest`, we must skip
        // the consumed portion.
        // Advance the iterator past the token we just emitted.
        for _ in 0..token.chars().count() {
            chars.next();
        }
    }
    out
}

fn resolve(root: &Path, token: &str) -> PathBuf {
    let p = Path::new(token);
    if p.is_absolute() {
        p.to_path_buf()
    } else {
        root.join(p)
    }
}

fn truncate_from_start(s: &str, max: usize) -> String {
    if s.chars().count() <= max {
        return s.to_string();
    }
    // Keep the tail (most recent/defining lines often at top too — keep head
    // for source files, which start with imports/decls).
    let head: String = s.chars().take(max).collect();
    format!("{}\n… (truncated)", head)
}

/// Detect all `@file` mentions in a message (for reporting/preview).
pub fn mentions(text: &str, root: &Path) -> Vec<String> {
    let mut found = Vec::new();
    if !text.contains('@') {
        return found;
    }
    for part in text.split('@').skip(1) {
        let token: String = part
            .chars()
            .take_while(|c| c.is_alphanumeric() || matches!(c, '/' | '.' | '_' | '-'))
            .collect();
        if token.is_empty() {
            continue;
        }
        if resolve(root, &token).is_file() && !found.contains(&token) {
            found.push(token);
        }
    }
    found
}

/// A compact project structure summary (top-level tree + file counts) to
/// inject into the system prompt so the model knows the layout without a
/// tool round-trip.
pub fn project_summary(root: &Path) -> Option<String> {
    let mut tree: BTreeMap<String, usize> = BTreeMap::new();
    let mut total = 0usize;
    collect(root, root, 0, &mut tree, &mut total);
    if total == 0 {
        return None;
    }
    let mut out = format!("Project layout ({} source files):\n", total);
    for (i, (dir, count)) in tree.iter().enumerate() {
        if i >= 40 {
            out.push_str("  …\n");
            break;
        }
        let display = if dir.is_empty() { ".".to_string() } else { dir.clone() };
        out.push_str(&format!("  {}/ — {} files\n", display, count));
    }
    Some(out)
}

fn collect(
    root: &Path,
    dir: &Path,
    depth: usize,
    tree: &mut BTreeMap<String, usize>,
    total: &mut usize,
) {
    if depth > 3 || *total >= MAX_SUMMARY_FILES {
        return;
    }
    let Ok(entries) = std::fs::read_dir(dir) else { return };
    for entry in entries.flatten() {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        if path.is_dir() {
            if IGNORED_DIRS.contains(&name.as_str()) || name.starts_with('.') {
                continue;
            }
            collect(root, &path, depth + 1, tree, total);
        } else if is_source(&path) {
            if *total >= MAX_SUMMARY_FILES {
                return;
            }
            let rel_dir = path
                .parent()
                .and_then(|p| p.strip_prefix(root).ok())
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_default();
            *tree.entry(rel_dir).or_insert(0) += 1;
            *total += 1;
        }
    }
}

fn is_source(path: &Path) -> bool {
    matches!(
        path.extension().and_then(|e| e.to_str()).unwrap_or(""),
        "rs" | "go" | "py" | "js" | "ts" | "tsx" | "jsx" | "java" | "c" | "h" | "cpp"
            | "cc" | "hpp" | "rb" | "php" | "swift" | "kt"
    )
}

/// Compress a chat history for re-sending: if the total size exceeds
/// `budget_chars`, keep the system prompt + last few turns and replace the
/// older ones with a marker (a full model-generated summary can be layered on
/// top later). Returns the (possibly trimmed) messages as role/content pairs.
pub fn trim_history(
    msgs: &[(String, String)],
    budget_chars: usize,
) -> Vec<(String, String)> {
    let total: usize = msgs.iter().map(|(_, c)| c.len()).sum();
    // Need at least a first message plus one turn to make trimming meaningful.
    if total <= budget_chars || msgs.len() < 3 {
        return msgs.to_vec();
    }
    // Keep the first message (often the task/system) and as many trailing
    // turns as fit the budget.
    let mut out: Vec<(String, String)> = Vec::new();
    let first = msgs.first().cloned();
    if let Some(f) = first {
        out.push(f);
    }
    let mut used = out.iter().map(|(_, c)| c.len()).sum::<usize>();
    let tail: Vec<(String, String)> = msgs.iter().skip(1).rev().cloned().collect();
    let mut kept_rev: Vec<(String, String)> = Vec::new();
    for m in tail {
        let len = m.1.len();
        if used + len > budget_chars {
            break;
        }
        used += len;
        kept_rev.push(m);
    }
    kept_rev.reverse();
    if !kept_rev.is_empty() {
        out.push((
            "system".into(),
            "[earlier conversation trimmed for context budget]".into(),
        ));
        out.extend(kept_rev);
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn expands_existing_file_mention() {
        let dir = std::env::temp_dir().join(format!("ctx-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(dir.join("src")).unwrap();
        std::fs::write(dir.join("src/lib.rs"), "fn hello() {}").unwrap();

        let expanded = expand_mentions("look at @src/lib.rs please", &dir);
        assert!(expanded.contains("--- src/lib.rs ---"), "{}", expanded);
        assert!(expanded.contains("fn hello()"), "{}", expanded);
        assert!(expanded.contains("please"), "surrounding text kept");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn leaves_non_mentions_alone() {
        let dir = std::env::temp_dir().join(format!("ctx-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        // '@user' has no path separator/known ext and doesn't exist as file.
        let expanded = expand_mentions("email @user and ping @nobody", &dir);
        assert!(expanded.contains("@user"), "{}", expanded);
        assert!(!expanded.contains("--- "), "no file inlined");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn no_at_short_circuits() {
        let dir = Path::new("/nonexistent");
        assert_eq!(expand_mentions("plain text", dir), "plain text");
    }

    #[test]
    fn mentions_detects_files() {
        let dir = std::env::temp_dir().join(format!("ctx-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("a.rs"), "x").unwrap();
        let found = mentions("see @a.rs and @missing.rs", &dir);
        assert_eq!(found, vec!["a.rs".to_string()]);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn project_summary_counts_source_files() {
        let dir = std::env::temp_dir().join(format!("ctx-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(dir.join("src")).unwrap();
        std::fs::write(dir.join("src/a.rs"), "a").unwrap();
        std::fs::write(dir.join("src/b.rs"), "b").unwrap();
        std::fs::write(dir.join("README.md"), "ignored").unwrap();
        let s = project_summary(&dir).expect("summary");
        assert!(s.contains("2 source files"), "{}", s);
        assert!(s.contains("src/"), "{}", s);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn trim_history_keeps_recent_within_budget() {
        let msgs: Vec<(String, String)> = vec![
            ("user".into(), "task".into()),
            ("assistant".into(), "a".repeat(500)),
            ("user".into(), "b".repeat(500)),
            ("assistant".into(), "c".repeat(100)),
        ];
        let trimmed = trim_history(&msgs, 250);
        assert!(trimmed.len() < msgs.len(), "should drop some");
        assert_eq!(trimmed[0].1, "task", "keeps the first message");
        assert!(trimmed.iter().any(|(_, c)| c.contains("trimmed")));

        // Small history untouched.
        let small = vec![("user".into(), "hi".into()), ("assistant".into(), "yo".into())];
        assert_eq!(trim_history(&small, 10_000).len(), 2);
    }
}
