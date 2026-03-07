//! Metrics module
//!
//! Provides Prometheus-compatible metrics export

pub mod exporter;

pub use exporter::MetricsExporter;

use prometheus::{Counter, Gauge, Histogram, Registry};

/// Custom metrics for Indus Pool
#[derive(Clone)]
pub struct PoolMetrics {
    /// Registry for all metrics
    pub registry: Registry,
    /// Total number of requests
    pub requests_total: Counter,
    /// Active connections gauge
    pub active_connections: Gauge,
    /// Connection duration histogram
    pub connection_duration: Histogram,
    /// Pool size gauge
    pub pool_size: Gauge,
    /// Request duration histogram
    pub request_duration: Histogram,
}

impl PoolMetrics {
    /// Create new metrics instance
    pub fn new() -> anyhow::Result<Self> {
        let registry = Registry::new();

        let requests_total = Counter::new(
            "indus_pool_requests_total",
            "Total number of requests received"
        )?;
        registry.register(Box::new(requests_total.clone()))?;

        let active_connections = Gauge::new(
            "indus_pool_active_connections",
            "Number of active database connections"
        )?;
        registry.register(Box::new(active_connections.clone()))?;

        let connection_duration = Histogram::with_opts(
            prometheus::HistogramOpts::new(
                "indus_pool_connection_duration_seconds",
                "Time spent in database connections"
            )
            .buckets(prometheus::exponential_buckets(0.001, 2.0, 15)?)
        )?;
        registry.register(Box::new(connection_duration.clone()))?;

        let pool_size = Gauge::new(
            "indus_pool_size",
            "Current pool size"
        )?;
        registry.register(Box::new(pool_size.clone()))?;

        let request_duration = Histogram::with_opts(
            prometheus::HistogramOpts::new(
                "indus_pool_request_duration_seconds",
                "HTTP request duration in seconds"
            )
            .buckets(prometheus::exponential_buckets(0.0001, 2.0, 15)?)
        )?;
        registry.register(Box::new(request_duration.clone()))?;

        Ok(Self {
            registry,
            requests_total,
            active_connections,
            connection_duration,
            pool_size,
            request_duration,
        })
    }

    /// Record a request
    pub fn record_request(&self) {
        self.requests_total.inc();
    }

    /// Set active connections
    pub fn set_active_connections(&self, count: f64) {
        self.active_connections.set(count);
    }

    /// Set pool size
    pub fn set_pool_size(&self, size: f64) {
        self.pool_size.set(size);
    }

    /// Observe connection duration
    pub fn observe_connection_duration(&self, duration: f64) {
        self.connection_duration.observe(duration);
    }

    /// Observe request duration
    pub fn observe_request_duration(&self, duration: f64) {
        self.request_duration.observe(duration);
    }
}

impl Default for PoolMetrics {
    fn default() -> Self {
        Self::new().expect("Failed to create default PoolMetrics")
    }
}
