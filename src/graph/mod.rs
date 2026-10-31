//! Code knowledge graph: parses source files, extracts symbols (functions,
//! types, methods) and call/reference edges, then supports query, impact
//! analysis, and DOT visualization.
//!
//! Uses lightweight regex-based extraction for Rust, Go, Python, JS/TS, and
//! generic C-family languages. It is deliberately dependency-free and fast —
//! good enough for navigation and blast-radius analysis without a full parser.

use crate::config::Config;
use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeGraph {
    #[serde(default)]
    nodes: Vec<GraphNode>,
    #[serde(default)]
    edges: Vec<GraphEdge>,
    #[serde(default)]
    root: PathBuf,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphNode {
    pub id: String,
    pub name: String,
    pub kind: String,
    pub file: String,
    pub start_line: usize,
    pub end_line: usize,
    #[serde(default)]
    pub callers: Vec<String>,
    #[serde(default)]
    pub callees: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphEdge {
    pub from: String,
    pub to: String,
    pub kind: String,
}

const SOURCE_EXTS: &[&str] = &[
    "rs", "go", "py", "js", "jsx", "ts", "tsx", "java", "c", "h", "cpp", "cc", "hpp",
];
const IGNORED_DIRS: &[&str] = &[
    "node_modules", "target", ".git", "dist", "build", "vendor", ".venv", "__pycache__",
];

impl CodeGraph {
    pub fn new(project_root: &Path) -> Self {
        Self {
            nodes: Vec::new(),
            edges: Vec::new(),
            root: project_root.to_path_buf(),
        }
    }

    /// Walk the project and build the symbol + call graph.
    pub fn build(&mut self) -> Result<()> {
        self.nodes.clear();
        self.edges.clear();

        let mut files: Vec<PathBuf> = Vec::new();
        collect_source_files(&self.root, &mut files);

        // Pass 1: extract symbols per file.
        let mut symbols_by_file: HashMap<String, Vec<GraphNode>> = HashMap::new();
        for path in &files {
            let Ok(content) = std::fs::read_to_string(path) else { continue };
            let rel = rel_path(&self.root, path);
            let symbols = extract_symbols(&rel, &content);
            symbols_by_file.insert(rel.clone(), symbols);
        }

        // Assign IDs and flatten.
        let mut name_index: HashMap<String, String> = HashMap::new();
        for (file, symbols) in &symbols_by_file {
            for s in symbols {
                let id = format!("{}::{}", file, s.name);
                name_index.insert(s.name.clone(), id.clone());
                let mut node = s.clone();
                node.id = id;
                self.nodes.push(node);
            }
        }

        // Pass 2: extract call edges by matching identifiers used in each file
        // against known symbol names.
        let known: HashSet<String> = self.nodes.iter().map(|n| n.name.clone()).collect();
        for path in &files {
            let Ok(content) = std::fs::read_to_string(path) else { continue };
            let rel = rel_path(&self.root, path);
            let defined_here: Vec<String> = symbols_by_file
                .get(&rel)
                .map(|v| v.iter().map(|s| s.name.clone()).collect())
                .unwrap_or_default();

            let mut callees: HashSet<String> = HashSet::new();
            for (line_no, line) in content.lines().enumerate() {
                let trimmed = line.trim();
                // Skip comment lines.
                if trimmed.starts_with("//") || trimmed.starts_with('#') {
                    continue;
                }
                for name in &known {
                    if defined_here.iter().any(|d| d == name) {
                        // Don't self-link.
                        continue;
                    }
                    // Word-boundary occurrence.
                    if contains_word(line, name) {
                        let callee_id = format!("{}::{}", resolve_def_file(&name_index, &self.nodes, name), name);
                        callees.insert(callee_id);
                        let _ = line_no;
                    }
                }
            }

            // Wire callers/callees and create edges.
            for callee in &callees {
                for fname in &defined_here {
                    let caller_id = format!("{}::{}", rel, fname);
                    if let Some(node) = self.nodes.iter_mut().find(|n| n.id == caller_id) {
                        if !node.callees.contains(callee) {
                            node.callees.push(callee.clone());
                        }
                    }
                    if let Some(node) = self.nodes.iter_mut().find(|n| n.id == *callee) {
                        if !node.callers.contains(&caller_id) {
                            node.callers.push(caller_id.clone());
                        }
                    }
                    self.edges.push(GraphEdge {
                        from: caller_id.clone(),
                        to: callee.clone(),
                        kind: "calls".to_string(),
                    });
                }
            }
        }

        Ok(())
    }

    pub fn stats(&self) -> serde_json::Value {
        let kinds: HashMap<&str, usize> = {
            let mut m: HashMap<&str, usize> = HashMap::new();
            for n in &self.nodes {
                *m.entry(n.kind.as_str()).or_insert(0) += 1;
            }
            m
        };
        serde_json::json!({
            "symbols": self.nodes.len(),
            "edges": self.edges.len(),
            "kinds": kinds,
        })
    }

    pub fn export(&self, path: &Path) -> Result<()> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let json = serde_json::to_string_pretty(self)?;
        std::fs::write(path, json)?;
        Ok(())
    }

    pub fn import(&mut self, path: &Path) -> Result<()> {
        let json = std::fs::read_to_string(path)
            .with_context(|| format!("reading graph from {}", path.display()))?;
        let loaded: CodeGraph = serde_json::from_str(&json)
            .with_context(|| format!("parsing graph at {}", path.display()))?;
        self.nodes = loaded.nodes;
        self.edges = loaded.edges;
        if !loaded.root.as_os_str().is_empty() {
            self.root = loaded.root;
        }
        Ok(())
    }

    /// Case-insensitive substring + word match on name/kind/file.
    pub fn query(&self, query: &str) -> Result<Vec<GraphNode>> {
        let q = query.to_lowercase();
        let mut results: Vec<GraphNode> = self
            .nodes
            .iter()
            .filter(|n| {
                n.name.to_lowercase().contains(&q)
                    || n.kind.to_lowercase().contains(&q)
                    || n.file.to_lowercase().contains(&q)
            })
            .cloned()
            .collect();
        // Prefer exact name matches first, then prefix matches.
        results.sort_by(|a, b| {
            let a_exact = a.name.eq_ignore_ascii_case(query) as u8;
            let b_exact = b.name.eq_ignore_ascii_case(query) as u8;
            b_exact
                .cmp(&a_exact)
                .then_with(|| a.name.len().cmp(&b.name.len()))
        });
        Ok(results)
    }

    pub fn get_all_symbols(&self) -> Vec<GraphNode> {
        self.nodes.clone()
    }

    pub fn get_symbol(&self, id: &str) -> Option<&GraphNode> {
        self.nodes.iter().find(|n| n.id == id || n.name == id)
    }

    /// Breadth-first blast radius: everything that (transitively) depends on
    /// this symbol, with depth. This answers "what breaks if I change it?".
    pub fn get_impact_analysis(&self, symbol_id: &str) -> Vec<(String, usize)> {
        let start = match self.get_symbol(symbol_id) {
            Some(n) => n.id.clone(),
            None => return vec![],
        };

        // Reverse adjacency: dependent -> dependency is edge.from -> edge.to,
        // so dependents of X are edges where to == X.
        let mut dependents: HashMap<String, Vec<String>> = HashMap::new();
        for e in &self.edges {
            dependents.entry(e.to.clone()).or_default().push(e.from.clone());
        }

        let mut visited: HashSet<String> = HashSet::new();
        visited.insert(start.clone());
        let mut queue: Vec<(String, usize)> = vec![(start, 0)];
        let mut out = Vec::new();

        while let Some((current, depth)) = queue.pop() {
            if depth > 0 {
                out.push((current.clone(), depth));
            }
            if depth >= 8 {
                continue; // bound the search
            }
            if let Some(parents) = dependents.get(&current) {
                for p in parents {
                    if visited.insert(p.clone()) {
                        queue.push((p.clone(), depth + 1));
                    }
                }
            }
        }
        out.sort_by_key(|(_, d)| *d);
        out
    }

    pub fn visualize(&self) -> String {
        let mut dot = String::from("digraph code {\n  rankdir=LR;\n  node [shape=box, style=rounded, fontname=\"Helvetica\"];\n");
        for node in &self.nodes {
            let color = match node.kind.as_str() {
                "function" | "fn" => "#4FC3F7",
                "struct" | "class" | "type" => "#81C784",
                "method" => "#FFB74D",
                _ => "#CE93D8",
            };
            dot.push_str(&format!(
                "  \"{}\" [label=\"{}\\n({})\", fillcolor=\"{}\", style=\"filled,rounded\"];\n",
                node.id, node.name, node.kind, color
            ));
        }
        for edge in &self.edges {
            dot.push_str(&format!(
                "  \"{}\" -> \"{}\" [label=\"{}\", color=\"#90A4AE\"];\n",
                edge.from, edge.to, edge.kind
            ));
        }
        dot.push_str("}\n");
        dot
    }
}

// ---------------------------------------------------------------------------
// Extraction helpers
// ---------------------------------------------------------------------------

fn collect_source_files(root: &Path, out: &mut Vec<PathBuf>) {
    let Ok(entries) = std::fs::read_dir(root) else { return };
    for entry in entries.flatten() {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        if path.is_dir() {
            if IGNORED_DIRS.contains(&name.as_str()) || name.starts_with('.') {
                continue;
            }
            collect_source_files(&path, out);
        } else if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
            if SOURCE_EXTS.contains(&ext) {
                out.push(path);
            }
        }
    }
}

