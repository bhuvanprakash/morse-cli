//! Health check module
//!
//! Provides health check endpoints for monitoring the service status

pub mod handler;

use serde::{Deserialize, Serialize};

/// Health check response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthResponse {
    /// Overall status: "healthy", "degraded", or "unhealthy"
    pub status: String,
    /// Service name
    pub service: String,
    /// Current timestamp (Unix epoch seconds)
    pub timestamp: u64,
    /// Individual component statuses
    pub components: Vec<ComponentStatus>,
    /// PostgreSQL pool port
    pub pool_port: u16,
    /// Prometheus metrics port
    pub metrics_port: u16,
    /// Service uptime in seconds
    pub uptime_seconds: u64,
    /// Number of times PgCat has been restarted
    pub restart_count: u64,
}

/// Individual component health status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComponentStatus {
    /// Component name
    pub name: String,
    /// Component status: "up", "down", or "degraded"
    pub status: String,
    /// Optional error message
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    /// Response time in milliseconds
    #[serde(skip_serializing_if = "Option::is_none")]
    pub latency_ms: Option<u64>,
}

impl HealthResponse {
    /// Create a new health response
    pub fn new(status: impl Into<String>) -> Self {
        Self {
            status: status.into(),
            service: "indus-pool".to_string(),
            timestamp: 0,
            components: Vec::new(),
            pool_port: 5432,
            metrics_port: 9090,
            uptime_seconds: 0,
            restart_count: 0,
        }
    }

    /// Set the service name
    pub fn with_service(mut self, service: impl Into<String>) -> Self {
        self.service = service.into();
        self
    }

    /// Set the timestamp
    pub fn with_timestamp(mut self, timestamp: u64) -> Self {
        self.timestamp = timestamp;
        self
    }

    /// Set the pool port
    pub fn with_pool_port(mut self, port: u16) -> Self {
        self.pool_port = port;
        self
    }

    /// Set the metrics port
    pub fn with_metrics_port(mut self, port: u16) -> Self {
        self.metrics_port = port;
        self
    }

    /// Set the uptime
    pub fn with_uptime_seconds(mut self, uptime: u64) -> Self {
        self.uptime_seconds = uptime;
        self
    }

    /// Set the restart count
    pub fn with_restart_count(mut self, count: u64) -> Self {
        self.restart_count = count;
        self
    }

    /// Add a component status
    pub fn add_component(mut self, component: ComponentStatus) -> Self {
        self.components.push(component);
        self
    }
}

impl ComponentStatus {
    /// Create a new component status
    pub fn new(name: impl Into<String>, status: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            status: status.into(),
            message: None,
            latency_ms: None,
        }
    }

    /// Add a message
    pub fn with_message(mut self, message: impl Into<String>) -> Self {
        self.message = Some(message.into());
        self
    }

    /// Add latency
    pub fn with_latency(mut self, latency: Option<u64>) -> Self {
        self.latency_ms = latency;
        self
    }
}
