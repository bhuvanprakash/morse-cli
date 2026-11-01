use crate::config::Config;
use anyhow::Result;
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct ProvenanceEntry {
    pub id: String,
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub request: String,
    pub reasoning_chain: Vec<ReasoningStep>,
    pub files_changed: Vec<String>,
    pub confidence_history: Vec<f64>,
    pub alternatives_considered: Vec<String>,
    pub test_results: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ReasoningStep {
    pub step: usize,
    pub description: String,
    pub reason: String,
    pub confidence: f64,
    pub files_read: Vec<String>,
    pub files_changed: Vec<String>,
}

pub struct ProvenanceTracker {
    entries: Vec<ProvenanceEntry>,
}

impl Default for ProvenanceTracker {
    fn default() -> Self {
        Self::new()
    }
}

impl ProvenanceTracker {
    pub fn new() -> Self {
        Self { entries: Vec::new() }
    }

    pub fn record(&mut self, entry: ProvenanceEntry) {
        self.entries.push(entry);
    }

    pub fn export_json(&self) -> Result<String> {
        Ok(serde_json::to_string_pretty(&self.entries)?)
    }

    pub fn last_change(&self) -> Option<&ProvenanceEntry> {
        self.entries.last()
    }
}

pub async fn explain_last_change(cfg: &Config) -> Result<()> {
    let _ = cfg;
    let tracker = ProvenanceTracker::new();
    if let Some(entry) = tracker.last_change() {
        println!("Last change provenance:");
        println!("  Request: {}", entry.request);
        println!("  Files changed: {:?}", entry.files_changed);
        for step in &entry.reasoning_chain {
            println!("  Step {}: {} (confidence: {:.0}%)", step.step, step.description, step.confidence * 100.0);
        }
    } else {
        println!("No provenance history found.");
    }
    Ok(())
}

pub async fn export_provenance(cfg: &Config) -> Result<()> {
    let _ = cfg;
    let tracker = ProvenanceTracker::new();
    let json = tracker.export_json()?;
    println!("{}", json);
    Ok(())
}
