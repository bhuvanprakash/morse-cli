use crate::errors::AppError;
use anyhow::Result;
use serde_json::Value;
use sqlx::{PgPool, Row};

/// Execute a query and return results as JSON values
pub async fn execute_query(
    pool: &PgPool,
    sql: &str,
    params: Vec<Value>,
) -> Result<Vec<Value>, AppError> {
    let mut query = sqlx::query(sql);

    // Bind parameters
    for param in params {
        query = bind_json_value(query, param);
    }

    let rows = query.fetch_all(pool).await.map_err(AppError::DatabaseError)?;

    // Convert rows to JSON
    let results: Vec<Value> = rows.iter().map(map_row_to_json).collect::<Result<Vec<_>, _>>()?;

    Ok(results)
}

/// Execute a mutation (INSERT/UPDATE/DELETE) and return affected row count
pub async fn execute_mutation(
    pool: &PgPool,
    sql: &str,
    params: Vec<Value>,
) -> Result<u64, AppError> {
    let mut query = sqlx::query(sql);

    // Bind parameters
    for param in params {
        query = bind_json_value(query, param);
    }

    let result = query.execute(pool).await.map_err(AppError::DatabaseError)?;

    Ok(result.rows_affected())
}

/// Execute a query and return the first row
pub async fn execute_query_one(
    pool: &PgPool,
    sql: &str,
    params: Vec<Value>,
) -> Result<Value, AppError> {
    let mut query = sqlx::query(sql);

    // Bind parameters
    for param in params {
        query = bind_json_value(query, param);
    }

    let row = query.fetch_one(pool).await.map_err(AppError::DatabaseError)?;

    map_row_to_json(&row)
}

/// Execute a query and return an optional row
pub async fn execute_query_optional(
    pool: &PgPool,
    sql: &str,
    params: Vec<Value>,
) -> Result<Option<Value>, AppError> {
    let mut query = sqlx::query(sql);

    // Bind parameters
    for param in params {
        query = bind_json_value(query, param);
    }

    let row = query.fetch_optional(pool).await.map_err(AppError::DatabaseError)?;

    row.map(|r| map_row_to_json(&r)).transpose()
}

/// Map a database row to a JSON value
fn map_row_to_json(row: &sqlx::postgres::PgRow) -> Result<Value, AppError> {
    use sqlx::Column;
    use sqlx::TypeInfo;

    let mut map = serde_json::Map::new();

    for (i, column) in row.columns().iter().enumerate() {
        let column_name = column.name();
        let type_info = column.type_info();
        let type_name = type_info.name();

        let value: Value = match type_name {
            "BOOL" => {
                let v: Option<bool> = row.try_get(i).ok();
                v.into()
            }
            "INT2" => {
                let v: Option<i16> = row.try_get(i).ok();
                v.map(|v| Value::Number(v.into())).unwrap_or(Value::Null)
            }
            "INT4" => {
                let v: Option<i32> = row.try_get(i).ok();
                v.map(|v| Value::Number(v.into())).unwrap_or(Value::Null)
            }
            "INT8" => {
                let v: Option<i64> = row.try_get(i).ok();
                v.map(|v| Value::Number(v.into())).unwrap_or(Value::Null)
            }
            "FLOAT4" => {
                let v: Option<f32> = row.try_get(i).ok();
                match v {
                    Some(f) => serde_json::Number::from_f64(f as f64)
                        .map(Value::Number)
                        .unwrap_or(Value::Null),
                    None => Value::Null,
                }
            }
            "FLOAT8" => {
                let v: Option<f64> = row.try_get(i).ok();
                match v {
                    Some(f) => serde_json::Number::from_f64(f)
                        .map(Value::Number)
                        .unwrap_or(Value::Null),
                    None => Value::Null,
                }
            }
            "TEXT" | "VARCHAR" | "CHAR" | "BPCHAR" | "NAME" => {
                let v: Option<String> = row.try_get(i).ok();
                v.map(Value::String).unwrap_or(Value::Null)
            }
            "TIMESTAMP" => {
                let v: Option<chrono::NaiveDateTime> = row.try_get(i).ok();
                v.map(|dt| Value::String(dt.to_string())).unwrap_or(Value::Null)
            }
            "TIMESTAMPTZ" => {
                let v: Option<chrono::DateTime<chrono::Utc>> = row.try_get(i).ok();
                v.map(|dt| Value::String(dt.to_rfc3339())).unwrap_or(Value::Null)
            }
            "DATE" => {
                let v: Option<chrono::NaiveDate> = row.try_get(i).ok();
                v.map(|d| Value::String(d.to_string())).unwrap_or(Value::Null)
            }
            "TIME" => {
                let v: Option<chrono::NaiveTime> = row.try_get(i).ok();
                v.map(|t| Value::String(t.to_string())).unwrap_or(Value::Null)
            }
            "UUID" => {
                let v: Option<uuid::Uuid> = row.try_get(i).ok();
                v.map(|u| Value::String(u.to_string())).unwrap_or(Value::Null)
            }
            "JSON" | "JSONB" => {
                row.try_get::<Value, _>(i).ok().unwrap_or(Value::Null)
            }
            "BYTEA" => {
                let v: Option<Vec<u8>> = row.try_get(i).ok();
                v.map(|b| Value::String(base64::encode(&b))).unwrap_or(Value::Null)
            }
            _ => {
                // Try to get as string for unknown types
                let v: Option<String> = row.try_get(i).ok();
                v.map(Value::String).unwrap_or(Value::Null)
            }
        };

        map.insert(column_name.to_string(), value);
    }

    Ok(Value::Object(map))
}

