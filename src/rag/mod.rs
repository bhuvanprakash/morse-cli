//! Retrieval-augmented generation index: chunks source files, scores them
//! against a query with a BM25-style lexical ranker, and persists to disk.
//!
//! This is intentionally network-free (no embedding API needed) so it works
//! offline and instantly. Chunk embeddings are approximated by TF-IDF term
//! vectors; the search computes a BM25 score over them.

use crate::config::Config;
use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;

const SOURCE_EXTS: &[&str] = &[
    "rs", "go", "py", "js", "jsx", "ts", "tsx", "java", "c", "h", "cpp", "cc", "hpp", "md",
    "txt", "toml", "yaml", "yml", "json",
];
const IGNORED_DIRS: &[&str] = &[
    "node_modules", "target", ".git", "dist", "build", "vendor", ".venv", "__pycache__",
];
const DEFAULT_CHUNK_LINES: usize = 60;
const MAX_CHUNK_CHARS: usize = 1800;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RagDocument {
    pub id: String,
    pub content: String,
    /// Sparse TF-IDF vector stored as (term -> weight).
    #[serde(default)]
    pub embedding: HashMap<String, f32>,
    pub metadata: serde_json::Value,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct RagIndex {
    #[serde(default)]
    documents: Vec<RagDocument>,
    #[serde(default)]
    df: HashMap<String, usize>,
    #[serde(default)]
    built: bool,
}

impl RagIndex {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn add(&mut self, doc: RagDocument) {
        // Update document frequency for each unique term.
        let mut seen: std::collections::HashSet<&str> = std::collections::HashSet::new();
        for term in doc.embedding.keys() {
            if seen.insert(term.as_str()) {
                *self.df.entry(term.clone()).or_insert(0) += 1;
            }
        }
        self.documents.push(doc);
        self.built = false;
    }

    pub fn len(&self) -> usize {
        self.documents.len()
    }

    pub fn is_empty(&self) -> bool {
        self.documents.is_empty()
    }

    /// BM25-style ranking over the stored TF-IDV vectors.
    pub fn search(&self, query: &str, top_k: usize) -> Vec<(&RagDocument, f32)> {
        if self.documents.is_empty() {
            return vec![];
        }
        let n = self.documents.len() as f64;
        let avgdl: f64 = self
            .documents
            .iter()
            .map(|d| d.embedding.values().map(|w| *w as f64).sum::<f64>().max(1.0))
            .sum::<f64>()
            / n;

        let q_terms = tokenize(query);
        if q_terms.is_empty() {
            return vec![];
        }

        const K1: f64 = 1.2;
        const B: f64 = 0.75;

        let mut scored: Vec<(&RagDocument, f32)> = Vec::new();
        for doc in &self.documents {
            let dl: f64 = doc.embedding.values().map(|w| *w as f64).sum::<f64>().max(1.0);
            let mut score = 0.0f64;
            for term in &q_terms {
                let tf = *doc.embedding.get(term).unwrap_or(&0.0) as f64;
                if tf == 0.0 {
                    continue;
                }
                let df = *self.df.get(term).unwrap_or(&1) as f64;
                let idf = ((n - df + 0.5) / (df + 0.5) + 1.0).ln();
                let norm = tf * (K1 + 1.0)
                    / (tf + K1 * (1.0 - B + B * dl / avgdl.max(1.0)));
                score += idf * norm;
            }
            // Small boost for exact phrase matches in the raw content.
            let ql = query.to_lowercase();
            if !ql.is_empty() && doc.content.to_lowercase().contains(&ql) {
                score *= 2.0;
            }
            if score > 0.0 {
                scored.push((doc, score as f32));
            }
        }
        scored.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
        scored.truncate(top_k.max(1));
        scored
    }

    pub fn save(&self, path: &Path) -> Result<()> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let json = serde_json::to_string(self)?;
        std::fs::write(path, json)?;
        Ok(())
    }

    pub fn load(path: &Path) -> Result<Self> {
        let json = std::fs::read_to_string(path)
            .with_context(|| format!("reading RAG index at {}", path.display()))?;
        let idx: RagIndex = serde_json::from_str(&json)
            .with_context(|| format!("parsing RAG index at {}", path.display()))?;
        Ok(idx)
    }
}

