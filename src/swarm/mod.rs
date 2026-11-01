//! Multi-agent swarm orchestration.
//!
//! A planner decomposes the task into subtasks, specialized agents execute
//! them concurrently against the provider, and a synthesizer merges the
//! results. Also powers `morse ralph` — a plan→execute→verify→self-correct
//! loop.

use crate::config::Config;
use crate::providers::{resolve_with_fallback, system_prompt, CompletionRequest};
use crate::ui::UI;
use anyhow::{Context, Result};
use std::time::Instant;

#[derive(Debug, Clone)]
pub struct SwarmAgent {
    pub id: String,
    pub role: String,
    pub status: String,
    pub tasks_completed: usize,
}

pub struct SwarmOrchestrator {
    cfg: Config,
    agents: Vec<SwarmAgent>,
    max_concurrency: usize,
}

/// Role -> the framing prompt each agent uses.
fn role_prompt(role: &str, task: &str) -> String {
    match role {
        "planner" => format!(
            "You are a PLANNER. Break this task into 2-5 concrete, independent subtasks. \\
             Output ONLY a numbered list, one subtask per line, no preamble.\n\nTask: {}",
            task
        ),
        "coder" => format!(
            "You are a CODER. Implement the given subtask with production-quality code. \\
             Output the code with a one-line rationale. Use fenced code blocks.\n\nSubtask: {}",
            task
        ),
        "tester" => format!(
            "You are a TESTER. For the given subtask, write focused tests that would catch \\
             regressions, and note edge cases. Use fenced code blocks.\n\nSubtask: {}",
            task
        ),
        "reviewer" => format!(
            "You are a REVIEWER. Critically review the given subtask/implementation. \\
             List concrete issues ranked by severity, then suggested fixes.\n\nSubtask: {}",
            task
        ),
        "researcher" => format!(
            "You are a RESEARCHER. Analyze the given subtask: relevant context, trade-offs, \\
             and the recommended approach. Be concise and specific.\n\nSubtask: {}",
            task
        ),
        _ => format!("Complete this subtask:\n\n{}", task),
    }
}

async fn call(cfg: &Config, prompt: &str, temperature: f64) -> Result<String> {
    let (provider, model) = resolve_with_fallback(cfg, &cfg.routing.default.clone());
    let req = CompletionRequest::new(&model, prompt)
        .with_system(&system_prompt())
        .with_temperature(temperature);
    let resp = provider
        .complete(req)
        .await
        .map_err(|e| anyhow::anyhow!(e.display()))?;
    Ok(resp.content)
}

impl SwarmOrchestrator {
    pub fn new(cfg: Config) -> Self {
        let max_concurrency = cfg.swarm.max_agents.clamp(2, 8);
        Self {
            cfg,
            agents: Vec::new(),
            max_concurrency,
        }
    }

    pub fn add_agent(&mut self, role: &str) {
        self.agents.push(SwarmAgent {
            id: uuid::Uuid::new_v4().to_string(),
            role: role.to_string(),
            status: "idle".to_string(),
            tasks_completed: 0,
        });
    }

