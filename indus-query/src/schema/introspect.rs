use crate::errors::AppError;
use crate::schema::types::{ColumnMeta, ForeignKey, PgType, SchemaInfo, TableMeta};
use sqlx::{PgPool, Row};
use tracing::{debug, error, info};

pub struct SchemaIntrospector;

impl SchemaIntrospector {
    pub fn new() -> Self {
        Self
    }

    pub async fn introspect(&self, pool: &PgPool) -> Result<SchemaInfo, AppError> {
        info!("Starting schema introspection");
        let mut schema_info = SchemaInfo::new();

        let tables = self.fetch_tables(pool).await?;
        info!("Found {} tables", tables.len());

        for table in tables {
            debug!("Introspecting table: {}.{}", table.schema, table.name);
            
            let columns = self.fetch_columns(pool, &table.schema, &table.name).await?;
            let primary_keys = self
                .fetch_primary_keys(pool, &table.schema, &table.name)
                .await?;
            let foreign_keys = self
                .fetch_foreign_keys(pool, &table.schema, &table.name)
                .await?;
            let has_rls = self.check_rls_enabled(pool, &table.schema, &table.name).await?;

            // Merge foreign keys into columns
            let mut columns_with_fk: Vec<ColumnMeta> = columns
                .into_iter()
                .map(|mut col| {
                    if let Some(fk) = foreign_keys.get(&col.name) {
                        col.foreign_key = Some(fk.clone());
                    }
                    col.is_primary_key = primary_keys.contains(&col.name);
                    col
                })
                .collect();

            // Sort by ordinal position
            columns_with_fk.sort_by_key(|c| c.ordinal_position);

            let table_meta = TableMeta {
                schema_name: table.schema,
                table_name: table.name,
                columns: columns_with_fk,
                has_rls_enabled: has_rls,
                primary_keys,
            };

            schema_info.add_table(table_meta);
        }

        info!("Schema introspection completed");
        Ok(schema_info)
    }

    pub async fn introspect_schema(
        pool: &PgPool,
        schema: &str,
    ) -> Result<Vec<TableMeta>, AppError> {
        let introspector = Self::new();
        let tables = introspector.fetch_tables_for_schema(pool, schema).await?;
        let mut result = Vec::new();

        for table in tables {
            let columns = introspector.fetch_columns(pool, &table.schema, &table.name).await?;
            let primary_keys = introspector
                .fetch_primary_keys(pool, &table.schema, &table.name)
                .await?;
            let foreign_keys = introspector
                .fetch_foreign_keys(pool, &table.schema, &table.name)
                .await?;
            let has_rls = introspector
                .check_rls_enabled(pool, &table.schema, &table.name)
                .await?;

            let mut columns_with_fk: Vec<ColumnMeta> = columns
                .into_iter()
                .map(|mut col| {
                    if let Some(fk) = foreign_keys.get(&col.name) {
                        col.foreign_key = Some(fk.clone());
                    }
                    col.is_primary_key = primary_keys.contains(&col.name);
                    col
                })
                .collect();

            columns_with_fk.sort_by_key(|c| c.ordinal_position);

            result.push(TableMeta {
                schema_name: table.schema,
                table_name: table.name,
                columns: columns_with_fk,
                has_rls_enabled: has_rls,
                primary_keys,
            });
        }

        Ok(result)
    }

    async fn fetch_tables(&self, pool: &PgPool) -> Result<Vec<TableRow>, AppError> {
        let rows = sqlx::query(
            r#"
            SELECT 
                table_schema,
                table_name
            FROM information_schema.tables
            WHERE table_type = 'BASE TABLE'
                AND table_schema NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
            ORDER BY table_schema, table_name
            "#,
        )
        .fetch_all(pool)
        .await
        .map_err(AppError::DatabaseError)?;

        let tables = rows
            .iter()
            .map(|row| TableRow {
                schema: row.get("table_schema"),
                name: row.get("table_name"),
            })
            .collect();

        Ok(tables)
    }

    async fn fetch_tables_for_schema(
        &self,
        pool: &PgPool,
        schema: &str,
    ) -> Result<Vec<TableRow>, AppError> {
        let rows = sqlx::query(
            r#"
            SELECT 
                table_schema,
                table_name
            FROM information_schema.tables
            WHERE table_type = 'BASE TABLE'
                AND table_schema = $1
            ORDER BY table_name
            "#,
        )
        .bind(schema)
        .fetch_all(pool)
        .await
        .map_err(AppError::DatabaseError)?;

        let tables = rows
            .iter()
            .map(|row| TableRow {
                schema: row.get("table_schema"),
                name: row.get("table_name"),
            })
            .collect();

        Ok(tables)
    }

