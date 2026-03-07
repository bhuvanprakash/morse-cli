use anyhow::Result;
use sqlx::postgres::{PgPool, PgPoolOptions};
use std::time::Duration;
use tracing::info;

/// Create a PostgreSQL connection pool
pub async fn create_pool(database_url: &str) -> Result<PgPool> {
    let pool = PgPoolOptions::new()
        .max_connections(10)
        .min_connections(2)
        .acquire_timeout(Duration::from_secs(5))
        .idle_timeout(Duration::from_secs(300))
        .max_lifetime(Duration::from_secs(1800))
        .test_before_acquire(true)
        .connect(database_url)
        .await?;

    info!("Database pool created with 10 max connections");
    Ok(pool)
}

/// Create a PostgreSQL connection pool with custom options
pub async fn create_pool_with_options(
    database_url: &str,
    max_connections: u32,
    min_connections: u32,
) -> Result<PgPool> {
    let pool = PgPoolOptions::new()
        .max_connections(max_connections)
        .min_connections(min_connections)
        .acquire_timeout(Duration::from_secs(5))
        .idle_timeout(Duration::from_secs(300))
        .max_lifetime(Duration::from_secs(1800))
        .test_before_acquire(true)
        .connect(database_url)
        .await?;

    info!("Database pool created with {} max connections", max_connections);
    Ok(pool)
}

/// Health check the database pool
pub async fn health_check(pool: &PgPool) -> Result<bool> {
    let row: (i64,) = sqlx::query_as("SELECT 1")
        .fetch_one(pool)
        .await?;
    Ok(row.0 == 1)
}

/// Close the database pool gracefully
pub async fn close_pool(pool: PgPool) {
    pool.close().await;
    info!("Database pool closed");
}

/// Get pool statistics
pub fn pool_stats(pool: &PgPool) -> PoolStats {
    let size = pool.size() as u32;
    let num_idle = pool.num_idle() as u32;
    let active = size.saturating_sub(num_idle);
    
    PoolStats {
        connections: size,
        idle_connections: num_idle,
        active_connections: active,
    }
}

#[derive(Debug, Clone, Copy)]
pub struct PoolStats {
    pub connections: u32,
    pub idle_connections: u32,
    pub active_connections: u32,
}

#[cfg(test)]
mod tests {
    use super::*;

    // Note: These tests require a database connection
    // In a real scenario, you'd use test containers or mock the database

    #[tokio::test]
    async fn test_pool_stats() {
        // This is a placeholder for integration tests
        // Would require a test database to be running
    }
}