fn rel_path(root: &Path, path: &Path) -> String {
    path.strip_prefix(root)
        .unwrap_or(path)
        .to_string_lossy()
        .to_string()
}

/// Extract top-level symbols from source text using language-aware regexes.
fn extract_symbols(file: &str, content: &str) -> Vec<GraphNode> {
    let ext = Path::new(file).extension().and_then(|e| e.to_str()).unwrap_or("");
    let mut out = Vec::new();

    for (line_no, line) in content.lines().enumerate() {
        let t = line.trim();
        if t.starts_with("//") || t.starts_with('#') || t.starts_with("/*") || t.starts_with("*") {
            continue;
        }

        let symbol = match ext {
            "rs" => rust_symbol(t),
            "go" => go_symbol(t),
            "py" => python_symbol(t),
            "js" | "jsx" | "ts" | "tsx" => js_symbol(t),
            "java" | "c" | "h" | "cpp" | "cc" | "hpp" => clike_symbol(t),
            _ => None,
        };

        if let Some((name, kind)) = symbol {
            out.push(GraphNode {
                id: String::new(), // assigned later
                name,
                kind,
                file: file.to_string(),
                start_line: line_no + 1,
                end_line: line_no + 1,
                callers: Vec::new(),
                callees: Vec::new(),
            });
        }
    }
    out
}