    async fn fetch_columns(
        &self,
        pool: &PgPool,
        schema: &str,
        table: &str,
    ) -> Result<Vec<ColumnMeta>, AppError> {
        let rows = sqlx::query(
            r#"
            SELECT 
                c.column_name,
                c.data_type,
                c.is_nullable,
                c.column_default,
                c.character_maximum_length,
                c.ordinal_position,
                CASE 
                    WHEN tc.constraint_type = 'UNIQUE' THEN true
                    ELSE false
                END as is_unique
            FROM information_schema.columns c
            LEFT JOIN information_schema.constraint_column_usage ccu
                ON c.table_schema = ccu.table_schema
                AND c.table_name = ccu.table_name
                AND c.column_name = ccu.column_name
            LEFT JOIN information_schema.table_constraints tc
                ON ccu.constraint_schema = tc.constraint_schema
                AND ccu.constraint_name = tc.constraint_name
                AND tc.constraint_type = 'UNIQUE'
            WHERE c.table_schema = $1
                AND c.table_name = $2
            ORDER BY c.ordinal_position
            "#,
        )
        .bind(schema)
        .bind(table)
        .fetch_all(pool)
        .await
        .map_err(AppError::DatabaseError)?;

        let columns = rows
            .iter()
            .map(|row| {
                let data_type_str: String = row.get("data_type");
                let is_nullable: String = row.get("is_nullable");
                let is_unique: bool = row.get("is_unique");

                ColumnMeta {
                    name: row.get("column_name"),
                    data_type: PgType::from(data_type_str.as_str()),
                    is_nullable: is_nullable == "YES",
                    is_primary_key: false, // Will be set later
                    default_value: row.get("column_default"),
                    max_length: row.get("character_maximum_length"),
                    ordinal_position: row.get("ordinal_position"),
                    is_unique,
                    foreign_key: None,
                }
            })
            .collect();

        Ok(columns)
    }

    async fn fetch_primary_keys(
        &self,
        pool: &PgPool,
        schema: &str,
        table: &str,
    ) -> Result<Vec<String>, AppError> {
        let rows = sqlx::query(
            r#"
            SELECT kcu.column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
            WHERE tc.constraint_type = 'PRIMARY KEY'
                AND tc.table_schema = $1
                AND tc.table_name = $2
            ORDER BY kcu.ordinal_position
            "#,
        )
        .bind(schema)
        .bind(table)
        .fetch_all(pool)
        .await
        .map_err(AppError::DatabaseError)?;

        let keys = rows
            .iter()
            .map(|row| row.get::<String, _>("column_name"))
            .collect();

        Ok(keys)
    }

    async fn fetch_foreign_keys(
        &self,
        pool: &PgPool,
        schema: &str,
        table: &str,
    ) -> Result<std::collections::HashMap<String, ForeignKey>, AppError> {
        let rows = sqlx::query(
            r#"
            SELECT
                kcu.column_name,
                ccu.table_schema AS foreign_table_schema,
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
                ON ccu.constraint_name = tc.constraint_name
                AND ccu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY'
                AND tc.table_schema = $1
                AND tc.table_name = $2
            "#,
        )
        .bind(schema)
        .bind(table)
        .fetch_all(pool)
        .await
        .map_err(AppError::DatabaseError)?;

        let mut fks = std::collections::HashMap::new();
        for row in rows {
            let fk = ForeignKey {
                column_name: row.get("column_name"),
                foreign_table_schema: row.get("foreign_table_schema"),
                foreign_table_name: row.get("foreign_table_name"),
                foreign_column_name: row.get("foreign_column_name"),
            };
            fks.insert(fk.column_name.clone(), fk);
        }

        Ok(fks)
    }

    async fn check_rls_enabled(
        &self,
        pool: &PgPool,
        schema: &str,
        table: &str,
    ) -> Result<bool, AppError> {
        let row = sqlx::query(
            r#"
            SELECT c.relrowsecurity as rls_enabled
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = $1
                AND c.relname = $2
                AND c.relkind = 'r'
            "#,
        )
        .bind(schema)
        .bind(table)
        .fetch_optional(pool)
        .await
        .map_err(AppError::DatabaseError)?;

        Ok(row.map(|r| r.get::<bool, _>("rls_enabled")).unwrap_or(false))
    }
}

impl Default for SchemaIntrospector {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Debug)]
struct TableRow {
    schema: String,
    name: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    // Note: These tests require a database connection
    // In a real scenario, you'd use test containers or mock the database

    #[tokio::test]
    async fn test_introspect_schema_integration() {
        // This is a placeholder for integration tests
        // Would require a test database to be running
    }
}
