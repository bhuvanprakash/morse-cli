use async_graphql::dynamic::{
    Field, FieldFuture, InputValue, Object, ResolverContext, Scalar, Schema, SchemaBuilder, TypeRef,
};
use async_graphql::{Error, Value};
use serde_json::json;
use sqlx::{PgPool, Row};
use std::collections::HashMap;

#[derive(Clone)]
struct ColumnInfo {
    name: String,
    data_type: String,
    nullable: bool,
}

/// Build a dynamic GraphQL schema from PostgreSQL information_schema.
/// Tables become object types and list query fields (`<Table>List`).
pub async fn build_schema_from_db(
    pool: PgPool,
    schema_name: &str,
) -> Result<Schema, async_graphql::Error> {
    validate_identifier(schema_name)?;

    // Intentionally use runtime SQL (`sqlx::query`) instead of `query!` here because table/schema
    // targets are discovered dynamically from information_schema at runtime.
    let table_rows = sqlx::query(
        r#"
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = $1
          AND table_type = 'BASE TABLE'
        ORDER BY table_name
        "#,
    )
    .bind(schema_name)
    .fetch_all(&pool)
    .await
    .map_err(|e| Error::new(e.to_string()))?;

    let column_rows = sqlx::query(
        r#"
        SELECT table_name, column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = $1
        ORDER BY table_name, ordinal_position
        "#,
    )
    .bind(schema_name)
    .fetch_all(&pool)
    .await
    .map_err(|e| Error::new(e.to_string()))?;

    let mut table_columns: HashMap<String, Vec<ColumnInfo>> = HashMap::new();
    for row in column_rows {
        let table_name: String = row.get("table_name");
        let column_name: String = row.get("column_name");
        let data_type: String = row.get("data_type");
        let is_nullable: String = row.get("is_nullable");

        table_columns.entry(table_name).or_default().push(ColumnInfo {
            name: column_name,
            data_type,
            nullable: is_nullable == "YES",
        });
    }

    let mut schema_builder: SchemaBuilder = Schema::build("Query", Some("Mutation"), None);
    schema_builder = schema_builder.register(Scalar::new("JSON"));

    let mut query = Object::new("Query");
    let mut mutation = Object::new("Mutation");

    for table_row in table_rows {
        let table_name: String = table_row.get("table_name");
        validate_identifier(&table_name)?;

        let type_name = to_pascal_case(&table_name);
        let object = build_object_type(&type_name, table_columns.get(&table_name));
        schema_builder = schema_builder.register(object);

        let pool_for_list = pool.clone();
        let schema_for_list = schema_name.to_string();
        let table_for_list = table_name.clone();
        let type_for_list = type_name.clone();
        let list_field_name = format!("{}List", type_name);

        query = query.field(
            Field::new(
                list_field_name,
                TypeRef::named_nn_list(type_for_list),
                move |ctx| {
                    let pool = pool_for_list.clone();
                    let schema = schema_for_list.clone();
                    let table = table_for_list.clone();
                    FieldFuture::new(async move { list_rows_resolver(ctx, pool, &schema, &table).await })
                },
            )
            .argument(InputValue::new("limit", TypeRef::named(TypeRef::INT)))
            .argument(InputValue::new("offset", TypeRef::named(TypeRef::INT))),
        );

        let pool_for_insert = pool.clone();
        let schema_for_insert = schema_name.to_string();
        let table_for_insert = table_name.clone();
        let insert_field_name = format!("insert{}", to_pascal_case(&table_name));

        mutation = mutation.field(
            Field::new(insert_field_name, TypeRef::named("JSON"), move |ctx| {
                let pool = pool_for_insert.clone();
                let schema = schema_for_insert.clone();
                let table = table_for_insert.clone();
                FieldFuture::new(async move { insert_row_resolver(ctx, pool, &schema, &table).await })
            })
            .argument(InputValue::new("input", TypeRef::named_nn("JSON"))),
        );

        let pool_for_delete = pool.clone();
        let schema_for_delete = schema_name.to_string();
        let table_for_delete = table_name.clone();
        let delete_field_name = format!("delete{}", to_pascal_case(&table_name));

        mutation = mutation.field(
            Field::new(
                delete_field_name,
                TypeRef::named_nn(TypeRef::BOOLEAN),
                move |ctx| {
                    let pool = pool_for_delete.clone();
                    let schema = schema_for_delete.clone();
                    let table = table_for_delete.clone();
                    FieldFuture::new(async move { delete_row_resolver(ctx, pool, &schema, &table).await })
                },
            )
            .argument(InputValue::new("id", TypeRef::named_nn(TypeRef::ID))),
        );
    }

    schema_builder
        .register(query)
        .register(mutation)
        .finish()
        .map_err(|e| Error::new(e.to_string()))
}