/// Bind a JSON value to a SQL query
fn bind_json_value<'a>(
    query: sqlx::query::Query<'a, sqlx::Postgres, sqlx::postgres::PgArguments>,
    value: Value,
) -> sqlx::query::Query<'a, sqlx::Postgres, sqlx::postgres::PgArguments> {
    match value {
        Value::Null => query.bind(None::<String>),
        Value::Bool(b) => query.bind(b),
        Value::Number(n) => {
            if let Some(i) = n.as_i64() {
                query.bind(i)
            } else if let Some(f) = n.as_f64() {
                query.bind(f)
            } else {
                query.bind(n.to_string())
            }
        }
        Value::String(s) => query.bind(s),
        Value::Array(arr) => query.bind(serde_json::to_string(&arr).unwrap_or_default()),
        Value::Object(obj) => query.bind(serde_json::to_string(&obj).unwrap_or_default()),
    }
}

// Simple base64 encoding for bytea
mod base64 {
    pub fn encode(input: &[u8]) -> String {
        use std::fmt::Write;
        const CHARSET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        
        let mut output = String::new();
        for chunk in input.chunks(3) {
            let buf = match chunk.len() {
                3 => [chunk[0], chunk[1], chunk[2]],
                2 => [chunk[0], chunk[1], 0],
                1 => [chunk[0], 0, 0],
                _ => continue,
            };
            
            let idx1 = (buf[0] >> 2) as usize;
            let idx2 = (((buf[0] & 0b11) << 4) | (buf[1] >> 4)) as usize;
            let idx3 = (((buf[1] & 0b1111) << 2) | (buf[2] >> 6)) as usize;
            let idx4 = (buf[2] & 0b111111) as usize;
            
            write!(&mut output, "{}{}{}{}",
                CHARSET[idx1] as char,
                CHARSET[idx2] as char,
                if chunk.len() > 1 { CHARSET[idx3] as char } else { '=' },
                if chunk.len() > 2 { CHARSET[idx4] as char } else { '=' }
            ).unwrap();
        }
        
        output
    }
}

/// Query executor for structured query execution
pub struct QueryExecutor {
    pool: PgPool,
}

impl QueryExecutor {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn execute(&self, query: &str, params: Vec<String>) -> Result<u64, AppError> {
        let mut sqlx_query = sqlx::query(query);
        for param in params {
            sqlx_query = sqlx_query.bind(param);
        }
        
        let result = sqlx_query.execute(&self.pool).await.map_err(AppError::DatabaseError)?;
        Ok(result.rows_affected())
    }

    pub async fn fetch_one(&self, query: &str, params: Vec<String>) -> Result<Value, AppError> {
        execute_query_one(&self.pool, query, params.into_iter().map(Value::String).collect()).await
    }

    pub async fn fetch_optional(
        &self,
        query: &str,
        params: Vec<String>,
    ) -> Result<Option<Value>, AppError> {
        execute_query_optional(&self.pool, query, params.into_iter().map(Value::String).collect()).await
    }
}


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_base64_encode() {
        assert_eq!(base64::encode(b"hello"), "aGVsbG8=");
        assert_eq!(base64::encode(b"f"), "Zg==");
        assert_eq!(base64::encode(b"fo"), "Zm8=");
        assert_eq!(base64::encode(b"foo"), "Zm9v");
    }
}
