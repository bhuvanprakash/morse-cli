//! Authentication Middleware
//!
//! JWT validation middleware for API authentication

use axum::{
    body::Body,
    extract::{Request, State},
    http::{header::AUTHORIZATION, StatusCode},
    middleware::Next,
    response::Response,
};
use tracing::{debug, warn};

use crate::router::AppState;

/// Extract and validate JWT from Authorization header
///
/// This middleware validates JWT tokens from the Authorization header.
/// The gateway (indus-gate) handles JWT validation before forwarding to indus-ai,
/// so this is a secondary validation layer.
pub async fn validate_jwt(
    State(_state): State<AppState>,
    request: Request<Body>,
    next: Next,
) -> Result<Response, StatusCode> {
    // Skip auth for health endpoint
    let path = request.uri().path();
    if path == "/health" {
        return Ok(next.run(request).await);
    }

    // Get Authorization header
    let auth_header = request
        .headers()
        .get(AUTHORIZATION)
        .and_then(|v| v.to_str().ok());

    let token = match auth_header {
        Some(header) if header.starts_with("Bearer ") => &header[7..],
        Some(header) => {
            debug!("Invalid authorization header format: {}", header);
            return Err(StatusCode::UNAUTHORIZED);
        }
        None => {
            warn!("Missing Authorization header");
            return Err(StatusCode::UNAUTHORIZED);
        }
    };

    // Validate JWT
    // Note: In production, this should verify the JWT signature and claims
    // For now, we do basic validation and pass through
    if token.is_empty() {
        warn!("Empty JWT token");
        return Err(StatusCode::UNAUTHORIZED);
    }

    // Basic JWT structure validation (header.payload.signature)
    let parts: Vec<&str> = token.split('.').collect();
    if parts.len() != 3 {
        warn!("Invalid JWT structure");
        return Err(StatusCode::UNAUTHORIZED);
    }

    // In production, verify:
    // 1. JWT signature using JWT_SECRET
    // 2. Token expiration
    // 3. Issuer/audience claims if configured
    //
    // For now, we trust that the gateway has already validated the JWT
    // and just do basic structural validation

    debug!("JWT validated successfully");

    // Continue to the next middleware/handler
    Ok(next.run(request).await)
}