fn build_object_type(type_name: &str, columns: Option<&Vec<ColumnInfo>>) -> Object {
    let mut object = Object::new(type_name);
    if let Some(cols) = columns {
        for col in cols {
            let field_name = col.name.clone();
            let column_name = col.name.clone();
            let gql_type = pg_type_to_graphql(&col.data_type);
            let type_ref = if col.nullable {
                TypeRef::named(gql_type)
            } else {
                TypeRef::named_nn(gql_type)
            };
            object = object.field(Field::new(field_name, type_ref, move |ctx| {
                let col = column_name.clone();
                FieldFuture::new(async move {
                    let parent = ctx.parent_value.try_downcast_ref::<serde_json::Value>()?;
                    let value = parent.get(&col).cloned().unwrap_or(serde_json::Value::Null);
                    Ok(Some(json_to_value(value)))
                })
            }));
        }
    }
    object
}

async fn list_rows_resolver(
    ctx: ResolverContext<'_>,
    pool: PgPool,
    schema: &str,
    table: &str,
) -> Result<Option<Value>, Error> {
    let limit = ctx
        .args
        .get("limit")
        .and_then(|v| v.i64().ok())
        .unwrap_or(50)
        .clamp(1, 1000);
    let offset = ctx
        .args
        .get("offset")
        .and_then(|v| v.i64().ok())
        .unwrap_or(0)
        .max(0);

    let sql = format!(
        "SELECT row_to_json(t) AS row FROM (SELECT * FROM {schema}.{table} LIMIT $1 OFFSET $2) t"
    );

    let rows = sqlx::query(&sql)
        .bind(limit)
        .bind(offset)
        .fetch_all(&pool)
        .await
        .map_err(|e| Error::new(e.to_string()))?;

    let values = rows
        .into_iter()
        .map(|row| row.get::<serde_json::Value, _>("row"))
        .map(json_to_value)
        .collect::<Vec<_>>();
    Ok(Some(Value::List(values)))
}

async fn insert_row_resolver(
    ctx: ResolverContext<'_>,
    pool: PgPool,
    schema: &str,
    table: &str,
) -> Result<Option<Value>, Error> {
    let input = ctx
        .args
        .get("input")
        .ok_or_else(|| Error::new("input is required"))?;
    let json_input: serde_json::Value = input
        .deserialize()
        .map_err(|_| Error::new("input must be valid JSON"))?;

    let sql = format!(
        "WITH ins AS (INSERT INTO {schema}.{table} SELECT * FROM jsonb_populate_record(NULL::{schema}.{table}, $1::jsonb) RETURNING *) SELECT row_to_json(ins) AS row FROM ins"
    );

    let row = sqlx::query(&sql)
        .bind(json_input)
        .fetch_one(&pool)
        .await
        .map_err(|e| Error::new(e.to_string()))?;
    let value: serde_json::Value = row.get("row");
    Ok(Some(json_to_value(value)))
}

async fn delete_row_resolver(
    ctx: ResolverContext<'_>,
    pool: PgPool,
    schema: &str,
    table: &str,
) -> Result<Option<Value>, Error> {
    let id = ctx
        .args
        .get("id")
        .and_then(|v| v.string().ok())
        .ok_or_else(|| Error::new("id is required"))?;

    let sql = format!("DELETE FROM {schema}.{table} WHERE id::text = $1");
    let result = sqlx::query(&sql)
        .bind(id)
        .execute(&pool)
        .await
        .map_err(|e| Error::new(e.to_string()))?;
    Ok(Some(Value::from(result.rows_affected() > 0)))
}

fn pg_type_to_graphql(pg_type: &str) -> &'static str {
    match pg_type {
        "integer" | "bigint" | "smallint" => TypeRef::INT,
        "numeric" | "decimal" | "real" | "double precision" => TypeRef::FLOAT,
        "boolean" => TypeRef::BOOLEAN,
        "uuid" => TypeRef::ID,
        "jsonb" | "json" => "JSON",
        _ => TypeRef::STRING,
    }
}

fn to_pascal_case(s: &str) -> String {
    s.split('_')
        .map(|part| {
            let mut chars = part.chars();
            match chars.next() {
                None => String::new(),
                Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
            }
        })
        .collect()
}

fn json_to_value(v: serde_json::Value) -> Value {
    match v {
        serde_json::Value::Null => Value::Null,
        serde_json::Value::Bool(b) => Value::from(b),
        serde_json::Value::Number(n) => {
            if let Some(i) = n.as_i64() {
                Value::from(i)
            } else if let Some(f) = n.as_f64() {
                Value::from(f)
            } else {
                Value::Null
            }
        }
        serde_json::Value::String(s) => Value::from(s),
        serde_json::Value::Array(arr) => {
            Value::List(arr.into_iter().map(json_to_value).collect::<Vec<_>>())
        }
        serde_json::Value::Object(obj) => Value::from(json!(obj).to_string()),
    }
}

fn validate_identifier(name: &str) -> Result<&str, Error> {
    let starts_valid = name
        .chars()
        .next()
        .map(|c| c.is_ascii_alphabetic() || c == '_')
        .unwrap_or(false);
    let valid = starts_valid && name.chars().all(|c| c.is_ascii_alphanumeric() || c == '_');
    if !valid || name.is_empty() || name.len() > 63 {
        return Err(Error::new("Invalid identifier"));
    }
    Ok(name)
}