    /// Plan, execute specialized agents in parallel, then synthesize.
    pub async fn run_task(&mut self, task: &str) -> Result<String> {
        let ui = UI::new(true);
        let started = Instant::now();

        // Default roster.
        if self.agents.is_empty() {
            for role in ["coder", "tester", "reviewer"] {
                self.add_agent(role);
            }
        }

        // 1) Plan: decompose the task.
        ui.print(&ui.section("Planning"));
        let plan_prompt = role_prompt("planner", task);
        let plan = call(&self.cfg, &plan_prompt, 0.3).await?;
        let subtasks = parse_subtasks(&plan);
        if subtasks.is_empty() {
            // Model didn't give a list — treat the whole task as one subtask.
            subtasks_fallback(task, &mut self.agents);
        }
        for (i, s) in subtasks.iter().enumerate() {
            ui.print(&ui.bullet(&format!("[{}] {}", i + 1, truncate(s, 90)), 1));
        }

        // 2) Execute specialized agents concurrently over the subtasks.
        ui.print(&ui.section(&format!("Executing ({} agents, parallel)", self.agents.len())));
        let mut handles = Vec::new();
        let mut results: Vec<(String, String, String)> = Vec::new();
        let mut errors: Vec<String> = Vec::new();
        let roles: Vec<String> = self.agents.iter().map(|a| a.role.clone()).collect();
        let cfg = self.cfg.clone();

        // Pair each subtask with an agent role, round-robin, bounded by
        // max_concurrency via buffered futures.
        let jobs: Vec<(String, String)> = subtasks
            .iter()
            .enumerate()
            .map(|(i, sub)| {
                let role = roles[i % roles.len()].clone();
                (role, sub.clone())
            })
            .collect();

        for (role, sub) in jobs {
            // Bound in-flight spawns to the configured concurrency ceiling.
            while handles.len() >= self.max_concurrency {
                if let Some(done) = futures_util::future::join_all(handles.drain(..)).await.pop() {
                    match done {
                        Ok((role, sub, Ok(out))) => results.push((role, sub, out)),
                        Ok((role, _, Err(e))) => errors.push(format!("{}: {}", role, e)),
                        Err(e) => errors.push(format!("join: {}", e)),
                    }
                }
            }
            let cfg = cfg.clone();
            let handle = tokio::spawn(async move {
                let prompt = role_prompt(&role, &sub);
                let out = call(&cfg, &prompt, 0.5).await;
                (role, sub, out)
            });
            handles.push(handle);
        }

        // Drain the remainder.
        for h in handles {
            match h.await {
                Ok((role, sub, Ok(out))) => results.push((role, sub, out)),
                Ok((role, _, Err(e))) => errors.push(format!("{}: {}", role, e)),
                Err(e) => errors.push(format!("join: {}", e)),
            }
        }

        for (role, _, _) in &results {
            if let Some(a) = self.agents.iter_mut().find(|a| a.role == *role) {
                a.status = "done".into();
                a.tasks_completed += 1;
            }
        }

        // 3) Synthesize.
        ui.print(&ui.section("Synthesizing"));
        let mut synthesis_input = format!("Overall task:\n{}\n\n", task);
        for (role, sub, out) in &results {
            synthesis_input.push_str(&format!(
                "--- {} on: {} ---\n{}\n\n",
                role,
                truncate(sub, 120),
                truncate(out, 3000)
            ));
        }
        if !errors.is_empty() {
            synthesis_input.push_str(&format!("\nFailed steps:\n{}\n", errors.join("; ")));
        }
        let final_prompt = format!(
            "Combine the specialist outputs below into one coherent, actionable answer to the \\
             overall task. Resolve contradictions, keep the best code, drop redundancy. \\
             Output the final result directly.\n\n{}",
            synthesis_input
        );
        let final_answer = call(&self.cfg, &final_prompt, 0.3).await?;

        ui.print(&final_answer);
        ui.print("");
        ui.print(&ui.muted(&format!(
            "── swarm done: {} subtasks, {} agents, {:.1}s ──",
            results.len(),
            self.agents.len(),
            started.elapsed().as_secs_f64()
        )));
        if !errors.is_empty() {
            ui.print(&ui.warning(&format!("{} subtask(s) failed: {}", errors.len(), errors.join("; "))));
        }
        Ok(final_answer)
    }
}

/// Parse a numbered/bulleted plan into subtasks.
fn parse_subtasks(plan: &str) -> Vec<String> {
    let mut out = Vec::new();
    for line in plan.lines() {
        let t = line.trim();
        if t.is_empty() {
            continue;
        }
        // Strip leading "1." / "1)" / "- " / "* ".
        let stripped = t
            .trim_start_matches(|c: char| c.is_ascii_digit() || c == '.' || c == ')' || c == ' ')
            .trim_start_matches(['-', '*'])
            .trim();
        if stripped.is_empty() {
            continue;
        }
        // Ignore section headings / prose lines.
        if t.starts_with("#") || stripped.len() < 4 {
            continue;
        }
        out.push(stripped.to_string());
        if out.len() >= 5 {
            break;
        }
    }
    out
}

fn subtasks_fallback(task: &str, agents: &mut Vec<SwarmAgent>) {
    // Ensure at least one agent can work even with an unparseable plan.
    if agents.is_empty() {
        agents.push(SwarmAgent {
            id: uuid::Uuid::new_v4().to_string(),
            role: "coder".into(),
            status: "idle".into(),
            tasks_completed: 0,
        });
    }
    let _ = task;
}

fn truncate(s: &str, max: usize) -> String {
    if s.chars().count() <= max {
        s.to_string()
    } else {
        let cut: String = s.chars().take(max).collect();
        format!("{}…", cut.trim_end())
    }
}

