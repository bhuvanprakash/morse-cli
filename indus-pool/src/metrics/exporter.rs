use std::sync::atomic::Ordering;

use axum::extract::State;
use axum::response::{IntoResponse, Response};
use axum::http::StatusCode;
use tracing::{debug, error, warn};

use crate::AppState;

/// Prometheus metrics exporter
/// 
/// Scrapes metrics from PgCat and re-exposes them with additional custom metrics
pub struct MetricsExporter;

impl MetricsExporter {
    /// Handle GET /metrics request
    /// 
    /// Scrapes from http://localhost:{metrics_port}/metrics using reqwest
    /// Re-exposes at GET /metrics with custom counter: indusbase_pool_restart_count
    pub async fn handle(State(state): State<AppState>) -> Response {
        debug!("Metrics request received");

        let metrics_port = state.config.metrics_port;
        let pgcat_metrics_url = format!("http://localhost:{}/metrics", metrics_port);

        // Scrape metrics from PgCat
        let pgcat_metrics = match Self::scrape_pgcat_metrics(&pgcat_metrics_url).await {
            Ok(metrics) => metrics,
            Err(e) => {
                warn!("Failed to scrape PgCat metrics: {}", e);
                String::new()
            }
        };

        // Get restart count
        let restart_count = state.restart_counter.load(Ordering::SeqCst);

        // Build custom metrics
        let custom_metrics = format!(
            "# HELP indusbase_pool_restart_count Number of times PgCat has been restarted\n\
             # TYPE indusbase_pool_restart_count counter\n\
             indusbase_pool_restart_count {}\n",
            restart_count
        );

        // Combine PgCat metrics with custom metrics
        let combined_metrics = if pgcat_metrics.is_empty() {
            custom_metrics
        } else {
            format!("{}\n{}", pgcat_metrics, custom_metrics)
        };

        Response::builder()
            .status(StatusCode::OK)
            .header("Content-Type", "text/plain; charset=utf-8")
            .body(combined_metrics)
            .unwrap_or_else(|e| {
                error!("Failed to build metrics response: {}", e);
                Response::builder()
                    .status(StatusCode::INTERNAL_SERVER_ERROR)
                    .body(format!("Error: {}", e))
                    .unwrap()
            })
            .into_response()
    }

    /// Scrape metrics from PgCat prometheus endpoint
    async fn scrape_pgcat_metrics(url: &str) -> anyhow::Result<String> {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(5))
            .build()?;

        let response = client
            .get(url)
            .send()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to fetch PgCat metrics: {}", e))?;

        if !response.status().is_success() {
            return Err(anyhow::anyhow!(
                "PgCat metrics endpoint returned status: {}",
                response.status()
            ));
        }

        let body = response
            .text()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to read PgCat metrics body: {}", e))?;

        Ok(body)
    }
}
