use async_graphql::dynamic::Schema;
use async_graphql::http::{playground_source, GraphQLPlaygroundConfig};
use async_graphql_axum::{GraphQLRequest, GraphQLResponse};
use axum::http::HeaderMap;
use axum::{response::Html, Extension};
use sqlx::PgPool;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::warn;

use crate::graphql::schema_builder::build_schema_from_db;

#[derive(Clone)]
pub struct GraphQLState {
    pub pool: PgPool,
    graphql_schemas: Arc<RwLock<HashMap<String, Schema>>>,
}

impl GraphQLState {
    pub fn new(pool: PgPool) -> Self {
        Self {
            pool,
            graphql_schemas: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn get_graphql_schema(&self, schema_name: &str) -> Schema {
        {
            let cache = self.graphql_schemas.read().await;
            if let Some(schema) = cache.get(schema_name) {
                return schema.clone();
            }
        }

        let built = match build_schema_from_db(self.pool.clone(), schema_name).await {
            Ok(schema) => schema,
            Err(err) => {
                warn!(
                    schema = schema_name,
                    error = ?err,
                    "failed to build schema for requested project schema, falling back to public"
                );
                build_schema_from_db(self.pool.clone(), "public")
                    .await
                    .expect("failed to build fallback public GraphQL schema")
            }
        };

        let mut cache = self.graphql_schemas.write().await;
        cache.insert(schema_name.to_string(), built.clone());
        built
    }
}

pub async fn graphql_handler(
    Extension(state): Extension<GraphQLState>,
    headers: HeaderMap,
    req: GraphQLRequest,
) -> GraphQLResponse {
    let schema_name = headers
        .get("X-IndusBase-DB-Schema")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("public");
    let schema = state.get_graphql_schema(schema_name).await;
    schema.execute(req.into_inner()).await.into()
}

pub async fn graphql_playground() -> Html<String> {
    Html(playground_source(
        GraphQLPlaygroundConfig::new("/graphql").subscription_endpoint("/graphql"),
    ))
}
