use crate::errors::AppError;
use crate::schema::introspect::SchemaIntrospector;
use crate::schema::types::{SchemaInfo, TableMeta};
use sqlx::PgPool;
use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use std::time::{Duration, Instant};
use tokio::time::interval;
use tracing::{debug, error, info, warn};

pub struct SchemaCache {
    cache: Arc<RwLock<HashMap<String, Vec<TableMeta>>>>,
    pool: PgPool,
    allowed_schemas: Vec<String>,
    refresh_secs: u64,
    last_updated: Arc<RwLock<Option<Instant>>>,
}

impl SchemaCache {
    pub fn new(
        pool: PgPool,
        allowed_schemas: Vec<String>,
        refresh_secs: u64,
    ) -> Self {
        Self {
            cache: Arc::new(RwLock::new(HashMap::new())),
            pool,
            allowed_schemas,
            refresh_secs,
            last_updated: Arc::new(RwLock::new(None)),
        }
    }

    pub fn start_refresh_loop(&self) {
        let cache = self.cache.clone();
        let pool = self.pool.clone();
        let allowed_schemas = self.allowed_schemas.clone();
        let refresh_secs = self.refresh_secs;
        let last_updated = self.last_updated.clone();

        tokio::spawn(async move {
            let mut ticker = interval(Duration::from_secs(refresh_secs));
            
            info!("Schema cache refresh loop started (interval: {}s)", refresh_secs);

            loop {
                ticker.tick().await;
                
                debug!("Refreshing schema cache...");
                match refresh_schemas(&pool, &allowed_schemas).await {
                    Ok(new_cache) => {
                        match cache.write() {
                            Ok(mut guard) => {
                                *guard = new_cache;
                                info!("Schema cache refreshed successfully");
                            }
                            Err(e) => {
                                error!("Failed to acquire write lock for schema cache: {}", e);
                                continue;
                            }
                        }
                        
                        match last_updated.write() {
                            Ok(mut guard) => {
                                *guard = Some(Instant::now());
                            }
                            Err(e) => {
                                warn!("Failed to update last_updated timestamp: {}", e);
                            }
                        }
                    }
                    Err(e) => {
                        error!("Failed to refresh schema cache: {}", e);
                    }
                }
            }
        });
    }

    pub async fn refresh(&self) -> Result<(), AppError> {
        debug!("Manually refreshing schema cache");
        
        let new_cache = refresh_schemas(&self.pool, &self.allowed_schemas).await?;
        
        match self.cache.write() {
            Ok(mut guard) => {
                *guard = new_cache;
                info!("Schema cache manually refreshed");
            }
            Err(e) => {
                error!("Failed to acquire write lock for schema cache: {}", e);
                return Err(AppError::InternalError(
                    "Failed to update schema cache".to_string(),
                ));
            }
        }

        match self.last_updated.write() {
            Ok(mut guard) => {
                *guard = Some(Instant::now());
            }
            Err(e) => {
                warn!("Failed to update last_updated timestamp: {}", e);
            }
        }

        Ok(())
    }

    pub fn get_table(&self, schema: &str, table: &str) -> Option<TableMeta> {
        let cache = self.cache.read().ok()?;
        cache.get(schema)?.iter().find(|t| t.table_name == table).cloned()
    }

    pub fn get_schema(&self, schema: &str) -> Option<Vec<TableMeta>> {
        let cache = self.cache.read().ok()?;
        cache.get(schema).cloned()
    }

    pub fn get_all_tables(&self) -> Vec<TableMeta> {
        let cache = match self.cache.read() {
            Ok(guard) => guard,
            Err(_) => return Vec::new(),
        };
        
        cache.values().flatten().cloned().collect()
    }

    pub fn is_fresh(&self) -> bool {
        match self.last_updated.read() {
            Ok(guard) => {
                guard.map(|t| t.elapsed() < Duration::from_secs(self.refresh_secs))
                    .unwrap_or(false)
            }
            Err(_) => false,
        }
    }

    pub fn invalidate(&self) {
        match self.cache.write() {
            Ok(mut guard) => {
                guard.clear();
                info!("Schema cache invalidated");
            }
            Err(e) => {
                error!("Failed to invalidate schema cache: {}", e);
            }
        }

        match self.last_updated.write() {
            Ok(mut guard) => {
                *guard = None;
            }
            Err(e) => {
                warn!("Failed to clear last_updated timestamp: {}", e);
            }
        }
    }

    /// Legacy method for backwards compatibility
    pub fn get(&self) -> Option<SchemaInfo> {
        let tables = self.get_all_tables();
        if tables.is_empty() {
            return None;
        }

        let mut info = SchemaInfo::new();
        for table in tables {
            info.add_table(table);
        }
        Some(info)
    }

    /// Legacy method for backwards compatibility
    pub fn set(&self, schema_info: SchemaInfo) {
        match self.cache.write() {
            Ok(mut guard) => {
                guard.clear();
                for (_, table) in schema_info.tables {
                    let key = table.schema_name.clone();
                    guard.entry(key).or_insert_with(Vec::new).push(table);
                }
                debug!("Schema cache updated via set()");
            }
            Err(e) => {
                warn!("Failed to set schema cache: {}", e);
            }
        }

        match self.last_updated.write() {
            Ok(mut guard) => {
                *guard = Some(Instant::now());
            }
            Err(e) => {
                warn!("Failed to update last_updated timestamp: {}", e);
            }
        }
    }
}

async fn refresh_schemas(
    pool: &PgPool,
    allowed_schemas: &[String],
) -> Result<HashMap<String, Vec<TableMeta>>, AppError> {
    let mut cache = HashMap::new();

    for schema in allowed_schemas {
        debug!("Introspecting schema: {}", schema);
        match SchemaIntrospector::introspect_schema(pool, schema).await {
            Ok(tables) => {
                if !tables.is_empty() {
                    debug!("Found {} tables in schema {}", tables.len(), schema);
                    cache.insert(schema.clone(), tables);
                }
            }
            Err(e) => {
                warn!("Failed to introspect schema {}: {}", schema, e);
                // Continue with other schemas even if one fails
            }
        }
    }

    Ok(cache)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::schema::types::{ColumnMeta, PgType};

    fn create_test_table(name: &str) -> TableMeta {
        TableMeta {
            schema_name: "public".to_string(),
            table_name: name.to_string(),
            columns: vec![ColumnMeta {
                name: "id".to_string(),
                data_type: PgType::Int4,
                is_nullable: false,
                is_primary_key: true,
                default_value: None,
                max_length: None,
                ordinal_position: 1,
                is_unique: true,
                foreign_key: None,
            }],
            has_rls_enabled: false,
            primary_keys: vec!["id".to_string()],
        }
    }

    #[test]
    fn test_cache_get_table() {
        // This would require a real database connection to test properly
        // For now, we just verify the structure compiles
    }
}
