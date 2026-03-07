use async_graphql::{Error, Json, Object, Result};
use serde_json::Value;
use sqlx::{PgPool, QueryBuilder, Row};
use std::collections::HashMap;

use crate::graphql::types::{DynamicRow, PageInfo, RowInput, TableConnection, TableFilter, TableOrder};

pub struct QueryRoot {
    pub pool: PgPool,
}

#[Object]
impl QueryRoot {
    async fn tables(&self) -> Result<Vec<String>> {
        let rows = sqlx::query(
            "SELECT table_name FROM information_schema.tables
             WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
             ORDER BY table_name",
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(rows
            .into_iter()
            .map(|row| row.get::<String, _>("table_name"))
            .collect())
    }

    async fn rows(
        &self,
        table: String,
        filters: Option<Vec<TableFilter>>,
        order: Option<TableOrder>,
        limit: Option<i32>,
        offset: Option<i32>,
    ) -> Result<TableConnection> {
        let safe_table = sanitize_identifier(&table)?;
        let limit_value = limit.unwrap_or(50).clamp(1, 1000);
        let offset_value = offset.unwrap_or(0).max(0);

        // These queries are intentionally built at runtime because table names and
        // filter columns come from the live PostgreSQL schema, not compile-time SQL.
        let mut count_builder = QueryBuilder::<sqlx::Postgres>::new(format!("SELECT COUNT(*) AS count FROM {safe_table}"));
        apply_filters(&mut count_builder, filters.as_ref())?;
        let count_row = count_builder.build().fetch_one(&self.pool).await?;
        let total_count: i64 = count_row.get("count");

        let mut data_builder = QueryBuilder::<sqlx::Postgres>::new(format!(
            "SELECT row_to_json(t) AS row_data FROM {safe_table} t"
        ));
        apply_filters_with_alias(&mut data_builder, filters.as_ref(), "t")?;
        apply_order(&mut data_builder, order.as_ref(), "t")?;
        data_builder.push(" LIMIT ");
        data_builder.push_bind(limit_value as i64);
        data_builder.push(" OFFSET ");
        data_builder.push_bind(offset_value as i64);

        let rows = data_builder.build().fetch_all(&self.pool).await?;
        let nodes = rows
            .into_iter()
            .filter_map(|row| {
                let value: Value = row.get("row_data");
                match value {
                    Value::Object(map) => Some(DynamicRow {
                        data: Json(map.into_iter().collect::<HashMap<String, Value>>()),
                    }),
                    _ => None,
                }
            })
            .collect();

        Ok(TableConnection {
            nodes,
            page_info: PageInfo {
                total_count,
                has_next_page: (offset_value as i64 + limit_value as i64) < total_count,
                has_prev_page: offset_value > 0,
            },
        })
    }
}

pub struct MutationRoot {
    pub pool: PgPool,
}

#[Object]
impl MutationRoot {
    async fn insert_row(&self, table: String, input: RowInput) -> Result<DynamicRow> {
        let safe_table = sanitize_identifier(&table)?;
        let data = input.data.0;
        if data.is_empty() {
            return Err(Error::new("No data provided"));
        }

        let columns = data
            .keys()
            .map(|key| sanitize_identifier(key))
            .collect::<Result<Vec<_>>>()?;

        let mut builder = QueryBuilder::<sqlx::Postgres>::new(format!("INSERT INTO {safe_table} ("));
        {
            let mut separated = builder.separated(", ");
            for column in &columns {
                separated.push(column);
            }
        }
        builder.push(") VALUES (");
        {
            let mut separated = builder.separated(", ");
            for column in &columns {
                let value = data
                    .get(column)
                    .ok_or_else(|| Error::new(format!("Missing value for column {column}")))?;
                separated.push_bind(value.to_string());
            }
        }
        builder.push(") RETURNING row_to_json(");
        builder.push(safe_table.as_str());
        builder.push(") AS row_data");

        let row = builder.build().fetch_one(&self.pool).await?;
        let value: Value = row.get("row_data");
        match value {
            Value::Object(map) => Ok(DynamicRow {
                data: Json(map.into_iter().collect::<HashMap<String, Value>>()),
            }),
            _ => Err(Error::new("Insert failed")),
        }
    }

