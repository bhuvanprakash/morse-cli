use crate::errors::AppError;
use crate::rest::filter::{FilterOperator, OrderDirection, QueryParams};
use crate::schema::types::TableMeta;
use serde_json::Value;
use std::collections::HashMap;

/// Build a SELECT query with filters
pub fn build_select_query(
    table: &TableMeta,
    filters: &QueryParams,
    max_rows: usize,
) -> Result<(String, Vec<Value>), AppError> {
    let mut params: Vec<Value> = Vec::new();
    let mut param_idx = 1;

    // Build SELECT clause
    let select_cols = if filters.select.is_empty() {
        "*".to_string()
    } else {
        // Sanitize column names
        filters.select
            .iter()
            .filter(|col| table.columns.iter().any(|c| &c.name == *col))
            .map(|col| sanitize_identifier(col))
            .collect::<Vec<_>>()
            .join(", ")
    };

    // Build base query
    let table_name = format!("{}.{}", 
        sanitize_identifier(&table.schema_name),
        sanitize_identifier(&table.table_name)
    );

    let mut sql = format!("SELECT {} FROM {}", select_cols, table_name);

    // Build WHERE clause
    let where_conditions: Vec<String> = filters.filters.iter()
        .filter_map(|filter| {
            // Verify column exists
            if !table.columns.iter().any(|c| c.name == filter.field) {
                return None;
            }

            let col = sanitize_identifier(&filter.field);
            
            match filter.operator {
                FilterOperator::IsNull => {
                    Some(format!("{} IS NULL", col))
                }
                FilterOperator::IsNotNull => {
                    Some(format!("{} IS NOT NULL", col))
                }
                FilterOperator::In => {
                    // For IN, we need to handle multiple values
                    let values: Vec<&str> = filter.value.split(',').collect();
                    let placeholders: Vec<String> = (0..values.len())
                        .map(|i| format!("${}", param_idx + i))
                        .collect();
                    
                    for v in &values {
                        params.push(Value::String(v.to_string()));
                    }
                    param_idx += values.len();
                    
                    Some(format!("{} IN ({})", col, placeholders.join(", ")))
                }
                _ => {
                    let placeholder = format!("${}", param_idx);
                    params.push(Value::String(filter.value.clone()));
                    param_idx += 1;
                    Some(format!("{} {} {}", col, filter.operator.to_sql(), placeholder))
                }
            }
        })
        .collect();

    if !where_conditions.is_empty() {
        sql.push_str(" WHERE ");
        sql.push_str(&where_conditions.join(" AND "));
    }

    // Build ORDER BY clause
    if !filters.order_by.is_empty() {
        let order_clauses: Vec<String> = filters.order_by.iter()
            .map(|o| {
                let col = sanitize_identifier(&o.field);
                format!("{} {}", col, o.direction.to_sql())
            })
            .collect();
        sql.push_str(" ORDER BY ");
        sql.push_str(&order_clauses.join(", "));
    }

    // Build LIMIT and OFFSET
    let limit = filters.limit.unwrap_or(20).min(max_rows as u32);
    let offset = filters.offset_or_default();

    sql.push_str(&format!(" LIMIT ${} OFFSET ${}", param_idx, param_idx + 1));
    params.push(Value::Number(limit.into()));
    params.push(Value::Number(offset.into()));

    Ok((sql, params))
}

