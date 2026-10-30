//! Persistent cost tracking: records every LLM call (tokens + estimated cost)
//! to `.morse/usage.json` and reports daily/monthly spend against budgets.
//!
//! Cost is estimated from per-model pricing; free providers (Groq, Ollama)
//! cost $0.

use crate::config::Config;
use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::time::{Duration, SystemTime};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsageRecord {
    pub timestamp: SystemTime,
    pub provider: String,
    pub model: String,
    pub input_tokens: i64,
    pub output_tokens: i64,
    pub cost_usd: f64,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
struct UsageLog {
    #[serde(default)]
    records: Vec<UsageRecord>,
}

pub struct CostTracker {
    cfg: Config,
    path: PathBuf,
    records: Vec<UsageRecord>,
}

/// Rough USD per 1M tokens (input, output) by provider/model. Unknown = free
/// estimate 0 unless provider is known-paid.
fn price_per_million(provider: &str, model: &str) -> (f64, f64) {
    let m = model.to_lowercase();
    match provider {
        // Groq and Ollama are free.
        "groq" | "ollama" => (0.0, 0.0),
        "openai" => {
            if m.contains("gpt-4o-mini") {
                (0.15, 0.60)
            } else if m.contains("gpt-4o") {
                (2.50, 10.00)
            } else {
                (0.50, 1.50)
            }
        }
        "anthropic" => {
            if m.contains("haiku") {
                (0.80, 4.00)
            } else if m.contains("opus") {
                (15.00, 75.00)
            } else {
                (3.00, 15.00)
            }
        }
        "gemini" => {
            if m.contains("flash") {
                (0.10, 0.40)
            } else {
                (1.25, 5.00)
            }
        }
        "deepseek" => (0.27, 1.10),
        "mistral" => (2.00, 6.00),
        _ => (0.0, 0.0),
    }
}

/// Estimate the USD cost of a single call.
pub fn estimate_cost(provider: &str, model: &str, input_tokens: i64, output_tokens: i64) -> f64 {
    let (in_price, out_price) = price_per_million(provider, model);
    (input_tokens as f64 / 1_000_000.0) * in_price + (output_tokens as f64 / 1_000_000.0) * out_price
}

impl CostTracker {
    pub fn new(cfg: Config) -> Self {
        let path = std::env::current_dir()
            .map(|r| r.join(".morse").join("usage.json"))
            .unwrap_or_else(|_| PathBuf::from(".morse/usage.json"));
        let records = load_records(&path);
        Self { cfg, path, records }
    }

    pub fn load(cfg: Config, path: PathBuf) -> Self {
        let records = load_records(&path);
        Self { cfg, path, records }
    }

    /// Record a call, estimating cost from pricing, then persist.
    pub fn record_usage(
        &mut self,
        provider: String,
        model: String,
        input_tokens: i64,
        output_tokens: i64,
        cost_usd: f64,
    ) -> Result<()> {
        self.records.push(UsageRecord {
            timestamp: SystemTime::now(),
            provider,
            model,
            input_tokens,
            output_tokens,
            cost_usd,
        });
        self.persist()
    }

    /// Record with automatic cost estimation.
    pub fn record(&mut self, provider: &str, model: &str, input_tokens: i64, output_tokens: i64) -> Result<()> {
        let cost = estimate_cost(provider, model, input_tokens, output_tokens);
        self.record_usage(
            provider.to_string(),
            model.to_string(),
            input_tokens,
            output_tokens,
            cost,
        )
    }

    fn persist(&self) -> Result<()> {
        if let Some(parent) = self.path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let log = UsageLog { records: self.records.clone() };
        let json = serde_json::to_string_pretty(&log)?;
        std::fs::write(&self.path, json)?;
        Ok(())
    }

    fn in_window(&self, window: Duration) -> Vec<&UsageRecord> {
        let cutoff = SystemTime::now()
            .checked_sub(window)
            .unwrap_or(SystemTime::UNIX_EPOCH);
        self.records.iter().filter(|r| r.timestamp >= cutoff).collect()
    }

    pub fn check_budget(&self) -> Result<()> {
        let stats = self.get_stats();
        if stats.daily_spent > self.cfg.cost.daily_budget_usd {
            return Err(anyhow::anyhow!(
                "Daily budget exceeded: ${:.2} > ${:.2}",
                stats.daily_spent,
                self.cfg.cost.daily_budget_usd
            ));
        }
        if stats.monthly_spent > self.cfg.cost.monthly_budget_usd {
            return Err(anyhow::anyhow!(
                "Monthly budget exceeded: ${:.2} > ${:.2}",
                stats.monthly_spent,
                self.cfg.cost.monthly_budget_usd
            ));
        }
        Ok(())
    }

    pub fn get_stats(&self) -> CostStats {
        let daily = self.in_window(Duration::from_secs(24 * 3600));
        let monthly = self.in_window(Duration::from_secs(30 * 24 * 3600));

        let sum = |recs: &[&UsageRecord]| recs.iter().fold(0.0, |a, r| a + r.cost_usd);
        let tokens = |recs: &[&UsageRecord]| {
            recs.iter().map(|r| (r.input_tokens + r.output_tokens).max(0) as u64).sum::<u64>()
        };

        CostStats {
            daily_spent: sum(&daily),
            monthly_spent: sum(&monthly),
            tokens_used: tokens(&monthly),
            requests_count: monthly.len() as u64,
            tokens_today: tokens(&daily),
            requests_today: daily.len() as u64,
            daily_budget: self.cfg.cost.daily_budget_usd,
            monthly_budget: self.cfg.cost.monthly_budget_usd,
            all_time_spent: self.records.iter().fold(0.0, |a, r| a + r.cost_usd),
            total_records: self.records.len() as u64,
        }
    }
}

fn load_records(path: &PathBuf) -> Vec<UsageRecord> {
    std::fs::read_to_string(path)
        .ok()
        .and_then(|json| serde_json::from_str::<UsageLog>(&json).ok())
        .map(|log| log.records)
        .unwrap_or_default()
}

#[derive(Debug, Clone)]
pub struct CostStats {
    pub daily_spent: f64,
    pub monthly_spent: f64,
    pub tokens_used: u64,
    pub requests_count: u64,
    pub tokens_today: u64,
    pub requests_today: u64,
    pub daily_budget: f64,
    pub monthly_budget: f64,
    pub all_time_spent: f64,
    pub total_records: u64,
}

/// Record a real API call's usage (best-effort — never fails the caller).
/// This is what keeps `morse cost` and the rate limiter honest.
pub fn record_call(provider: &str, model: &str, input_tokens: i64, output_tokens: i64) {
    let mut tracker = CostTracker::new(Config::default());
    if let Err(e) = tracker.record(provider, model, input_tokens, output_tokens) {
        tracing::debug!(error = %e, "failed to record usage");
    }
}

impl CostStats {
    fn pct(spent: f64, budget: f64) -> f64 {
        if budget > 0.0 {
            spent / budget * 100.0
        } else {
            0.0
        }
    }
}

pub fn run(cfg: &Config) -> Result<()> {
    let tracker = CostTracker::new(cfg.clone());
    let s = tracker.get_stats();
    let ui = crate::ui::UI::new(true);

    ui.print(&ui.header(" Cost "));
    ui.print("");
    if s.total_records == 0 {
        ui.print(&ui.muted("No usage recorded yet."));
        ui.print(&ui.bullet("Usage is recorded on every AI call and stored in .morse/usage.json", 0));
        return Ok(());
    }

    let day_bar = bar(CostStats::pct(s.daily_spent, s.daily_budget));
    ui.print(&ui.kv_pair("today", &format!(
        "${:.4} / ${:.2}  {} {:.1}%",
        s.daily_spent, s.daily_budget, day_bar, CostStats::pct(s.daily_spent, s.daily_budget)
    )));
    let month_bar = bar(CostStats::pct(s.monthly_spent, s.monthly_budget));
    ui.print(&ui.kv_pair("30 days", &format!(
        "${:.4} / ${:.2}  {} {:.1}%",
        s.monthly_spent, s.monthly_budget, month_bar, CostStats::pct(s.monthly_spent, s.monthly_budget)
    )));
    ui.print(&ui.kv_pair("requests", &format!("{} (30d), {} total", s.requests_count, s.total_records)));
    ui.print(&ui.kv_pair("tokens", &format!("{} (30d)", s.tokens_used)));
    ui.print(&ui.kv_pair("all-time", &format!("${:.4}", s.all_time_spent)));

    if s.daily_spent > s.daily_budget {
        ui.print("");
        ui.print(&ui.error(&format!(
            "Daily budget exceeded (${:.2} > ${:.2})",
            s.daily_spent, s.daily_budget
        )));
    } else if s.monthly_spent > s.monthly_budget {
        ui.print("");
        ui.print(&ui.error(&format!(
            "Monthly budget exceeded (${:.2} > ${:.2})",
            s.monthly_spent, s.monthly_budget
        )));
    }
    Ok(())
}

fn bar(pct: f64) -> String {
    let width = 20;
    let filled = ((pct / 100.0) * width as f64).round().clamp(0.0, width as f64) as usize;
    format!("[{}{}]", "█".repeat(filled), "░".repeat(width - filled))
}

/// Convenience wrapper kept for callers.
pub fn record_usage(
    tracker: &mut CostTracker,
    provider: String,
    model: String,
    input_tokens: i64,
    output_tokens: i64,
    cost_usd: f64,
) -> Result<()> {
    tracker.record_usage(provider, model, input_tokens, output_tokens, cost_usd)
}

// Re-export a config-loading helper used by tests.
pub fn tracker_for_path(cfg: Config, path: PathBuf) -> CostTracker {
    CostTracker::load(cfg, path)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_tracker() -> CostTracker {
        let dir = std::env::temp_dir().join(format!("cost-test-{}", uuid::Uuid::new_v4()));
        let _ = std::fs::create_dir_all(&dir);
        CostTracker::load(Config::default(), dir.join("usage.json"))
    }

    #[test]
    fn estimate_cost_free_and_paid() {
        assert_eq!(estimate_cost("groq", "llama", 1000, 1000), 0.0);
        assert_eq!(estimate_cost("ollama", "llama3", 1000, 1000), 0.0);
        // gpt-4o-mini: 1M in @ 0.15 -> 1000 tokens = 0.00015
        let c = estimate_cost("openai", "gpt-4o-mini", 1_000_000, 0);
        assert!((c - 0.15).abs() < 1e-9, "got {}", c);
    }

    #[test]
    fn record_and_stats_accumulate() {
        let mut t = temp_tracker();
        t.record("openai", "gpt-4o-mini", 1_000_000, 1_000_000).unwrap();
        let s = t.get_stats();
        assert_eq!(s.total_records, 1);
        assert_eq!(s.requests_count, 1);
        assert!(s.daily_spent > 0.0, "paid call should cost something");
        let _ = std::fs::remove_file(&t.path);
    }

    #[test]
    fn persists_across_instances() {
        let dir = std::env::temp_dir().join(format!("cost-test-{}", uuid::Uuid::new_v4()));
        let _ = std::fs::create_dir_all(&dir);
        let path = dir.join("usage.json");

        let mut t = CostTracker::load(Config::default(), path.clone());
        t.record("anthropic", "claude-sonnet-4-5", 100_000, 50_000).unwrap();
        drop(t);

        let t2 = CostTracker::load(Config::default(), path.clone());
        assert_eq!(t2.get_stats().total_records, 1);
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn budget_check_flags_exceeded() {
        let mut cfg = Config::default();
        cfg.cost.daily_budget_usd = 0.00001;
        let dir = std::env::temp_dir().join(format!("cost-test-{}", uuid::Uuid::new_v4()));
        let _ = std::fs::create_dir_all(&dir);
        let mut t = CostTracker::load(cfg, dir.join("usage.json"));
        t.record("openai", "gpt-4o", 1_000_000, 1_000_000).unwrap();
        assert!(t.check_budget().is_err(), "should exceed tiny budget");
        let _ = std::fs::remove_file(t.path);
    }
}