fn rust_symbol(t: &str) -> Option<(String, String)> {
    if let Some(rest) = t.strip_prefix("pub fn ").or_else(|| t.strip_prefix("fn ")) {
        let name = first_ident(rest)?;
        return Some((name, "fn".into()));
    }
    if let Some(rest) = t.strip_prefix("pub struct ").or_else(|| t.strip_prefix("struct ")) {
        let name = first_ident(rest)?;
        return Some((name, "struct".into()));
    }
    if let Some(rest) = t.strip_prefix("pub enum ").or_else(|| t.strip_prefix("enum ")) {
        let name = first_ident(rest)?;
        return Some((name, "enum".into()));
    }
    if let Some(rest) = t.strip_prefix("pub trait ").or_else(|| t.strip_prefix("trait ")) {
        let name = first_ident(rest)?;
        return Some((name, "trait".into()));
    }
    if let Some(rest) = t.strip_prefix("pub impl ").or_else(|| t.strip_prefix("impl ")) {
        // impl Type or impl Trait for Type — capture the type.
        let name = rest
            .split_whitespace()
            .find(|w| !matches!(*w, "for" | "<" | ">"))
            .map(|w| w.trim_matches(|c| c == '<' || c == '>' || c == ',').to_string())?;
        return Some((name, "impl".into()));
    }
    if let Some(rest) = t.strip_prefix("pub mod ").or_else(|| t.strip_prefix("mod ")) {
        let name = first_ident(rest)?;
        return Some((name, "mod".into()));
    }
    if let Some(rest) = t.strip_prefix("pub const ").or_else(|| t.strip_prefix("const ")) {
        let name = first_ident(rest)?;
        return Some((name, "const".into()));
    }
    if let Some(rest) = t.strip_prefix("pub type ").or_else(|| t.strip_prefix("type ")) {
        let name = first_ident(rest)?;
        return Some((name, "type".into()));
    }
    None
}

fn go_symbol(t: &str) -> Option<(String, String)> {
    if let Some(rest) = t.strip_prefix("func ") {
        // func (r *Recv) Name(...) or func Name(...)
        let rest = if rest.starts_with('(') {
            // method: skip receiver up to matching ')'
            let close = rest.find(')')?;
            rest[close + 1..].trim_start()
        } else {
            rest
        };
        let name = first_ident(rest)?;
        return Some((name, if t.starts_with("func (") { "method" } else { "fn" }.into()));
    }
    if let Some(rest) = t.strip_prefix("type ") {
        let name = first_ident(rest)?;
        let kind = if rest.contains("struct") { "struct" } else { "type" };
        return Some((name, kind.into()));
    }
    None
}

