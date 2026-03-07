use axum::{
    extract::{ConnectInfo, Request},
    middleware::Next,
    response::Response,
};
use std::net::SocketAddr;
use std::time::Instant;
use tracing::{info, info_span, Instrument};

/// Request logging middleware with timing information
pub async fn request_logger(
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    request: Request,
    next: Next,
) -> Response {
    let start = Instant::now();
    let method = request.method().clone();
    let uri = request.uri().clone();
    let version = request.version();

    // Create a tracing span for the request
    let span = info_span!(
        "request",
        method = %method,
        uri = %uri,
        version = ?version,
        client = %addr,
    );

    async move {
        info!("Request started");

        let response = next.run(request).await;

        let duration = start.elapsed();
        let status = response.status();

        info!(
            status = %status,
            duration_ms = %duration.as_millis(),
            "Request completed"
        );

        response
    }
    .instrument(span)
    .await
}

/// Simple logging layer that logs all requests
pub async fn simple_logger(request: Request, next: Next) -> Response {
    let start = Instant::now();
    let method = request.method().clone();
    let path = request.uri().path().to_string();

    let response = next.run(request).await;

    let duration = start.elapsed();
    let status = response.status().as_u16();

    info!(
        "{} {} - {} - {}ms",
        method,
        path,
        status,
        duration.as_millis()
    );

    response
}

/// Structured logging middleware with more details
pub async fn structured_logger(
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    request: Request,
    next: Next,
) -> Response {
    let start = Instant::now();

    let method = request.method().to_string();
    let path = request.uri().path().to_string();
    let query = request.uri().query().map(|q| q.to_string());
    let version = format!("{:?}", request.version());
    let user_agent = request
        .headers()
        .get("user-agent")
        .and_then(|h| h.to_str().ok())
        .map(|s| s.to_owned())
        .unwrap_or_else(|| "-".to_string());

    let response = next.run(request).await;

    let duration = start.elapsed();
    let status = response.status().as_u16();
    let content_length = response
        .headers()
        .get("content-length")
        .and_then(|h| h.to_str().ok())
        .unwrap_or("-");

    info!(
        method = %method,
        path = %path,
        query = ?query,
        version = %version,
        client = %addr,
        user_agent = %user_agent,
        status = %status,
        content_length = %content_length,
        duration_ms = %duration.as_millis(),
        "HTTP request"
    );

    response
}

/// JSON-formatted logger for structured logging
pub async fn json_logger(request: Request, next: Next) -> Response {
    let start = Instant::now();

    let method = request.method().to_string();
    let path = request.uri().path().to_string();

    let response = next.run(request).await;

    let duration = start.elapsed();
    let status = response.status().as_u16();

    // Output structured JSON log
    let log_line = serde_json::json!({
        "level": "INFO",
        "timestamp": chrono::Utc::now().to_rfc3339(),
        "method": method,
        "path": path,
        "status": status,
        "duration_ms": duration.as_millis(),
    });

    info!("{}", log_line);

    response
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use axum::http::Request;
    use std::net::SocketAddr;

    // Note: Full middleware tests would require more setup with tower::ServiceExt
}
