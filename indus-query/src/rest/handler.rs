use crate::auth::jwt::Claims;
use crate::auth::rls::RlsContext;
use crate::config::Config;
use crate::errors::AppError;
use crate::rest::filter::{parse_query_params, QueryParams};
use crate::rest::query_builder;
use crate::rest::response::{paginated_response, PaginatedResponse, SingleResponse};
use crate::schema::cache::SchemaCache;
use axum::extract::{Path, Query, State};
use axum::http::{HeaderMap, StatusCode};
use axum::Json;
use serde_json::{Map, Value};
use sqlx::PgPool;
use std::collections::HashMap;
use std::sync::Arc;
use tracing::{debug, error, info, warn};

/// Application state shared across handlers
#[derive(Clone)]
pub struct AppState {
    pub pool: Arc<PgPool>,
    pub config: Arc<Config>,
    pub schema_cache: Arc<SchemaCache>,
    pub jwt_public_key: Arc<jsonwebtoken::DecodingKey>,
}

/// Handler: List rows from a table with filtering and pagination
/// GET /:schema/:table
pub async fn list_rows(
    State(state): State<Arc<AppState>>,
    Path((schema, table)): Path<(String, String)>,
    Query(params): Query<HashMap<String, String>>,
    claims: Option<axum::extract::Extension<Claims>>,
) -> Result<Json<PaginatedResponse<Value>>, AppError> {
    debug!("List rows: {}.{}", schema, table);

    // Check if schema is allowed
    if !state.config.allowed_schemas.contains(&schema) {
        return Err(AppError::SchemaNotAllowed(schema));
    }

    // Get table metadata
    let table_meta = state.schema_cache.get_table(&schema, &table)
        .ok_or_else(|| AppError::TableNotFound(format!("{}.{}", schema, table)))?;

    // Parse query parameters
    let query_params = parse_query_params(&params);

    // Build and execute query within RLS context
    let (sql, sql_params) = query_builder::build_select_query(
        &table_meta,
        &query_params,
        state.config.max_query_rows,
    )?;

    // Get total count for pagination
    let (count_sql, count_params) = query_builder::build_count_query(&table_meta, &query_params)?;

    let pool = (*state.pool).clone();
    let total = execute_count(&pool, &count_sql, count_params, claims.as_ref().map(|c| &c.0)).await?;

    // Execute main query
    let rows = execute_query(&pool, &sql, sql_params, claims.as_ref().map(|c| &c.0)).await?;

    let page = query_params.page.unwrap_or(1);
    let limit = query_params.limit_or_default(20);

    Ok(Json(paginated_response(rows, page, limit, total)))
}

/// Handler: Get a single row by ID
/// GET /:schema/:table/:id
pub async fn get_row(
    State(state): State<Arc<AppState>>,
    Path((schema, table, id)): Path<(String, String, String)>,
    claims: Option<axum::extract::Extension<Claims>>,
) -> Result<Json<SingleResponse<Value>>, AppError> {
    debug!("Get row: {}.{} id={}", schema, table, id);

    // Check if schema is allowed
    if !state.config.allowed_schemas.contains(&schema) {
        return Err(AppError::SchemaNotAllowed(schema));
    }

    // Get table metadata
    let table_meta = state.schema_cache.get_table(&schema, &table)
        .ok_or_else(|| AppError::TableNotFound(format!("{}.{}", schema, table)))?;

    // Determine ID column (use primary key or 'id')
    let id_column = table_meta.primary_keys.first()
        .cloned()
        .unwrap_or_else(|| "id".to_string());

    // Build and execute query
    let (sql, sql_params) = query_builder::build_select_by_id_query(&table_meta, &id_column, &id)?;

    let pool = (*state.pool).clone();
    let row = execute_query_one(&pool, &sql, sql_params, claims.as_ref().map(|c| &c.0)).await?;

    Ok(Json(SingleResponse::new(row)))
}