fn python_symbol(t: &str) -> Option<(String, String)> {
    if let Some(rest) = t.strip_prefix("def ") {
        let name = first_ident(rest)?;
        let kind = if t.starts_with("    def ") || t.starts_with("\tdef ") { "method" } else { "fn" };
        return Some((name, kind.into()));
    }
    if let Some(rest) = t.strip_prefix("class ") {
        let name = first_ident(rest)?;
        return Some((name, "class".into()));
    }
    None
}

fn js_symbol(t: &str) -> Option<(String, String)> {
    for prefix in ["export function ", "function ", "export async function ", "async function "] {
        if let Some(rest) = t.strip_prefix(prefix) {
            let name = first_ident(rest)?;
            return Some((name, "fn".into()));
        }
    }
    for prefix in ["export class ", "class "] {
        if let Some(rest) = t.strip_prefix(prefix) {
            let name = first_ident(rest)?;
            return Some((name, "class".into()));
        }
    }
    // const foo = (...) => ... / export const foo = ...
    let t2 = t.strip_prefix("export ").unwrap_or(t);
    if let Some(rest) = t2.strip_prefix("const ").or_else(|| t2.strip_prefix("let ")) {
        if rest.contains("=>") || rest.contains("function") {
            let name = first_ident(rest)?;
            return Some((name, "fn".into()));
        }
        let name = first_ident(rest)?;
        return Some((name, "const".into()));
    }
    None
}

fn clike_symbol(t: &str) -> Option<(String, String)> {
    // Very rough: type name( ... or int name( ...  — skip control keywords.
    const KEYWORDS: &[&str] = &[
        "if", "for", "while", "switch", "return", "else", "do", "catch", "struct", "class",
        "namespace", "using", "public", "private", "protected", "static", "const",
    ];
    if t.ends_with(';') || t.contains("=") {
        // likely a variable or declaration, not a definition
    }
    let mut words = t.split_whitespace().filter(|w| !w.contains('(') || t.contains(w));
    let first = words.next()?;
    if KEYWORDS.contains(&first) {
        return None;
    }
    // Look for an identifier immediately followed by '('.
    let mut it = t.split(['(', ' ', '\t']);
    let mut prev: Option<&str> = None;
    for w in it.by_ref() {
        let w = w.trim();
        if w.is_empty() {
            continue;
        }
        if let Some(p) = prev {
            if !KEYWORDS.contains(&p) && p != "*" && p != "&" {
                return Some((p.to_string(), "fn".into()));
            }
        }
        prev = Some(w);
    }
    let _ = first;
    None
}

/// First Rust/Go/Python identifier at the start of a string.
fn first_ident(s: &str) -> Option<String> {
    let s = s.trim_start();
    let end = s
        .find(|c: char| !(c.is_ascii_alphanumeric() || c == '_' || c == ':'))
        .unwrap_or(s.len());
    let ident = &s[..end];
    if ident.is_empty() || !ident.chars().next()?.is_alphabetic() {
        return None;
    }
    // Strip a trailing ':' from paths like `foo::bar`.
    Some(ident.trim_end_matches(':').to_string())
}

/// True when `word` appears as a whole word in `line`.
fn contains_word(line: &str, word: &str) -> bool {
    let bytes = line.as_bytes();
    let w = word.as_bytes();
    if w.is_empty() || bytes.len() < w.len() {
        return false;
    }
    let mut i = 0;
    while i + w.len() <= bytes.len() {
        if &bytes[i..i + w.len()] == w {
            let before_ok = i == 0 || !is_ident_byte(bytes[i - 1]);
            let after_ok = i + w.len() >= bytes.len() || !is_ident_byte(bytes[i + w.len()]);
            if before_ok && after_ok {
                return true;
            }
        }
        i += 1;
    }
    false
}

fn is_ident_byte(b: u8) -> bool {
    b.is_ascii_alphanumeric() || b == b'_' || b == b':' || b == b'.'
}

fn resolve_def_file(
    _name_index: &HashMap<String, String>,
    nodes: &[GraphNode],
    name: &str,
) -> String {
    nodes
        .iter()
        .find(|n| n.name == name)
        .map(|n| n.file.clone())
        .unwrap_or_else(|| "unknown".into())
}

// ---------------------------------------------------------------------------
// CLI entry points
// ---------------------------------------------------------------------------

fn load_or_build(root: &Path) -> Result<CodeGraph> {
    let graph_path = root.join(".morse").join("graph.json");
    let mut graph = CodeGraph::new(root);
    if graph_path.exists() {
        graph.import(&graph_path)?;
        if !graph.nodes.is_empty() {
            return Ok(graph);
        }
    }
    graph.build()?;
    Ok(graph)
}
