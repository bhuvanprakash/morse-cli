//! Health Handler
//!
//! HTTP handler for health check endpoint

use axum::{
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use tracing::info;

use crate::router::AppState;

/// Health check response
#[derive(Debug, Serialize, Deserialize)]
pub struct HealthResponse {
    /// Service status
    pub status: String,
    /// Service name
    pub service: String,
    /// Database connection status
    pub database: DatabaseHealth,
}

/// Database health information
#[derive(Debug, Serialize, Deserialize)]
pub struct DatabaseHealth {
    /// Whether database is connected
    pub connected: bool,
    /// Database version (if available)
    pub version: Option<String>,
}

/// Health check endpoint
///
/// GET /health
pub async fn health_check(
    State(state): State<AppState>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    info!("Health check requested");

    // Check database connectivity
    let db_health = match sqlx::query("SELECT version()")
        .fetch_optional(&state.pool)
        .await
    {
        Ok(Some(row)) => {
            let version: String = row.get(0);
            DatabaseHealth {
                connected: true,
                version: Some(version),
            }
        }
        _ => DatabaseHealth {
            connected: false,
            version: None,
        },
    };

    let response = HealthResponse {
        status: if db_health.connected { "healthy" } else { "degraded" }.to_string(),
        service: "indus-ai".to_string(),
        database: db_health,
    };

    let status = if response.status == "healthy" {
        StatusCode::OK
    } else {
        StatusCode::SERVICE_UNAVAILABLE
    };

    Ok((status, Json(response)))
}
