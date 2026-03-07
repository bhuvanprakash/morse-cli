use axum::body::Body;
use axum::http::{Request, StatusCode};
use std::sync::Arc;
use tower::ServiceExt;

use indus_pool::config::IndusPoolConfig;
use indus_pool::health::handler::HealthHandler;

fn create_test_config() -> Arc<IndusPoolConfig> {
    Arc::new(IndusPoolConfig::default())
}

fn create_test_router() -> axum::Router {
    let config = create_test_config();
    let health_handler = HealthHandler::new(config);

    axum::Router::new()
        .route("/health", axum::routing::get(HealthHandler::handle))
        .route("/health/ready", axum::routing::get(HealthHandler::ready))
        .route("/health/live", axum::routing::get(HealthHandler::live))
        .with_state(health_handler)
}

#[tokio::test]
async fn test_health_endpoint() {
    let app = create_test_router();

    let response = app
        .oneshot(Request::builder()
            .uri("/health")
            .body(Body::empty())
            .unwrap())
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn test_ready_endpoint() {
    let app = create_test_router();

    let response = app
        .oneshot(Request::builder()
            .uri("/health/ready")
            .body(Body::empty())
            .unwrap())
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn test_live_endpoint() {
    let app = create_test_router();

    let response = app
        .oneshot(Request::builder()
            .uri("/health/live")
            .body(Body::empty())
            .unwrap())
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn test_health_response_structure() {
    let app = create_test_router();

    let response = app
        .oneshot(Request::builder()
            .uri("/health")
            .body(Body::empty())
            .unwrap())
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    // TODO: Parse body and verify structure
    // let body = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
    // let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
    // assert!(json.get("status").is_some());
    // assert!(json.get("service").is_some());
}

#[tokio::test]
async fn test_ready_response_contains_status() {
    let app = create_test_router();

    let response = app
        .oneshot(Request::builder()
            .uri("/health/ready")
            .body(Body::empty())
            .unwrap())
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    // TODO: Parse and verify response body
}

#[tokio::test]
async fn test_live_response_contains_status() {
    let app = create_test_router();

    let response = app
        .oneshot(Request::builder()
            .uri("/health/live")
            .body(Body::empty())
            .unwrap())
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    // TODO: Parse and verify response body
}
