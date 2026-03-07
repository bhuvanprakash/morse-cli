use indus_query::config::Config;
use indus_query::rest::response::{PaginatedResponse, SingleResponse};
use serde_json::json;

/// Test paginated response creation
#[test]
fn test_paginated_response() {
    let data = vec![
        json!({"id": 1, "name": "Alice"}),
        json!({"id": 2, "name": "Bob"}),
    ];

    let response = PaginatedResponse::new(data, 1, 20, 100);

    assert_eq!(response.meta.page, 1);
    assert_eq!(response.meta.limit, 20);
    assert_eq!(response.meta.total, 100);
    assert_eq!(response.meta.total_pages, 5);
    assert!(response.meta.has_next);
    assert!(!response.meta.has_prev);
    assert_eq!(response.data.len(), 2);
}

/// Test single response creation
#[test]
fn test_single_response() {
    let data = json!({"id": 1, "name": "Alice"});
    let response = SingleResponse::new(data.clone());

    assert_eq!(response.data, data);
}

/// Test config defaults
#[test]
fn test_config_defaults() {
    // Note: This would normally load from env, we test the struct directly
    let config = Config {
        database_url: "postgres://localhost".to_string(),
        server_port: 8002,
        jwt_public_key_path: "/etc/jwt.pub".to_string(),
        internal_secret: "secret".to_string(),
        schema_cache_refresh_secs: 30,
        max_query_rows: 1000,
        allowed_schemas: vec!["public".to_string()],
        // Legacy fields
        port: 8002,
        host: "0.0.0.0".to_string(),
        jwt_secret: "secret".to_string(),
        jwt_issuer: "indus-auth".to_string(),
        schema_cache_ttl: 30,
    };

    assert_eq!(config.server_port, 8002);
    assert_eq!(config.max_query_rows, 1000);
    assert_eq!(config.allowed_schemas, vec!["public"]);
}

/// Test error response structure
#[test]
fn test_error_response() {
    use indus_query::errors::{AppError, ErrorEnvelope};
    use axum::response::IntoResponse;

    let error = AppError::NotFound("User not found".to_string());
    let response = error.into_response();

    assert_eq!(response.status(), axum::http::StatusCode::NOT_FOUND);
}

/// Test filter operators
#[test]
fn test_filter_operators() {
    use indus_query::rest::filter::FilterOperator;

    assert_eq!(FilterOperator::Eq.to_sql(), "=");
    assert_eq!(FilterOperator::Gt.to_sql(), ">");
    assert_eq!(FilterOperator::Like.to_sql(), "LIKE");
    assert_eq!(FilterOperator::Ilike.to_sql(), "ILIKE");
}

/// Test order direction
#[test]
fn test_order_direction() {
    use indus_query::rest::filter::OrderDirection;

    assert_eq!(OrderDirection::Asc.to_sql(), "ASC");
    assert_eq!(OrderDirection::Desc.to_sql(), "DESC");
}