/// Handler: Create a new row
/// POST /:schema/:table
#[axum::debug_handler]
pub async fn create_row(
    State(state): State<Arc<AppState>>,
    Path((schema, table)): Path<(String, String)>,
    claims: Option<axum::extract::Extension<Claims>>,
    Json(body): Json<Map<String, Value>>,
) -> Result<(StatusCode, Json<SingleResponse<Value>>), AppError> {
    info!("Create row: {}.{}", schema, table);

    // Check if schema is allowed
    if !state.config.allowed_schemas.contains(&schema) {
        return Err(AppError::SchemaNotAllowed(schema));
    }

    // Get table metadata
    let table_meta = state.schema_cache.get_table(&schema, &table)
        .ok_or_else(|| AppError::TableNotFound(format!("{}.{}", schema, table)))?;

    // Build and execute query
    let (sql, sql_params) = query_builder::build_insert_query(&table_meta, &body)?;

    let pool = (*state.pool).clone();
    let row = execute_query_one(&pool, &sql, sql_params, claims.as_ref().map(|c| &c.0)).await?;

    Ok((StatusCode::CREATED, Json(SingleResponse::new(row))))
}

/// Handler: Update rows (bulk update with filters)
/// PATCH /:schema/:table
#[axum::debug_handler]
pub async fn update_rows(
    State(state): State<Arc<AppState>>,
    Path((schema, table)): Path<(String, String)>,
    Query(params): Query<HashMap<String, String>>,
    claims: Option<axum::extract::Extension<Claims>>,
    Json(body): Json<Map<String, Value>>,
) -> Result<Json<PaginatedResponse<Value>>, AppError> {
    info!("Update rows: {}.{}", schema, table);

    // Check if schema is allowed
    if !state.config.allowed_schemas.contains(&schema) {
        return Err(AppError::SchemaNotAllowed(schema));
    }

    // Get table metadata
    let table_meta = state.schema_cache.get_table(&schema, &table)
        .ok_or_else(|| AppError::TableNotFound(format!("{}.{}", schema, table)))?;

    // Parse query parameters for filters
    let query_params = parse_query_params(&params);

    // Build and execute query
    let (sql, sql_params) = query_builder::build_update_query(&table_meta, &query_params, &body)?;

    let pool = (*state.pool).clone();
    let rows = execute_query(&pool, &sql, sql_params, claims.as_ref().map(|c| &c.0)).await?;

    Ok(Json(paginated_response(
        rows.clone(),
        1,
        rows.len() as u32,
        rows.len() as u64,
    )))
}

/// Handler: Delete rows (bulk delete with filters)
/// DELETE /:schema/:table
#[axum::debug_handler]
pub async fn delete_rows(
    State(state): State<Arc<AppState>>,
    Path((schema, table)): Path<(String, String)>,
    Query(params): Query<HashMap<String, String>>,
    claims: Option<axum::extract::Extension<Claims>>,
) -> Result<Json<PaginatedResponse<Value>>, AppError> {
    info!("Delete rows: {}.{}", schema, table);

    // Check if schema is allowed
    if !state.config.allowed_schemas.contains(&schema) {
        return Err(AppError::SchemaNotAllowed(schema));
    }

    // Get table metadata
    let table_meta = state.schema_cache.get_table(&schema, &table)
        .ok_or_else(|| AppError::TableNotFound(format!("{}.{}", schema, table)))?;

    // Parse query parameters for filters
    let query_params = parse_query_params(&params);

    // Build and execute query
    let (sql, sql_params) = query_builder::build_delete_query(&table_meta, &query_params)?;

    let pool = (*state.pool).clone();
    let rows = execute_query(&pool, &sql, sql_params, claims.as_ref().map(|c| &c.0)).await?;

    Ok(Json(paginated_response(
        rows.clone(),
        1,
        rows.len() as u32,
        rows.len() as u64,
    )))
}

/// Handler: Update a single row by ID
/// PATCH /:schema/:table/:id
#[axum::debug_handler]
pub async fn update_row(
    State(state): State<Arc<AppState>>,
    Path((schema, table, id)): Path<(String, String, String)>,
    claims: Option<axum::extract::Extension<Claims>>,
    Json(body): Json<Map<String, Value>>,
) -> Result<Json<SingleResponse<Value>>, AppError> {
    info!("Update row: {}.{} id={}", schema, table, id);

    // Check if schema is allowed
    if !state.config.allowed_schemas.contains(&schema) {
        return Err(AppError::SchemaNotAllowed(schema));
    }

    // Get table metadata
    let table_meta = state.schema_cache.get_table(&schema, &table)
        .ok_or_else(|| AppError::TableNotFound(format!("{}.{}", schema, table)))?;

    // Determine ID column
    let id_column = table_meta.primary_keys.first()
        .cloned()
        .unwrap_or_else(|| "id".to_string());

    // Build and execute query
    let (sql, sql_params) = query_builder::build_update_by_id_query(&table_meta, &id_column, &id, &body)?;

    let pool = (*state.pool).clone();
    let row = execute_query_one(&pool, &sql, sql_params, claims.as_ref().map(|c| &c.0)).await?;

    Ok(Json(SingleResponse::new(row)))
}