/// Build a COUNT query for pagination
pub fn build_count_query(
    table: &TableMeta,
    filters: &QueryParams,
) -> Result<(String, Vec<Value>), AppError> {
    let mut params: Vec<Value> = Vec::new();
    let mut param_idx = 1;

    let table_name = format!("{}.{}", 
        sanitize_identifier(&table.schema_name),
        sanitize_identifier(&table.table_name)
    );

    let mut sql = format!("SELECT COUNT(*) FROM {}", table_name);

    // Build WHERE clause
    let where_conditions: Vec<String> = filters.filters.iter()
        .filter_map(|filter| {
            if !table.columns.iter().any(|c| c.name == filter.field) {
                return None;
            }

            let col = sanitize_identifier(&filter.field);
            
            match filter.operator {
                FilterOperator::IsNull => {
                    Some(format!("{} IS NULL", col))
                }
                FilterOperator::IsNotNull => {
                    Some(format!("{} IS NOT NULL", col))
                }
                FilterOperator::In => {
                    let values: Vec<&str> = filter.value.split(',').collect();
                    let placeholders: Vec<String> = (0..values.len())
                        .map(|i| format!("${}", param_idx + i))
                        .collect();
                    
                    for v in &values {
                        params.push(Value::String(v.to_string()));
                    }
                    param_idx += values.len();
                    
                    Some(format!("{} IN ({})", col, placeholders.join(", ")))
                }
                _ => {
                    let placeholder = format!("${}", param_idx);
                    params.push(Value::String(filter.value.clone()));
                    param_idx += 1;
                    Some(format!("{} {} {}", col, filter.operator.to_sql(), placeholder))
                }
            }
        })
        .collect();

    if !where_conditions.is_empty() {
        sql.push_str(" WHERE ");
        sql.push_str(&where_conditions.join(" AND "));
    }

    Ok((sql, params))
}

/// Build an INSERT query
pub fn build_insert_query(
    table: &TableMeta,
    body: &serde_json::Map<String, Value>,
) -> Result<(String, Vec<Value>), AppError> {
    let mut columns: Vec<String> = Vec::new();
    let mut placeholders: Vec<String> = Vec::new();
    let mut params: Vec<Value> = Vec::new();
    let mut param_idx = 1;

    for (key, value) in body.iter() {
        // Verify column exists
        if !table.columns.iter().any(|c| &c.name == key) {
            continue; // Skip unknown columns
        }

        columns.push(sanitize_identifier(key));
        placeholders.push(format!("${}", param_idx));
        params.push(value.clone());
        param_idx += 1;
    }

    if columns.is_empty() {
        return Err(AppError::BadRequest("No valid columns provided for insert".to_string()));
    }

    let table_name = format!("{}.{}", 
        sanitize_identifier(&table.schema_name),
        sanitize_identifier(&table.table_name)
    );

    let sql = format!(
        "INSERT INTO {} ({}) VALUES ({}) RETURNING *",
        table_name,
        columns.join(", "),
        placeholders.join(", ")
    );

    Ok((sql, params))
}

/// Build an UPDATE query
pub fn build_update_query(
    table: &TableMeta,
    filters: &QueryParams,
    body: &serde_json::Map<String, Value>,
) -> Result<(String, Vec<Value>), AppError> {
    let mut set_clauses: Vec<String> = Vec::new();
    let mut params: Vec<Value> = Vec::new();
    let mut param_idx = 1;

    for (key, value) in body.iter() {
        // Skip primary keys and unknown columns
        if table.primary_keys.contains(key) {
            continue;
        }
        if !table.columns.iter().any(|c| &c.name == key) {
            continue;
        }

        set_clauses.push(format!("{} = ${}", sanitize_identifier(key), param_idx));
        params.push(value.clone());
        param_idx += 1;
    }

    if set_clauses.is_empty() {
        return Err(AppError::BadRequest("No valid columns to update".to_string()));
    }

    let table_name = format!("{}.{}", 
        sanitize_identifier(&table.schema_name),
        sanitize_identifier(&table.table_name)
    );

    let mut sql = format!("UPDATE {} SET {}", table_name, set_clauses.join(", "));

    // Build WHERE clause from filters
    let where_conditions: Vec<String> = filters.filters.iter()
        .filter_map(|filter| {
            if !table.columns.iter().any(|c| c.name == filter.field) {
                return None;
            }

            let col = sanitize_identifier(&filter.field);
            
            match filter.operator {
                FilterOperator::IsNull => {
                    Some(format!("{} IS NULL", col))
                }
                FilterOperator::IsNotNull => {
                    Some(format!("{} IS NOT NULL", col))
                }
                _ => {
                    let placeholder = format!("${}", param_idx);
                    params.push(Value::String(filter.value.clone()));
                    param_idx += 1;
                    Some(format!("{} {} {}", col, filter.operator.to_sql(), placeholder))
                }
            }
        })
        .collect();

    if !where_conditions.is_empty() {
        sql.push_str(" WHERE ");
        sql.push_str(&where_conditions.join(" AND "));
    }

    sql.push_str(" RETURNING *");

    Ok((sql, params))
}