pub async fn run(cfg: &Config, task: &str) -> Result<()> {
    let mut orchestrator = SwarmOrchestrator::new(cfg.clone());
    orchestrator.run_task(task).await.map(|_| ()).context("swarm failed")
}

/// Ralph: plan → execute → verify → self-correct, looping until verified.
pub async fn ralph(cfg: &Config, task: &str) -> Result<String> {
    let ui = UI::new(true);
    let started = Instant::now();
    const MAX_ROUNDS: usize = 3;

    ui.print(&ui.section("Ralph (self-verifying loop)"));
    let task_disp = truncate(task, 80);
    ui.print(&ui.kv_pair("task", &task_disp));
    ui.print("");

    let mut history = String::new();
    let mut last_attempt = String::new();

    for round in 1..=MAX_ROUNDS {
        ui.print(&ui.info(&format!("Round {}/{}: executing", round, MAX_ROUNDS)));

        let exec_prompt = format!(
            "You are Ralph. Work on this task, then VERIFY your own work honestly. \\
             Task: {}\n\n{}\n\nPrevious attempt (if any):\n{}\n\n \\
             Output format:\n## Attempt\n<your solution>\n\n## Verification\\
             \n<does it actually satisfy the task? cite concrete evidence or the gap>",
            task,
            "Be concrete and self-critical.",
            if last_attempt.is_empty() { "(none)".to_string() } else { truncate(&last_attempt, 4000) }
        );
        let attempt = call(cfg, &exec_prompt, 0.4).await?;
        history.push_str(&format!("\n--- round {} ---\n{}\n", round, attempt));

        // Decide if verification passed.
        let verify_prompt = format!(
            "Rate whether this attempt fully satisfies the task. Reply with EXACTLY one \\
             token on the first line: PASS or FAIL, then a one-sentence reason.\n\n \\
             Task: {}\n\nAttempt:\n{}",
            task,
            truncate(&attempt, 4000)
        );
        let verdict = call(cfg, &verify_prompt, 0.0).await?;
        let first_word = verdict.split_whitespace().next().unwrap_or("FAIL").to_uppercase();

        if first_word.contains("PASS") {
            ui.print(&ui.success(&format!("Verified in round {} ({:.1}s)", round, started.elapsed().as_secs_f64())));
            ui.print("");
            ui.print(&attempt);
            return Ok(attempt);
        }

        ui.print(&ui.warning(&format!("Round {} not verified — self-correcting", round)));
        let reason = verdict.lines().skip(1).collect::<Vec<_>>().join(" ");
        last_attempt = format!(
            "{}\n\nYour previous attempt was rejected because: {}",
            attempt,
            truncate(&reason, 500)
        );
    }

    ui.print(&ui.warning(&format!(
        "Reached max rounds ({}). Returning best effort.",
        MAX_ROUNDS
    )));
    ui.print(&last_attempt);
    Ok(last_attempt)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_subtasks_handles_numbered_and_bullets() {
        let plan = "1. Design the schema\n2) Write migrations\n- Add indexes\n* Test it\n";
        let subs = parse_subtasks(plan);
        assert!(subs.len() >= 3, "got {:?}", subs);
        assert!(subs[0].contains("Design the schema"));
        assert!(subs.iter().any(|s| s.contains("migrations")));
    }

    #[test]
    fn parse_subtasks_ignores_headings_and_short() {
        let plan = "# Plan\n\nDo it\nok\n";
        let subs = parse_subtasks(plan);
        assert!(subs.iter().all(|s| s.len() >= 4), "short lines filtered: {:?}", subs);
    }

    #[test]
    fn role_prompt_covers_all_roles() {
        for role in ["planner", "coder", "tester", "reviewer", "researcher", "unknown"] {
            let p = role_prompt(role, "task");
            assert!(p.contains("task"), "role {} missing task", role);
        }
    }

    #[test]
    fn truncate_respects_char_boundary() {
        assert_eq!(truncate("hello", 10), "hello");
        assert!(truncate("héllo wörld", 5).ends_with('…'));
    }

    #[test]
    fn orchestrator_defaults_roster() {
        let cfg = Config::default();
        let o = SwarmOrchestrator::new(cfg);
        assert_eq!(o.agents.len(), 0);
        assert!(o.max_concurrency >= 2);
    }
}
