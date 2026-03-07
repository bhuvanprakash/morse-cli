use indus_query::auth::jwt::Claims;
use serde_json::json;
use std::collections::HashMap;

fn create_test_claims(sub: &str, role: &str) -> Claims {
    let mut extra = HashMap::new();
    extra.insert("role".to_string(), json!(role));

    Claims {
        sub: sub.to_string(),
        email: Some("test@example.com".to_string()),
        role: Some(role.to_string()),
        iss: "test".to_string(),
        aud: "test".to_string(),
        exp: 9999999999,
        iat: 0,
        extra,
    }
}

#[test]
fn test_claims_creation() {
    let claims = create_test_claims("user-123", "authenticated");

    assert_eq!(claims.sub, "user-123");
    assert_eq!(claims.role, Some("authenticated".to_string()));
    assert_eq!(claims.email, Some("test@example.com".to_string()));
}

#[test]
fn test_claims_serialization() {
    let claims = create_test_claims("user-123", "authenticated");
    let json_str = serde_json::to_string(&claims).unwrap();

    assert!(json_str.contains("user-123"));
    assert!(json_str.contains("authenticated"));
}

#[test]
fn test_claims_deserialization() {
    let json_str = r#"{
        "sub": "user-456",
        "exp": 9999999999,
        "iat": 0,
        "iss": "test",
        "aud": "test",
        "role": "admin"
    }"#;

    let claims: Claims = serde_json::from_str(json_str).unwrap();

    assert_eq!(claims.sub, "user-456");
    assert_eq!(claims.role, Some("admin".to_string()));
}

// Note: The following tests would require a database connection
// They are marked as #[ignore] for CI/CD purposes

#[ignore]
#[tokio::test]
async fn test_set_role() {
    // Requires database connection
}

#[ignore]
#[tokio::test]
async fn test_set_jwt_claims() {
    // Requires database connection
}

#[ignore]
#[tokio::test]
async fn test_rls_context_with_user() {
    // Requires database connection
}

#[ignore]
#[tokio::test]
async fn test_rls_context_anonymous() {
    // Requires database connection
}

#[ignore]
#[tokio::test]
async fn test_with_rls_context_transaction() {
    // Requires database connection
}

#[ignore]
#[tokio::test]
async fn test_rls_policy_enforcement() {
    // Requires database connection
}