/// Build a DELETE query
pub fn build_delete_query(
    table: &TableMeta,
    filters: &QueryParams,
) -> Result<(String, Vec<Value>), AppError> {
    let mut params: Vec<Value> = Vec::new();
    let mut param_idx = 1;

    let table_name = format!("{}.{}", 
        sanitize_identifier(&table.schema_name),
        sanitize_identifier(&table.table_name)
    );

    let mut sql = format!("DELETE FROM {}", table_name);

    // Build WHERE clause
    let where_conditions: Vec<String> = filters.filters.iter()
        .filter_map(|filter| {
            if !table.columns.iter().any(|c| c.name == filter.field) {
                return None;
            }

            let col = sanitize_identifier(&filter.field);
            
            match filter.operator {
                FilterOperator::IsNull => {
                    Some(format!("{} IS NULL", col))
                }
                FilterOperator::IsNotNull => {
                    Some(format!("{} IS NOT NULL", col))
                }
                _ => {
                    let placeholder = format!("${}", param_idx);
                    params.push(Value::String(filter.value.clone()));
                    param_idx += 1;
                    Some(format!("{} {} {}", col, filter.operator.to_sql(), placeholder))
                }
            }
        })
        .collect();

    if !where_conditions.is_empty() {
        sql.push_str(" WHERE ");
        sql.push_str(&where_conditions.join(" AND "));
    }

    sql.push_str(" RETURNING *");

    Ok((sql, params))
}

/// Build a SELECT by ID query
pub fn build_select_by_id_query(
    table: &TableMeta,
    id_column: &str,
    id_value: &str,
) -> Result<(String, Vec<Value>), AppError> {
    // Verify the id column exists
    if !table.columns.iter().any(|c| c.name == id_column) {
        return Err(AppError::BadRequest(format!("Column {} not found", id_column)));
    }

    let table_name = format!("{}.{}", 
        sanitize_identifier(&table.schema_name),
        sanitize_identifier(&table.table_name)
    );

    let col = sanitize_identifier(id_column);
    let sql = format!("SELECT * FROM {} WHERE {} = $1", table_name, col);
    let params = vec![Value::String(id_value.to_string())];

    Ok((sql, params))
}

/// Build an UPDATE by ID query
pub fn build_update_by_id_query(
    table: &TableMeta,
    id_column: &str,
    id_value: &str,
    body: &serde_json::Map<String, Value>,
) -> Result<(String, Vec<Value>), AppError> {
    let mut set_clauses: Vec<String> = Vec::new();
    let mut params: Vec<Value> = Vec::new();
    let mut param_idx = 1;

    for (key, value) in body.iter() {
        // Skip the id column and unknown columns
        if key == id_column {
            continue;
        }
        if !table.columns.iter().any(|c| &c.name == key) {
            continue;
        }

        set_clauses.push(format!("{} = ${}", sanitize_identifier(key), param_idx));
        params.push(value.clone());
        param_idx += 1;
    }

    if set_clauses.is_empty() {
        return Err(AppError::BadRequest("No valid columns to update".to_string()));
    }

    let table_name = format!("{}.{}", 
        sanitize_identifier(&table.schema_name),
        sanitize_identifier(&table.table_name)
    );

    let col = sanitize_identifier(id_column);
    let sql = format!(
        "UPDATE {} SET {} WHERE {} = ${} RETURNING *",
        table_name,
        set_clauses.join(", "),
        col,
        param_idx
    );
    params.push(Value::String(id_value.to_string()));

    Ok((sql, params))
}