    async fn delete_rows(&self, table: String, filters: Vec<TableFilter>) -> Result<i64> {
        if filters.is_empty() {
            return Err(Error::new("Filters required for delete"));
        }
        let safe_table = sanitize_identifier(&table)?;
        let mut builder = QueryBuilder::<sqlx::Postgres>::new(format!("DELETE FROM {safe_table}"));
        apply_filters(&mut builder, Some(&filters))?;
        let result = builder.build().execute(&self.pool).await?;
        Ok(result.rows_affected() as i64)
    }
}

fn apply_filters(
    builder: &mut QueryBuilder<'_, sqlx::Postgres>,
    filters: Option<&Vec<TableFilter>>,
) -> Result<()> {
    apply_filters_with_alias(builder, filters, "")
}

fn apply_filters_with_alias(
    builder: &mut QueryBuilder<'_, sqlx::Postgres>,
    filters: Option<&Vec<TableFilter>>,
    alias: &str,
) -> Result<()> {
    let Some(filters) = filters else {
        return Ok(());
    };
    if filters.is_empty() {
        return Ok(());
    }

    builder.push(" WHERE ");
    let mut separated = builder.separated(" AND ");
    for filter in filters {
        let column = sanitize_identifier(&filter.column)?;
        let qualified = if alias.is_empty() {
            column.clone()
        } else {
            format!("{alias}.{column}")
        };
        match filter.operator.as_str() {
            "eq" => {
                separated.push(qualified.as_str());
                separated.push(" = ");
                separated.push_bind(filter.value.clone());
            }
            "neq" => {
                separated.push(qualified.as_str());
                separated.push(" != ");
                separated.push_bind(filter.value.clone());
            }
            "gt" => {
                separated.push(qualified.as_str());
                separated.push(" > ");
                separated.push_bind(filter.value.clone());
            }
            "gte" => {
                separated.push(qualified.as_str());
                separated.push(" >= ");
                separated.push_bind(filter.value.clone());
            }
            "lt" => {
                separated.push(qualified.as_str());
                separated.push(" < ");
                separated.push_bind(filter.value.clone());
            }
            "lte" => {
                separated.push(qualified.as_str());
                separated.push(" <= ");
                separated.push_bind(filter.value.clone());
            }
            "like" => {
                separated.push(qualified.as_str());
                separated.push(" LIKE ");
                separated.push_bind(filter.value.clone());
            }
            "ilike" => {
                separated.push(qualified.as_str());
                separated.push(" ILIKE ");
                separated.push_bind(filter.value.clone());
            }
            "is" => {
                separated.push(qualified.as_str());
                separated.push(" IS ");
                separated.push(filter.value.as_str());
            }
            "in" => {
                let values = filter
                    .value
                    .split(',')
                    .map(|value| value.trim().to_string())
                    .filter(|value| !value.is_empty())
                    .collect::<Vec<_>>();
                if values.is_empty() {
                    return Err(Error::new("IN filter requires at least one value"));
                }
                separated.push(qualified.as_str());
                separated.push(" IN (");
                for (idx, value) in values.iter().enumerate() {
                    if idx > 0 {
                        separated.push(", ");
                    }
                    separated.push_bind(value.clone());
                }
                separated.push(")");
            }
            operator => {
                return Err(Error::new(format!("Unsupported operator: {operator}")));
            }
        }
    }
    Ok(())
}

fn apply_order(
    builder: &mut QueryBuilder<'_, sqlx::Postgres>,
    order: Option<&TableOrder>,
    alias: &str,
) -> Result<()> {
    if let Some(order) = order {
        let column = sanitize_identifier(&order.column)?;
        let direction = if order.direction.as_deref() == Some("DESC") {
            "DESC"
        } else {
            "ASC"
        };
        builder.push(" ORDER BY ");
        if !alias.is_empty() {
            builder.push(alias);
            builder.push(".");
        }
        builder.push(column.as_str());
        builder.push(" ");
        builder.push(direction);
    } else {
        builder.push(" ORDER BY 1");
    }
    Ok(())
}

fn sanitize_identifier(name: &str) -> Result<String> {
    if name.is_empty() || name.len() > 63 {
        return Err(Error::new(format!("Invalid identifier length: {name}")));
    }
    if !name
        .chars()
        .next()
        .map(|c| c.is_ascii_alphabetic() || c == '_')
        .unwrap_or(false)
    {
        return Err(Error::new(format!("Identifier must start with letter: {name}")));
    }
    if !name.chars().all(|c| c.is_ascii_alphanumeric() || c == '_') {
        return Err(Error::new(format!("Invalid identifier characters: {name}")));
    }
    Ok(name.to_lowercase())
}