/// Build a TF-IDV weighted term vector for a chunk of text.
fn embed(content: &str) -> HashMap<String, f32> {
    let terms = tokenize(content);
    if terms.is_empty() {
        return HashMap::new();
    }
    let mut tf: HashMap<String, f32> = HashMap::new();
    for t in &terms {
        *tf.entry(t.clone()).or_insert(0.0) += 1.0;
    }
    let total = terms.len() as f32;
    tf.into_iter()
        .map(|(k, v)| (k, v / total))
        .collect()
}

/// Lowercase, split on non-alphanumeric, drop stopwords and very short tokens.
fn tokenize(text: &str) -> Vec<String> {
    const STOPWORDS: &[&str] = &[
        "the", "and", "for", "are", "but", "not", "you", "all", "can", "had", "her", "was",
        "one", "our", "out", "has", "have", "this", "that", "with", "from", "they", "will",
        "would", "there", "their", "what", "about", "which", "when", "your", "how", "into",
        "a", "an", "of", "to", "in", "is", "it", "on", "as", "at", "be", "by", "or", "if",
        "so", "we", "i", "do", "no", "up", "fn", "let", "mut",
    ];
    text.to_lowercase()
        .split(|c: char| !c.is_ascii_alphanumeric() && c != '_')
        .filter(|w| w.len() >= 2 && !STOPWORDS.contains(w))
        .map(|w| w.to_string())
        .collect()
}

/// Split a file into overlapping line-based chunks.
fn chunk_file(rel: &str, content: &str, chunk_lines: usize) -> Vec<RagDocument> {
    let lines: Vec<&str> = content.lines().collect();
    if lines.is_empty() {
        return vec![];
    }
    let chunk_lines = chunk_lines.max(10);
    let overlap = (chunk_lines / 6).max(1);
    let mut out = Vec::new();
    let mut start = 0usize;
    let mut idx = 0usize;

    while start < lines.len() {
        let end = (start + chunk_lines).min(lines.len());
        let mut text = lines[start..end].join("\n");
        if text.len() > MAX_CHUNK_CHARS {
            text.truncate(MAX_CHUNK_CHARS);
        }
        if !text.trim().is_empty() {
            let id = format!("{}#{}", rel, idx);
            out.push(RagDocument {
                id: id.clone(),
                content: text.clone(),
                embedding: embed(&text),
                metadata: serde_json::json!({
                    "file": rel,
                    "start_line": start + 1,
                    "end_line": end,
                }),
            });
            idx += 1;
        }
        if end == lines.len() {
            break;
        }
        start = end - overlap;
    }
    out
}

fn collect_files(root: &Path, out: &mut Vec<std::path::PathBuf>) {
    let Ok(entries) = std::fs::read_dir(root) else { return };
    for entry in entries.flatten() {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        if path.is_dir() {
            if IGNORED_DIRS.contains(&name.as_str()) || name.starts_with('.') {
                continue;
            }
            collect_files(&path, out);
        } else if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
            if SOURCE_EXTS.contains(&ext) {
                out.push(path);
            }
        }
    }
}

pub fn index_path(root: &Path) -> std::path::PathBuf {
    root.join(".morse").join("rag_index.json")
}