/// Build a DELETE by ID query
pub fn build_delete_by_id_query(
    table: &TableMeta,
    id_column: &str,
    id_value: &str,
) -> Result<(String, Vec<Value>), AppError> {
    let table_name = format!("{}.{}", 
        sanitize_identifier(&table.schema_name),
        sanitize_identifier(&table.table_name)
    );

    let col = sanitize_identifier(id_column);
    let sql = format!("DELETE FROM {} WHERE {} = $1 RETURNING *", table_name, col);
    let params = vec![Value::String(id_value.to_string())];

    Ok((sql, params))
}

/// Sanitize SQL identifiers
fn sanitize_identifier(ident: &str) -> String {
    ident
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '_')
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::schema::types::{ColumnMeta, PgType};

    fn create_test_table() -> TableMeta {
        TableMeta {
            schema_name: "public".to_string(),
            table_name: "users".to_string(),
            columns: vec![
                ColumnMeta {
                    name: "id".to_string(),
                    data_type: PgType::Int4,
                    is_nullable: false,
                    is_primary_key: true,
                    default_value: None,
                    max_length: None,
                    ordinal_position: 1,
                    is_unique: true,
                    foreign_key: None,
                },
                ColumnMeta {
                    name: "name".to_string(),
                    data_type: PgType::Text,
                    is_nullable: true,
                    is_primary_key: false,
                    default_value: None,
                    max_length: None,
                    ordinal_position: 2,
                    is_unique: false,
                    foreign_key: None,
                },
                ColumnMeta {
                    name: "email".to_string(),
                    data_type: PgType::Text,
                    is_nullable: true,
                    is_primary_key: false,
                    default_value: None,
                    max_length: None,
                    ordinal_position: 3,
                    is_unique: true,
                    foreign_key: None,
                },
            ],
            has_rls_enabled: false,
            primary_keys: vec!["id".to_string()],
        }
    }

    #[test]
    fn test_build_select_query() {
        let table = create_test_table();
        let filters = QueryParams::default();
        
        let (sql, params) = build_select_query(&table, &filters, 100).unwrap();
        assert!(sql.contains("SELECT * FROM public.users"));
        assert!(sql.contains("LIMIT"));
        assert!(sql.contains("OFFSET"));
        assert_eq!(params.len(), 2); // limit and offset
    }

    #[test]
    fn test_build_select_query_with_filters() {
        let table = create_test_table();
        let mut filters = QueryParams::default();
        filters.filters.push(crate::rest::filter::Filter {
            field: "name".to_string(),
            operator: FilterOperator::Eq,
            value: "John".to_string(),
        });
        
        let (sql, params) = build_select_query(&table, &filters, 100).unwrap();
        assert!(sql.contains("WHERE"));
        assert!(sql.contains("name = $1"));
        assert_eq!(params.len(), 4); // name, limit, offset + 1 placeholder
    }

    #[test]
    fn test_build_insert_query() {
        let table = create_test_table();
        let mut body = serde_json::Map::new();
        body.insert("name".to_string(), Value::String("John".to_string()));
        body.insert("email".to_string(), Value::String("john@example.com".to_string()));
        
        let (sql, params) = build_insert_query(&table, &body).unwrap();
        assert!(sql.contains("INSERT INTO public.users"));
        assert!(sql.contains("name, email"));
        assert!(sql.contains("RETURNING *"));
        assert_eq!(params.len(), 2);
    }

    #[test]
    fn test_sanitize_identifier() {
        assert_eq!(sanitize_identifier("users"), "users");
        assert_eq!(sanitize_identifier("user_name"), "user_name");
        assert_eq!(sanitize_identifier("user; DROP TABLE users;"), "userDROPTABLEusers");
    }
}
