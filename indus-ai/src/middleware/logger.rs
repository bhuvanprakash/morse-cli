//! Logging Middleware
//!
//! Request/response logging using tracing

use axum::{
    body::Body,
    extract::Request,
    middleware::Next,
    response::Response,
};
use tracing::{debug, info};

/// Logging middleware for HTTP requests and responses
///
/// Logs request method, path, status code, and duration
pub async fn log_request(
    request: Request<Body>,
    next: Next,
) -> Response {
    let method = request.method().clone();
    let uri = request.uri().path().to_string();

    info!("→ {} {}", method, uri);

    // Continue to the next middleware/handler
    let response = next.run(request).await;

    let status = response.status();
    info!("← {} {} - {}", method, uri, status);

    debug!("Response: {:?}", response);

    response
}