/// Build (or rebuild) the index over the current project.
pub fn init(cfg: &Config) -> Result<()> {
    let _ = cfg;
    let root = std::env::current_dir()?;
    std::fs::create_dir_all(root.join(".morse")).ok();

    let chunk_lines = cfg.rag.chunk_size / 24; // approximate chars->lines
    let mut index = RagIndex::new();
    let mut files = Vec::new();
    collect_files(&root, &mut files);

    let mut file_count = 0usize;
    for path in &files {
        let Ok(content) = std::fs::read_to_string(path) else { continue };
        // Skip very large files.
        if content.len() > 400_000 {
            continue;
        }
        let rel = path
            .strip_prefix(&root)
            .unwrap_or(path)
            .to_string_lossy()
            .to_string();
        let chunks = chunk_file(&rel, &content, chunk_lines.max(DEFAULT_CHUNK_LINES));
        if !chunks.is_empty() {
            file_count += 1;
        }
        for c in chunks {
            index.add(c);
        }
    }

    let out = index_path(&root);
    index.save(&out)?;
    println!("RAG index initialized at {}", out.display());
    println!("  Files indexed: {}", file_count);
    println!("  Chunks: {}", index.len());
    Ok(())
}

/// Search the index, building it first if missing.
pub fn search(cfg: &Config, q: &str) -> Result<()> {
    let _ = cfg;
    let root = std::env::current_dir()?;
    let path = index_path(&root);

    let index = if path.exists() {
        RagIndex::load(&path)?
    } else {
        println!("Index not found, building...");
        let mut idx = RagIndex::new();
        let mut files = Vec::new();
        collect_files(&root, &mut files);
        for f in &files {
            let Ok(content) = std::fs::read_to_string(f) else { continue };
            if content.len() > 400_000 {
                continue;
            }
            let rel = f.strip_prefix(&root).unwrap_or(f).to_string_lossy().to_string();
            for c in chunk_file(&rel, &content, DEFAULT_CHUNK_LINES) {
                idx.add(c);
            }
        }
        idx.save(&path)?;
        idx
    };

    if index.is_empty() {
        println!("No documents in index. Run 'morse rag-init' from your project root.");
        return Ok(());
    }

    let top_k = cfg.rag.top_k.max(3);
    let results = index.search(q, top_k);
    if results.is_empty() {
        println!("No matches for '{}'", q);
        return Ok(());
    }

    println!("Top {} matches for '{}':\n", results.len(), q);
    for (rank, (doc, score)) in results.iter().enumerate() {
        let file = doc.metadata["file"].as_str().unwrap_or("?");
        let start = doc.metadata["start_line"].as_u64().unwrap_or(0);
        let end = doc.metadata["end_line"].as_u64().unwrap_or(0);
        println!("{}. {} (score {:.3})  {}:{}-{}", rank + 1, doc.id, score, file, start, end);
        // Show a short preview.
        let preview: String = doc.content.chars().take(160).collect();
        for pl in preview.lines().take(3) {
            println!("   | {}", pl.trim());
        }
        println!();
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tokenize_filters_stopwords_and_short() {
        let t = tokenize("the quick brown fox and a go");
        assert!(!t.contains(&"the".to_string()));
        assert!(!t.contains(&"and".to_string()));
        assert!(t.contains(&"quick".to_string()));
        assert!(t.contains(&"fox".to_string()));
    }

    #[test]
    fn search_ranks_relevant_chunk_first() {
        let mut idx = RagIndex::new();
        let a = chunk_file("auth.rs", "fn login(user: &str) { check_password(user); }", 40);
        let b = chunk_file("math.rs", "fn add(a: i32, b: i32) -> i32 { a + b }", 40);
        for d in a.into_iter().chain(b) {
            idx.add(d);
        }
        let res = idx.search("login password auth", 3);
        assert!(!res.is_empty());
        assert!(res[0].0.content.contains("login"), "auth chunk should rank first");
    }

    #[test]
    fn save_load_roundtrip() {
        let dir = std::env::temp_dir().join(format!("rag-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let mut idx = RagIndex::new();
        for d in chunk_file("x.rs", "fn alpha() {}\nfn beta() {}", 40) {
            idx.add(d);
        }
        let p = dir.join("idx.json");
        idx.save(&p).unwrap();
        let loaded = RagIndex::load(&p).unwrap();
        assert_eq!(loaded.len(), idx.len());
        assert!(!loaded.search("alpha", 1).is_empty());
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn empty_index_returns_no_results() {
        let idx = RagIndex::new();
        assert!(idx.search("anything", 5).is_empty());
    }
}
