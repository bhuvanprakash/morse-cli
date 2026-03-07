use crate::auth::jwt::{load_public_key, Claims, JwtDecoder};
use crate::config::Config;
use axum::{
    extract::{Request, State},
    http::StatusCode,
    middleware::Next,
    response::Response,
};
use std::sync::Arc;
use tracing::{debug, warn};

/// Extension key for storing claims in request extensions
#[derive(Clone, Debug)]
pub struct ClaimsExtension(pub Claims);

/// Auth middleware that validates JWT tokens and injects claims into request extensions
pub async fn auth_middleware(
    State(config): State<Arc<Config>>,
    mut request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    // Skip auth for health endpoint
    let path = request.uri().path();
    if path == "/health" || path == "/ready" {
        return Ok(next.run(request).await);
    }

    // Load public key for JWT validation
    let decoding_key = match load_public_key(&config.jwt_public_key_path) {
        Ok(key) => key,
        Err(e) => {
            warn!("Failed to load JWT public key: {}", e);
            // Continue without validation if key is not available
            return Ok(next.run(request).await);
        }
    };

    // Extract Authorization header
    let auth_header = request
        .headers()
        .get("Authorization")
        .and_then(|h| h.to_str().ok());

    let decoder = JwtDecoder::new(
        decoding_key,
        &config.jwt_issuer,
        &config.jwt_issuer, // Use issuer as audience for now
    );

    match auth_header {
        Some(header) => {
            debug!("Processing Authorization header");

            match extract_bearer_token(header) {
                Some(token) => {
                    match decoder.decode(&token) {
                        Ok(claims) => {
                            debug!("JWT claims validated for user: {}", claims.sub);
                            // Inject claims into request extensions
                            request.extensions_mut().insert(claims);
                            Ok(next.run(request).await)
                        }
                        Err(e) => {
                            warn!("JWT validation failed: {}", e);
                            Err(StatusCode::UNAUTHORIZED)
                        }
                    }
                }
                None => {
                    warn!("Invalid Authorization header format");
                    Err(StatusCode::UNAUTHORIZED)
                }
            }
        }
        None => {
            debug!("No Authorization header found, proceeding as anonymous");
            // Allow anonymous access (RLS will handle permissions)
            Ok(next.run(request).await)
        }
    }
}

/// Extract Bearer token from Authorization header
fn extract_bearer_token(header: &str) -> Option<String> {
    header
        .strip_prefix("Bearer ")
        .map(|s| s.to_string())
}

/// Extract claims from request extensions
pub fn get_claims_from_request(request: &Request) -> Option<&Claims> {
    request.extensions().get::<Claims>()
}

/// Require authentication middleware (rejects requests without valid JWT)
pub async fn require_auth_middleware(
    request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let has_claims = request.extensions().get::<Claims>().is_some();

    if !has_claims {
        return Err(StatusCode::UNAUTHORIZED);
    }

    Ok(next.run(request).await)
}

/// Optional auth middleware - extracts claims if present, but doesn't require them
pub async fn optional_auth_middleware(
    State(config): State<Arc<Config>>,
    mut request: Request,
    next: Next,
) -> Response {
    // Load public key for JWT validation
    let decoding_key = match load_public_key(&config.jwt_public_key_path) {
        Ok(key) => key,
        Err(_) => {
            // Continue without validation if key is not available
            return next.run(request).await;
        }
    };

    // Extract Authorization header
    let auth_header = request
        .headers()
        .get("Authorization")
        .and_then(|h| h.to_str().ok());

    let decoder = JwtDecoder::new(
        decoding_key,
        &config.jwt_issuer,
        &config.jwt_issuer,
    );

    if let Some(header) = auth_header {
        if let Some(token) = extract_bearer_token(header) {
            if let Ok(claims) = decoder.decode(&token) {
                request.extensions_mut().insert(claims);
            }
        }
    }

    next.run(request).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_bearer_token() {
        assert_eq!(
            extract_bearer_token("Bearer token123"),
            Some("token123".to_string())
        );
        assert_eq!(
            extract_bearer_token("Basic dXNlcjpwYXNz"),
            None
        );
        assert_eq!(
            extract_bearer_token("token123"),
            None
        );
    }
}