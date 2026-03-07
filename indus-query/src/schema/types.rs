use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum PgType {
    Bool,
    Int2,
    Int4,
    Int8,
    Float4,
    Float8,
    Numeric,
    Char,
    Varchar,
    Text,
    Bytea,
    Timestamp,
    Timestamptz,
    Date,
    Time,
    Timetz,
    Interval,
    Uuid,
    Json,
    Jsonb,
    Array(Box<PgType>),
    Unknown(String),
}

impl From<&str> for PgType {
    fn from(type_str: &str) -> Self {
        match type_str.to_lowercase().as_str() {
            "bool" | "boolean" => PgType::Bool,
            "int2" | "smallint" => PgType::Int2,
            "int4" | "integer" | "int" => PgType::Int4,
            "int8" | "bigint" => PgType::Int8,
            "float4" | "real" => PgType::Float4,
            "float8" | "double precision" => PgType::Float8,
            "numeric" | "decimal" => PgType::Numeric,
            "char" | "character" => PgType::Char,
            "varchar" | "character varying" => PgType::Varchar,
            "text" => PgType::Text,
            "bytea" => PgType::Bytea,
            "timestamp" | "timestamp without time zone" => PgType::Timestamp,
            "timestamptz" | "timestamp with time zone" => PgType::Timestamptz,
            "date" => PgType::Date,
            "time" | "time without time zone" => PgType::Time,
            "timetz" | "time with time zone" => PgType::Timetz,
            "interval" => PgType::Interval,
            "uuid" => PgType::Uuid,
            "json" => PgType::Json,
            "jsonb" => PgType::Jsonb,
            _ => {
                // Check for array types
                if type_str.starts_with("_") {
                    let inner = &type_str[1..];
                    return PgType::Array(Box::new(PgType::from(inner)));
                }
                PgType::Unknown(type_str.to_string())
            }
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ForeignKey {
    pub column_name: String,
    pub foreign_table_schema: String,
    pub foreign_table_name: String,
    pub foreign_column_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColumnMeta {
    pub name: String,
    pub data_type: PgType,
    pub is_nullable: bool,
    pub is_primary_key: bool,
    pub default_value: Option<String>,
    pub max_length: Option<i32>,
    pub ordinal_position: i32,
    pub is_unique: bool,
    pub foreign_key: Option<ForeignKey>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TableMeta {
    pub schema_name: String,
    pub table_name: String,
    pub columns: Vec<ColumnMeta>,
    pub has_rls_enabled: bool,
    pub primary_keys: Vec<String>,
}

impl TableMeta {
    pub fn get_column(&self, name: &str) -> Option<&ColumnMeta> {
        self.columns.iter().find(|c| c.name == name)
    }

    pub fn get_primary_key_columns(&self) -> Vec<&ColumnMeta> {
        self.columns
            .iter()
            .filter(|c| c.is_primary_key)
            .collect()
    }
}

#[derive(Debug, Clone, Default)]
pub struct SchemaInfo {
    pub tables: HashMap<String, TableMeta>,
}

impl SchemaInfo {
    pub fn new() -> Self {
        Self {
            tables: HashMap::new(),
        }
    }

    pub fn add_table(&mut self, table: TableMeta) {
        let key = format!("{}.{}", table.schema_name, table.table_name);
        self.tables.insert(key, table);
    }

    pub fn get_table(&self, schema: &str, table: &str) -> Option<&TableMeta> {
        let key = format!("{}.{}", schema, table);
        self.tables.get(&key)
    }

    pub fn get_tables_in_schema(&self, schema: &str) -> Vec<&TableMeta> {
        self.tables
            .values()
            .filter(|t| t.schema_name == schema)
            .collect()
    }
}

// Legacy alias for backwards compatibility
pub use PgType as PostgresType;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pg_type_from_str() {
        assert!(matches!(PgType::from("int4"), PgType::Int4));
        assert!(matches!(PgType::from("text"), PgType::Text));
        assert!(matches!(PgType::from("bool"), PgType::Bool));
        assert!(matches!(PgType::from("jsonb"), PgType::Jsonb));
    }

    #[test]
    fn test_pg_type_array() {
        let arr = PgType::from("_int4");
        assert!(matches!(arr, PgType::Array(inner) if matches!(inner.as_ref(), PgType::Int4)));
    }

    #[test]
    fn test_table_meta_get_column() {
        let table = TableMeta {
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
            ],
            has_rls_enabled: false,
            primary_keys: vec!["id".to_string()],
        };

        assert!(table.get_column("id").is_some());
        assert!(table.get_column("name").is_some());
        assert!(table.get_column("nonexistent").is_none());
    }

    #[test]
    fn test_schema_info() {
        let mut info = SchemaInfo::new();
        let table = TableMeta {
            schema_name: "public".to_string(),
            table_name: "users".to_string(),
            columns: vec![],
            has_rls_enabled: false,
            primary_keys: vec![],
        };

        info.add_table(table);
        assert!(info.get_table("public", "users").is_some());
        assert!(info.get_table("public", "posts").is_none());
    }
}
