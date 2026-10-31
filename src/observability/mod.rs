//! Production-grade logging and observability

use crate::errors::{ErrorCategory, MorseError, MorseResult};
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use tracing::{debug, info};
use tracing_subscriber::EnvFilter;

pub struct MetricsCollector {
    counters: std::sync::Mutex<HashMap<String, u64>>,
    histograms: std::sync::Mutex<HashMap<String, Vec<f64>>>,
    gauges: std::sync::Mutex<HashMap<String, f64>>,
}

impl Default for MetricsCollector {
    fn default() -> Self {
        Self::new()
    }
}

impl MetricsCollector {
    pub fn new() -> Self {
        Self {
            counters: std::sync::Mutex::new(HashMap::new()),
            histograms: std::sync::Mutex::new(HashMap::new()),
            gauges: std::sync::Mutex::new(HashMap::new()),
        }
    }

    pub fn increment(&self, name: &str) {
        let mut counters = self.counters.lock().unwrap();
        *counters.entry(name.to_string()).or_insert(0) += 1;
        debug!(name, "counter incremented");
    }

    pub fn record(&self, name: &str, value: f64) {
        let mut histograms = self.histograms.lock().unwrap();
        histograms.entry(name.to_string()).or_default().push(value);
        debug!(name, value, "histogram recorded");
    }

    pub fn gauge(&self, name: &str, value: f64) {
        let mut gauges = self.gauges.lock().unwrap();
        gauges.insert(name.to_string(), value);
        debug!(name, value, "gauge set");
    }

    pub fn report(&self) {
        let counters = self.counters.lock().unwrap();
        let histograms = self.histograms.lock().unwrap();
        let gauges = self.gauges.lock().unwrap();

        println!("═══ Metrics Report ═══");
        for (name, count) in counters.iter() {
            println!("  counter {}: {}", name, count);
        }
        for (name, values) in histograms.iter() {
            if !values.is_empty() {
                let avg: f64 = values.iter().sum::<f64>() / values.len() as f64;
                let min = values.iter().fold(f64::INFINITY, |a, b| a.min(*b));
                let max = values.iter().fold(f64::NEG_INFINITY, |a, b| a.max(*b));
                println!("  histogram {}: count={}, avg={:.2}, min={:.2}, max={:.2}", name, values.len(), avg, min, max);
            }
        }
        for (name, value) in gauges.iter() {
            println!("  gauge {}: {}", name, value);
        }
        println!("════════════════════════");
    }
}

pub struct Tracer {
    enabled: AtomicBool,
}

impl Tracer {
    pub fn new(enabled: bool) -> Self {
        Self {
            enabled: AtomicBool::new(enabled),
        }
    }

    pub fn span(&self, name: &str) -> Span {
        Span {
            name: name.to_string(),
            enabled: self.enabled.load(Ordering::SeqCst),
        }
    }

    pub fn set_enabled(&self, enabled: bool) {
        self.enabled.store(enabled, Ordering::SeqCst);
    }
}

pub struct Span {
    name: String,
    enabled: bool,
}

impl Span {
    pub fn event(&self, message: &str) {
        if self.enabled {
            println!("[span:{}] {}", self.name, message);
        }
    }

    pub fn complete(&self) {
        if self.enabled {
            println!("[span:{}] complete", self.name);
        }
    }
}

static METRICS: std::sync::OnceLock<MetricsCollector> = std::sync::OnceLock::new();
static TRACER: std::sync::OnceLock<Tracer> = std::sync::OnceLock::new();

pub fn init_observability(verbose: bool) -> MorseResult<()> {
    let filter = if verbose {
        EnvFilter::new("debug")
    } else {
        EnvFilter::new("warn")
    };

    tracing_subscriber::fmt()
        .with_env_filter(filter)
        .with_target(false)
        .with_thread_ids(true)
        .with_file(false)
        .with_line_number(false)
        .init();

    METRICS.set(MetricsCollector::new()).map_err(|_| {
        MorseError::new("OBS-001", "Metrics already initialized", ErrorCategory::Internal)
    })?;

    TRACER.set(Tracer::new(verbose)).map_err(|_| {
        MorseError::new("OBS-002", "Tracer already initialized", ErrorCategory::Internal)
    })?;

    info!("Observability initialized (verbose={})", verbose);
    Ok(())
}

pub fn metrics() -> &'static MetricsCollector {
    METRICS.get().expect("Metrics not initialized")
}

pub fn tracer() -> &'static Tracer {
    TRACER.get().expect("Tracer not initialized")
}

pub fn with_span<F, R>(name: &str, f: F) -> R
where
    F: FnOnce(&Span) -> R,
{
    let span = tracer().span(name);
    let result = f(&span);
    span.complete();
    result
}

pub async fn with_span_async<F, R>(name: &str, f: F) -> R
where
    F: FnOnce(&Span) -> std::pin::Pin<Box<dyn std::future::Future<Output = R> + Send>>,
{
    let span = tracer().span(name);
    let result = f(&span).await;
    span.complete();
    result
}
