//! Rate limiting & budget enforcement.
//!
//! Reads the persisted usage log (`.morse/usage.json` via the cost module)
//! and blocks a request before it would exceed the daily/monthly cost budget
//! or the daily request/token ceilings. Budgets of `0` mean "unlimited".
//!
//! Providers call [`gate`] before dispatching so runaway usage is stopped
//! *before* it bills you, not after.

use crate::config::Config;
use crate::cost::{self, CostStats};
use anyhow::{bail, Result};

/// Conservative defaults; cost budgets come from config.
const DEFAULT_MAX_REQUESTS_PER_DAY: u64 = 1_000;
const DEFAULT_MAX_TOKENS_PER_DAY: u64 = 4_000_000;

#[derive(Debug, Clone)]
pub struct RateLimiter {
    cfg: Config,
    max_requests_per_day: u64,
    max_tokens_per_day: u64,
}

/// A computed view of current usage vs. limits.
#[derive(Debug, Clone)]
pub struct LimitStatus {
    pub requests_today: u64,
    pub max_requests_per_day: u64,
    pub tokens_today: u64,
    pub max_tokens_per_day: u64,
    pub daily_spent: f64,
    pub daily_budget: f64,
    pub monthly_spent: f64,
    pub monthly_budget: f64,
    pub blocked: bool,
    pub reason: Option<String>,
    pub daily_pct: f32,
    pub monthly_pct: f32,
}

impl RateLimiter {
    pub fn new(cfg: Config) -> Self {
        Self {
            cfg,
            max_requests_per_day: DEFAULT_MAX_REQUESTS_PER_DAY,
            max_tokens_per_day: DEFAULT_MAX_TOKENS_PER_DAY,
        }
    }

    pub fn with_limits(cfg: Config, max_requests: u64, max_tokens: u64) -> Self {
        Self { cfg, max_requests_per_day: max_requests, max_tokens_per_day: max_tokens }
    }

    /// Load current usage from the persisted log and evaluate it.
    pub fn status(&self) -> LimitStatus {
        let stats = cost::CostTracker::new(self.cfg.clone()).get_stats();
        self.evaluate(&stats)
    }

    /// Pure evaluation (unit-testable) of stats against limits.
    fn evaluate(&self, s: &CostStats) -> LimitStatus {
        let daily_budget = self.cfg.cost.daily_budget_usd;
        let monthly_budget = self.cfg.cost.monthly_budget_usd;

        let mut blocked = false;
        let mut reason = None;

        // Cost budgets (0 = unlimited).
        if daily_budget > 0.0 && s.daily_spent >= daily_budget {
            blocked = true;
            reason = Some(format!(
                "daily budget reached (${:.4} / ${:.2})",
                s.daily_spent, daily_budget
            ));
        } else if monthly_budget > 0.0 && s.monthly_spent >= monthly_budget {
            blocked = true;
            reason = Some(format!(
                "monthly budget reached (${:.4} / ${:.2})",
                s.monthly_spent, monthly_budget
            ));
        } else if s.requests_today >= self.max_requests_per_day {
            blocked = true;
            reason = Some(format!(
                "daily request ceiling reached ({}/{})",
                s.requests_today, self.max_requests_per_day
            ));
        } else if s.tokens_today >= self.max_tokens_per_day {
            blocked = true;
            reason = Some(format!(
                "daily token ceiling reached ({}/{})",
                s.tokens_today, self.max_tokens_per_day
            ));
        }

        let pct = |used: f64, budget: f64| -> f32 {
            if budget > 0.0 {
                (used / budget * 100.0).min(100.0) as f32
            } else {
                0.0
            }
        };

        LimitStatus {
            requests_today: s.requests_today,
            max_requests_per_day: self.max_requests_per_day,
            tokens_today: s.tokens_today,
            max_tokens_per_day: self.max_tokens_per_day,
            daily_spent: s.daily_spent,
            daily_budget,
            monthly_spent: s.monthly_spent,
            monthly_budget,
            blocked,
            reason,
            daily_pct: pct(s.daily_spent, daily_budget),
            monthly_pct: pct(s.monthly_spent, monthly_budget),
        }
    }

    /// Returns an error when the next request would violate a limit.
    pub fn check(&self) -> Result<LimitStatus> {
        let status = self.status();
        if status.blocked {
            bail!(
                "rate limit: {} — adjust budgets in config or wait for the daily window to reset",
                status.reason.unwrap_or_default()
            );
        }
        Ok(status)
    }
}