/// Handler: Delete a single row by ID
/// DELETE /:schema/:table/:id
#[axum::debug_handler]
pub async fn delete_row(
    State(state): State<Arc<AppState>>,
    Path((schema, table, id)): Path<(String, String, String)>,
    claims: Option<axum::extract::Extension<Claims>>,
) -> Result<StatusCode, AppError> {
    info!("Delete row: {}.{} id={}", schema, table, id);

    // Check if schema is allowed
    if !state.config.allowed_schemas.contains(&schema) {
        return Err(AppError::SchemaNotAllowed(schema));
    }

    // Get table metadata
    let table_meta = state.schema_cache.get_table(&schema, &table)
        .ok_or_else(|| AppError::TableNotFound(format!("{}.{}", schema, table)))?;

    // Determine ID column
    let id_column = table_meta.primary_keys.first()
        .cloned()
        .unwrap_or_else(|| "id".to_string());

    // Build and execute query
    let (sql, sql_params) = query_builder::build_delete_by_id_query(&table_meta, &id_column, &id)?;

    let pool = (*state.pool).clone();
    execute_query(&pool, &sql, sql_params, claims.as_ref().map(|c| &c.0)).await?;

    Ok(StatusCode::NO_CONTENT)
}

/// Execute a query within RLS context
async fn execute_query(
    pool: &PgPool,
    sql: &str,
    params: Vec<Value>,
    claims: Option<&Claims>,
) -> Result<Vec<Value>, AppError> {
    let mut tx = pool.begin().await.map_err(AppError::DatabaseError)?;

    // Set RLS context if claims are present
    if let Some(claims) = claims {
        let role = claims.role.as_deref().unwrap_or("authenticated");
        RlsContext::configure_for_request(&mut tx, Some(claims), Some(role))
            .await
            .map_err(|e| AppError::InternalError(format!("Failed to configure RLS: {}", e)))?;
    } else {
        // Anonymous access
        RlsContext::configure_for_request(&mut tx, None, Some("anon"))
            .await
            .map_err(|e| AppError::InternalError(format!("Failed to configure RLS: {}", e)))?;
    }

    // Execute query with parameters
    let mut query = sqlx::query_as::<_, (Value,)>(sql);
    for param in params {
        query = bind_value(query, param);
    }

    let rows: Vec<(Value,)> = query
        .fetch_all(&mut *tx)
        .await
        .map_err(AppError::DatabaseError)?;

    tx.commit().await.map_err(AppError::DatabaseError)?;

    Ok(rows.into_iter().map(|r| r.0).collect())
}

/// Execute a query returning a single row
async fn execute_query_one(
    pool: &PgPool,
    sql: &str,
    params: Vec<Value>,
    claims: Option<&Claims>,
) -> Result<Value, AppError> {
    let rows = execute_query(pool, sql, params, claims).await?;
    rows.into_iter()
        .next()
        .ok_or_else(|| AppError::NotFound("Record not found".to_string()))
}

/// Execute a count query
async fn execute_count(
    pool: &PgPool,
    sql: &str,
    params: Vec<Value>,
    claims: Option<&Claims>,
) -> Result<u64, AppError> {
    let mut tx = pool.begin().await.map_err(AppError::DatabaseError)?;

    // Set RLS context if claims are present
    if let Some(claims) = claims {
        let role = claims.role.as_deref().unwrap_or("authenticated");
        RlsContext::configure_for_request(&mut tx, Some(claims), Some(role))
            .await
            .map_err(|e| AppError::InternalError(format!("Failed to configure RLS: {}", e)))?;
    } else {
        // Anonymous access
        RlsContext::configure_for_request(&mut tx, None, Some("anon"))
            .await
            .map_err(|e| AppError::InternalError(format!("Failed to configure RLS: {}", e)))?;
    }

    // Execute query with parameters
    let mut query = sqlx::query_as::<_, (i64,)>(sql);
    for param in params {
        query = bind_count_value(query, param);
    }

    let result: (i64,) = query
        .fetch_one(&mut *tx)
        .await
        .map_err(AppError::DatabaseError)?;

    tx.commit().await.map_err(AppError::DatabaseError)?;

    Ok(result.0 as u64)
}

