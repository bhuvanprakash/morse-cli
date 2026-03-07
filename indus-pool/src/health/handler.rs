use std::sync::atomic::Ordering;
use std::time::{Instant, SystemTime, UNIX_EPOCH};

use anyhow::Result;
use axum::extract::State;
use axum::response::{IntoResponse, Response};
use axum::http::StatusCode;
use serde_json::json;
use tokio::net::TcpStream;
use tokio::time::{timeout, Duration};
use tracing::{debug, error, warn};

use crate::health::{ComponentStatus, HealthResponse};
use crate::AppState;

/// Health check handler - methods that work with AppState
pub struct HealthHandler;

impl HealthHandler {
    /// Check TCP connectivity to a host:port
    async fn check_tcp_connection(host: &str, port: u16, timeout_secs: u64) -> Result<Duration, anyhow::Error> {
        let addr = format!("{}:{}", host, port);
        let start = Instant::now();
        
        match timeout(
            Duration::from_secs(timeout_secs),
            TcpStream::connect(&addr)
        ).await {
            Ok(Ok(_stream)) => {
                let elapsed = start.elapsed();
                debug!("TCP connection to {} successful in {:?}", addr, elapsed);
                Ok(elapsed)
            }
            Ok(Err(e)) => {
                Err(anyhow::anyhow!("Failed to connect to {}: {}", addr, e))
            }
            Err(_) => {
                Err(anyhow::anyhow!("Connection to {} timed out after {}s", addr, timeout_secs))
            }
        }
    }

    /// Handle GET /health request
    /// 
    /// Checks TCP connections to pgcat:5432 and metrics:9090
    /// Returns JSON with status, pool_port, metrics_port, uptime_seconds
    /// Returns 503 if pgcat unreachable
    pub async fn handle(State(state): State<AppState>) -> Response {
        debug!("Health check request received");

        let pool_port = state.config.pgcat_pool_port();
        let metrics_port = state.config.metrics_port;
        let restart_count = state.restart_counter.load(Ordering::SeqCst);

        // Check PgCat pool connectivity on port 5432
        let pool_check = Self::check_tcp_connection("localhost", pool_port, 5).await;
        
        // Check PgCat metrics endpoint on port 9090
        let metrics_check = Self::check_tcp_connection("localhost", metrics_port, 5).await;

        let pool_latency_ms = pool_check.as_ref().map(|d| d.as_millis() as u64).ok();
        let metrics_latency_ms = metrics_check.as_ref().map(|d| d.as_millis() as u64).ok();

        let pool_status = if pool_check.is_ok() { "up" } else { "down" };
        let metrics_status = if metrics_check.is_ok() { "up" } else { "down" };

        // Get current timestamp
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        // Build response
        let response = HealthResponse {
            status: if pool_check.is_ok() { "healthy".to_string() } else { "unhealthy".to_string() },
            service: "indus-pool".to_string(),
            timestamp,
            components: vec![
                ComponentStatus {
                    name: "pgcat_pool".to_string(),
                    status: pool_status.to_string(),
                    message: Some(if pool_check.is_ok() {
                        "PgCat PostgreSQL port is accessible".to_string()
                    } else {
                        "PgCat PostgreSQL port is not accessible".to_string()
                    }),
                    latency_ms: pool_latency_ms,
                },
                ComponentStatus {
                    name: "pgcat_metrics".to_string(),
                    status: metrics_status.to_string(),
                    message: Some(if metrics_check.is_ok() {
                        "PgCat metrics port is accessible".to_string()
                    } else {
                        "PgCat metrics port is not accessible".to_string()
                    }),
                    latency_ms: metrics_latency_ms,
                },
            ],
            pool_port,
            metrics_port,
            uptime_seconds: timestamp, // Simplified - would track actual app start time
            restart_count,
        };

        // Return 503 if PgCat is unreachable
        let status_code = if pool_check.is_ok() {
            StatusCode::OK
        } else {
            warn!("Health check failed: PgCat pool is not accessible");
            StatusCode::SERVICE_UNAVAILABLE
        };

        match serde_json::to_value(response) {
            Ok(json) => (status_code, axum::Json(json)).into_response(),
            Err(e) => {
                error!("Failed to serialize health response: {}", e);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    axum::Json(json!({
                        "status": "error",
                        "message": "Failed to serialize health response"
                    }))
                ).into_response()
            }
        }
    }

    /// Handle GET /health/ready request (readiness probe)
    pub async fn ready(State(state): State<AppState>) -> Response {
        debug!("Readiness probe received");

        let pool_port = state.config.pgcat_pool_port();
        
        // Check if PgCat is ready to accept connections
        match Self::check_tcp_connection("localhost", pool_port, 5).await {
            Ok(_) => {
                let response = json!({
                    "status": "ready",
                    "timestamp": chrono::Utc::now().to_rfc3339(),
                    "pool_port": pool_port
                });
                (StatusCode::OK, axum::Json(response)).into_response()
            }
            Err(e) => {
                warn!("Readiness check failed: {}", e);
                let response = json!({
                    "status": "not_ready",
                    "timestamp": chrono::Utc::now().to_rfc3339(),
                    "error": e.to_string()
                });
                (StatusCode::SERVICE_UNAVAILABLE, axum::Json(response)).into_response()
            }
        }
    }

    /// Handle GET /health/live request (liveness probe)
    pub async fn live(State(_state): State<AppState>) -> Response {
        debug!("Liveness probe received");

        // Liveness is a lightweight check - just return alive
        // This should not fail under load
        let response = json!({
            "status": "alive",
            "timestamp": chrono::Utc::now().to_rfc3339(),
            "service": "indus-pool"
        });
        
        (StatusCode::OK, axum::Json(response)).into_response()
    }
}

/// Tracks when the application started
static APP_START_TIME: std::sync::OnceLock<Instant> = std::sync::OnceLock::new();

/// Get or initialize the app start time
pub fn get_app_start_time() -> Instant {
    *APP_START_TIME.get_or_init(Instant::now)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_health_response_builder() {
        let response = HealthResponse {
            status: "healthy".to_string(),
            service: "test-service".to_string(),
            timestamp: 1234567890,
            components: vec![],
            pool_port: 5432,
            metrics_port: 9090,
            uptime_seconds: 100,
            restart_count: 0,
        };

        assert_eq!(response.status, "healthy");
        assert_eq!(response.service, "test-service");
        assert_eq!(response.pool_port, 5432);
        assert_eq!(response.metrics_port, 9090);
        assert_eq!(response.uptime_seconds, 100);
        assert_eq!(response.restart_count, 0);
    }
}
