use crate::errors::AppError;
use jsonwebtoken::{decode, decode_header, Algorithm, DecodingKey, Validation};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use tracing::debug;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub email: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub role: Option<String>,
    pub iss: String,
    pub aud: String,
    pub exp: usize,
    pub iat: usize,
    #[serde(flatten)]
    pub extra: HashMap<String, serde_json::Value>,
}

#[derive(Clone)]
pub struct JwtDecoder {
    decoding_key: DecodingKey,
    issuer: String,
    audience: String,
}

impl JwtDecoder {
    pub fn new(decoding_key: DecodingKey, issuer: impl Into<String>, audience: impl Into<String>) -> Self {
        Self {
            decoding_key,
            issuer: issuer.into(),
            audience: audience.into(),
        }
    }

    /// Create a decoder from a secret string (for HS256)
    pub fn from_secret(secret: impl AsRef<[u8]>, issuer: impl Into<String>, audience: impl Into<String>) -> Self {
        Self {
            decoding_key: DecodingKey::from_secret(secret.as_ref()),
            issuer: issuer.into(),
            audience: audience.into(),
        }
    }

    /// Create a decoder from an RSA PEM public key (for RS256)
    pub fn from_rsa_pem(pem: &[u8], issuer: impl Into<String>, audience: impl Into<String>) -> Result<Self, AppError> {
        let decoding_key = DecodingKey::from_rsa_pem(pem)
            .map_err(|e| AppError::InternalError(format!("Failed to load RSA public key: {}", e)))?;
        let issuer = issuer.into();
        let audience = audience.into();
        Ok(Self {
            decoding_key,
            issuer,
            audience,
        })
    }

    pub fn decode(&self, token: &str) -> Result<Claims, AppError> {
        let mut validation = Validation::new(Algorithm::RS256);
        validation.set_issuer(&[&self.issuer]);
        validation.set_audience(&[&self.audience]);

        let token_data = decode::<Claims>(token, &self.decoding_key, &validation)
            .map_err(|e| AppError::Unauthorized(format!("Invalid token: {}", e)))?;

        Ok(token_data.claims)
    }

    pub fn decode_without_validation(&self, token: &str) -> Result<Claims, AppError> {
        let mut validation = Validation::new(Algorithm::RS256);
        validation.insecure_disable_signature_validation();

        let token_data = decode::<Claims>(token, &self.decoding_key, &validation)
            .map_err(|e| AppError::Unauthorized(format!("Invalid token: {}", e)))?;

        Ok(token_data.claims)
    }

    /// Determine the algorithm from the token header and decode accordingly
    pub fn decode_auto(&self, token: &str) -> Result<Claims, AppError> {
        let header = decode_header(token)
            .map_err(|e| AppError::Unauthorized(format!("Invalid token header: {}", e)))?;

        let mut validation = Validation::new(header.alg);
        validation.set_issuer(&[&self.issuer]);
        validation.set_audience(&[&self.audience]);

        let token_data = decode::<Claims>(token, &self.decoding_key, &validation)
            .map_err(|e| AppError::Unauthorized(format!("Invalid token: {}", e)))?;

        Ok(token_data.claims)
    }
}

/// Load a public key from a file path
pub fn load_public_key(path: &str) -> Result<DecodingKey, AppError> {
    debug!("Loading JWT public key from: {}", path);
    
    let pem = fs::read_to_string(path)
        .map_err(|e| AppError::InternalError(format!("Failed to read public key file: {}", e)))?;

    // Try RSA first
    if let Ok(key) = DecodingKey::from_rsa_pem(pem.as_bytes()) {
        debug!("Loaded RSA public key");
        return Ok(key);
    }

    // Try EC
    if let Ok(key) = DecodingKey::from_ec_pem(pem.as_bytes()) {
        debug!("Loaded EC public key");
        return Ok(key);
    }

    // Try EdDSA
    if let Ok(key) = DecodingKey::from_ed_pem(pem.as_bytes()) {
        debug!("Loaded EdDSA public key");
        return Ok(key);
    }

    // Fall back to secret (for HS256)
    debug!("Using symmetric key (HS256)");
    Ok(DecodingKey::from_secret(pem.as_bytes()))
}

/// Decode a token with the given decoding key
pub fn decode_token(token: &str, key: &DecodingKey) -> Result<Claims, AppError> {
    let header = decode_header(token)
        .map_err(|e| AppError::Unauthorized(format!("Invalid token header: {}", e)))?;

    let mut validation = Validation::new(header.alg);
    
    let token_data = decode::<Claims>(token, key, &validation)
        .map_err(|e| AppError::Unauthorized(format!("Invalid token: {}", e)))?;

    Ok(token_data.claims)
}

/// Extract claims from an Authorization header
pub fn extract_claims_from_header(
    auth_header: Option<&str>,
    decoder: &JwtDecoder,
) -> Result<Claims, AppError> {
    let header = auth_header
        .ok_or_else(|| AppError::Unauthorized("Missing Authorization header".to_string()))?;

    let token = header
        .strip_prefix("Bearer ")
        .ok_or_else(|| AppError::Unauthorized("Invalid Authorization header format. Expected 'Bearer <token>'".to_string()))?;

    decoder.decode(token)
}

#[derive(Debug, Clone)]
pub struct AuthContext {
    pub claims: Option<Claims>,
    pub role: Option<String>,
}

impl AuthContext {
    pub fn new() -> Self {
        Self {
            claims: None,
            role: None,
        }
    }

    pub fn with_claims(claims: Claims) -> Self {
        let role = claims
            .extra
            .get("role")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .or_else(|| claims.role.clone());

        Self {
            claims: Some(claims),
            role,
        }
    }

    pub fn is_authenticated(&self) -> bool {
        self.claims.is_some()
    }

    pub fn user_id(&self) -> Option<&str> {
        self.claims.as_ref().map(|c| c.sub.as_str())
    }

    pub fn email(&self) -> Option<&str> {
        self.claims.as_ref().and_then(|c| c.email.as_deref())
    }

    pub fn role(&self) -> Option<&str> {
        self.role.as_deref()
    }
}

impl Default for AuthContext {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_auth_context() {
        let mut extra = HashMap::new();
        extra.insert("role".to_string(), serde_json::json!("admin"));

        let claims = Claims {
            sub: "user-123".to_string(),
            email: Some("test@example.com".to_string()),
            role: None,
            iss: "test".to_string(),
            aud: "test".to_string(),
            exp: 9999999999,
            iat: 0,
            extra,
        };

        let ctx = AuthContext::with_claims(claims);
        assert!(ctx.is_authenticated());
        assert_eq!(ctx.user_id(), Some("user-123"));
        assert_eq!(ctx.email(), Some("test@example.com"));
        assert_eq!(ctx.role(), Some("admin"));
    }

    #[test]
    fn test_auth_context_anonymous() {
        let ctx = AuthContext::new();
        assert!(!ctx.is_authenticated());
        assert_eq!(ctx.user_id(), None);
    }
}