/// Bind a JSON value to a query for SELECT
fn bind_value<'a, T: sqlx::Type<sqlx::Postgres> + sqlx::Encode<'a, sqlx::Postgres> + 'a>(
    query: sqlx::query::QueryAs<'a, sqlx::Postgres, (T,), sqlx::postgres::PgArguments>,
    value: Value,
) -> sqlx::query::QueryAs<'a, sqlx::Postgres, (T,), sqlx::postgres::PgArguments> {
    // This is a simplified version - in reality we'd need proper type handling
    // For now, we'll bind as text and let PostgreSQL cast
    query.bind(value.to_string())
}

/// Bind a JSON value to a query for COUNT
fn bind_count_value<'a>(
    query: sqlx::query::QueryAs<'a, sqlx::Postgres, (i64,), sqlx::postgres::PgArguments>,
    value: Value,
) -> sqlx::query::QueryAs<'a, sqlx::Postgres, (i64,), sqlx::postgres::PgArguments> {
    query.bind(value.to_string())
}

// Legacy handlers for backwards compatibility
pub async fn list_records(
    State(state): State<Arc<AppState>>,
    Path(table): Path<String>,
    Query(params): Query<HashMap<String, String>>,
    headers: HeaderMap,
    claims: Option<axum::extract::Extension<Claims>>,
) -> Result<Json<PaginatedResponse<Value>>, AppError> {
    let schema = get_schema(&headers);
    let safe_schema = validate_identifier(&schema)?;
    list_rows(State(state), Path((safe_schema.to_string(), table)), Query(params), claims).await
}

pub async fn get_record(
    State(state): State<Arc<AppState>>,
    Path((table, id)): Path<(String, String)>,
    headers: HeaderMap,
    claims: Option<axum::extract::Extension<Claims>>,
) -> Result<Json<SingleResponse<Value>>, AppError> {
    let schema = get_schema(&headers);
    let safe_schema = validate_identifier(&schema)?;
    get_row(State(state), Path((safe_schema.to_string(), table, id)), claims).await
}

pub async fn create_record(
    State(state): State<Arc<AppState>>,
    Path(table): Path<String>,
    headers: HeaderMap,
    claims: Option<axum::extract::Extension<Claims>>,
    Json(body): Json<Map<String, Value>>,
) -> Result<(StatusCode, Json<SingleResponse<Value>>), AppError> {
    let schema = get_schema(&headers);
    let safe_schema = validate_identifier(&schema)?;
    create_row(State(state), Path((safe_schema.to_string(), table)), claims, Json(body)).await
}

pub async fn update_record(
    State(state): State<Arc<AppState>>,
    Path((table, id)): Path<(String, String)>,
    headers: HeaderMap,
    claims: Option<axum::extract::Extension<Claims>>,
    Json(body): Json<Map<String, Value>>,
) -> Result<Json<SingleResponse<Value>>, AppError> {
    let schema = get_schema(&headers);
    let safe_schema = validate_identifier(&schema)?;
    update_row(State(state), Path((safe_schema.to_string(), table, id)), claims, Json(body)).await
}

pub async fn delete_record(
    State(state): State<Arc<AppState>>,
    Path((table, id)): Path<(String, String)>,
    headers: HeaderMap,
    claims: Option<axum::extract::Extension<Claims>>,
) -> Result<StatusCode, AppError> {
    let schema = get_schema(&headers);
    let safe_schema = validate_identifier(&schema)?;
    delete_row(State(state), Path((safe_schema.to_string(), table, id)), claims).await
}

fn get_schema(headers: &HeaderMap) -> String {
    headers
        .get("X-IndusBase-DB-Schema")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("public")
        .to_string()
}

fn validate_identifier(name: &str) -> Result<&str, AppError> {
    let starts_valid = name
        .chars()
        .next()
        .map(|c| c.is_ascii_alphabetic() || c == '_')
        .unwrap_or(false);
    let valid = starts_valid && name.chars().all(|c| c.is_ascii_alphanumeric() || c == '_');
    if !valid || name.is_empty() || name.len() > 63 {
        return Err(AppError::BadRequest("Invalid identifier".into()));
    }
    Ok(name)
}