/// Pre-flight gate called by providers before dispatching a request.
pub fn gate(cfg: &Config) -> Result<LimitStatus> {
    RateLimiter::new(cfg.clone()).check()
}

pub fn run(cfg: &Config) -> Result<()> {
    let limiter = RateLimiter::new(cfg.clone());
    let st = limiter.status();
    let ui = crate::ui::UI::new(true);

    ui.print(&ui.header(" Rate Limits "));
    ui.print("");
    let bar = |pct: f32| {
        let width = 20;
        let filled = ((pct / 100.0) * width as f32).round().clamp(0.0, width as f32) as usize;
        format!("[{}{}]", "█".repeat(filled), "░".repeat(width - filled))
    };

    ui.print(&ui.kv_pair(
        "daily cost",
        &format!(
            "${:.4} / ${:.2} {} {:.1}%",
            st.daily_spent,
            st.daily_budget,
            bar(st.daily_pct),
            st.daily_pct
        ),
    ));
    ui.print(&ui.kv_pair(
        "monthly cost",
        &format!(
            "${:.4} / ${:.2} {} {:.1}%",
            st.monthly_spent,
            st.monthly_budget,
            bar(st.monthly_pct),
            st.monthly_pct
        ),
    ));
    ui.print(&ui.kv_pair(
        "requests",
        &format!("{}/{} today", st.requests_today, st.max_requests_per_day),
    ));
    ui.print(&ui.kv_pair(
        "tokens",
        &format!("{}/{} today", st.tokens_today, st.max_tokens_per_day),
    ));

    ui.print("");
    if st.blocked {
        ui.print(&ui.error(&format!("BLOCKED — {}", st.reason.unwrap_or_default())));
        ui.print(&ui.muted("New requests are refused until the budget/window resets."));
    } else {
        ui.print(&ui.success("OK — new requests allowed"));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn stats(daily_spent: f64, monthly_spent: f64, requests: u64, tokens: u64) -> CostStats {
        CostStats {
            daily_spent,
            monthly_spent,
            tokens_used: tokens,
            requests_count: requests,
            tokens_today: tokens,
            requests_today: requests,
            daily_budget: 0.0,
            monthly_budget: 0.0,
            all_time_spent: monthly_spent,
            total_records: requests,
        }
    }

    fn limiter_with(daily: f64, monthly: f64, max_req: u64, max_tok: u64) -> RateLimiter {
        let mut cfg = Config::default();
        cfg.cost.daily_budget_usd = daily;
        cfg.cost.monthly_budget_usd = monthly;
        RateLimiter::with_limits(cfg, max_req, max_tok)
    }

    #[test]
    fn allows_when_under_budget() {
        let l = limiter_with(5.0, 100.0, 100, 1_000_000);
        let st = l.evaluate(&stats(1.0, 10.0, 5, 500));
        assert!(!st.blocked, "should allow: {:?}", st.reason);
        assert!(st.daily_pct > 0.0 && st.daily_pct < 100.0);
    }

    #[test]
    fn blocks_on_daily_budget() {
        let l = limiter_with(5.0, 100.0, 1000, 1_000_000);
        let st = l.evaluate(&stats(5.0, 10.0, 5, 500));
        assert!(st.blocked);
        assert!(st.reason.unwrap().contains("daily budget"));
    }

    #[test]
    fn blocks_on_monthly_budget() {
        let l = limiter_with(5.0, 100.0, 1000, 1_000_000);
        let st = l.evaluate(&stats(1.0, 100.0, 5, 500));
        assert!(st.blocked);
        assert!(st.reason.unwrap().contains("monthly budget"));
    }

    #[test]
    fn blocks_on_request_ceiling() {
        let l = limiter_with(0.0, 0.0, 10, 1_000_000); // cost unlimited
        let st = l.evaluate(&stats(0.0, 0.0, 10, 500));
        assert!(st.blocked);
        assert!(st.reason.unwrap().contains("request ceiling"));
    }

    #[test]
    fn blocks_on_token_ceiling() {
        let l = limiter_with(0.0, 0.0, 1000, 100);
        let st = l.evaluate(&stats(0.0, 0.0, 5, 100));
        assert!(st.blocked);
        assert!(st.reason.unwrap().contains("token ceiling"));
    }

    #[test]
    fn zero_budget_means_unlimited() {
        let l = limiter_with(0.0, 0.0, 1000, 1_000_000);
        let st = l.evaluate(&stats(9999.0, 9999.0, 5, 500));
        assert!(!st.blocked, "zero budget = unlimited cost");
        assert_eq!(st.daily_pct, 0.0);
    }
}
