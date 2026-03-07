use crate::auth::jwt::Claims;
use crate::errors::AppError;
use anyhow::Result;
use sqlx::{PgConnection, PgPool, Postgres, Transaction};
use std::mem;
use tracing::debug;

/// RLS (Row Level Security) helper for PostgreSQL
pub struct RlsContext;

impl RlsContext {
    /// Set the current database role for RLS
    pub async fn set_role<'a>(
        tx: &mut Transaction<'a, Postgres>,
        role: &str,
    ) -> Result<()> {
        let query = format!("SET LOCAL ROLE '{}'", sanitize_identifier(role));
        sqlx::query(&query).execute(&mut **tx).await?;
        debug!("Set database role to: {}", role);
        Ok(())
    }

    /// Reset role to default
    pub async fn reset_role<'a>(tx: &mut Transaction<'a, Postgres>) -> Result<()> {
        sqlx::query("SET LOCAL ROLE NONE")
            .execute(&mut **tx)
            .await?;
        debug!("Reset database role");
        Ok(())
    }

    /// Set JWT claims as local configuration parameters for RLS
    pub async fn set_jwt_claims<'a>(
        tx: &mut Transaction<'a, Postgres>,
        claims: &Claims,
    ) -> Result<()> {
        let claims_json = serde_json::to_string(claims)?;
        let query = format!(
            "SET LOCAL request.jwt.claims = '{}'",
            escape_sql_string(&claims_json)
        );
        sqlx::query(&query).execute(&mut **tx).await?;
        debug!("Set JWT claims for RLS");
        Ok(())
    }

    /// Set a specific claim value
    pub async fn set_claim<'a>(
        tx: &mut Transaction<'a, Postgres>,
        key: &str,
        value: &str,
    ) -> Result<()> {
        let query = format!(
            "SET LOCAL request.jwt.claim.{} = '{}'",
            sanitize_identifier(key),
            escape_sql_string(value)
        );
        sqlx::query(&query).execute(&mut **tx).await?;
        Ok(())
    }

    /// Set the user ID claim
    pub async fn set_user_id<'a>(
        tx: &mut Transaction<'a, Postgres>,
        user_id: &str,
    ) -> Result<()> {
        Self::set_claim(tx, "sub", user_id).await
    }

    /// Set the role from claims
    pub async fn set_jwt_role<'a>(
        tx: &mut Transaction<'a, Postgres>,
        role: &str,
    ) -> Result<()> {
        Self::set_claim(tx, "role", role).await
    }

    /// Configure RLS context for a request
    /// Sets: role, request.jwt.claims, request.jwt.sub, request.jwt.role
    pub async fn configure_for_request<'a>(
        tx: &mut Transaction<'a, Postgres>,
        claims: Option<&Claims>,
        role: Option<&str>,
    ) -> Result<()> {
        // Set the role first (default to 'anon' if no role specified)
        let role = role.unwrap_or("anon");
        Self::set_role(tx, role).await?;

        // Set JWT claims if available
        if let Some(claims) = claims {
            // Set the full claims JSON
            Self::set_jwt_claims(tx, claims).await?;
            
            // Set individual claim values for convenience
            Self::set_user_id(tx, &claims.sub).await?;
            
            if let Some(ref role) = claims.role {
                Self::set_jwt_role(tx, role).await?;
            }
            
            // Set email if available
            if let Some(ref email) = claims.email {
                Self::set_claim(tx, "email", email).await?;
            }
        }

        Ok(())
    }

    /// Set RLS context on a connection (not just a transaction)
    pub async fn set_rls_context(
        conn: &mut PgConnection,
        claims: &Claims,
    ) -> Result<(), AppError> {
        // Set role from claims or default to 'authenticated'
        let role = claims.role.as_deref().unwrap_or("authenticated");
        
        let role_query = format!("SET LOCAL ROLE '{}'", sanitize_identifier(role));
        sqlx::query(&role_query)
            .execute(&mut *conn)
            .await
            .map_err(|e| AppError::DatabaseError(e))?;

        // Set JWT claims JSON
        let claims_json = serde_json::to_string(claims)
            .map_err(|e| AppError::InternalError(format!("Failed to serialize claims: {}", e)))?;
        
        let claims_query = format!(
            "SET LOCAL request.jwt.claims = '{}'",
            escape_sql_string(&claims_json)
        );
        sqlx::query(&claims_query)
            .execute(&mut *conn)
            .await
            .map_err(|e| AppError::DatabaseError(e))?;

        // Set individual claims
        let sub_query = format!(
            "SET LOCAL request.jwt.sub = '{}'",
            escape_sql_string(&claims.sub)
        );
        sqlx::query(&sub_query)
            .execute(&mut *conn)
            .await
            .map_err(|e| AppError::DatabaseError(e))?;

        if let Some(ref role) = claims.role {
            let role_claim_query = format!(
                "SET LOCAL request.jwt.role = '{}'",
                escape_sql_string(role)
            );
            sqlx::query(&role_claim_query)
                .execute(&mut *conn)
                .await
                .map_err(|e| AppError::DatabaseError(e))?;
        }

        debug!("Set RLS context for user: {}", claims.sub);
        Ok(())
    }
}

/// Execute a query within an RLS context
pub async fn with_rls_context<F, T>(
    pool: &PgPool,
    claims: Option<&Claims>,
    role: Option<&str>,
    f: F,
) -> Result<T, AppError>
where
    T: Send + 'static,
    F: for<'a> FnOnce(&'a mut Transaction<'static, Postgres>) -> futures::future::BoxFuture<'a, Result<T, anyhow::Error>>,
{
    let mut tx = pool.begin().await.map_err(AppError::DatabaseError)?;
    let mut tx: Transaction<'static, Postgres> = unsafe { mem::transmute(tx) };

    // Configure RLS context
    RlsContext::configure_for_request(&mut tx, claims, role)
        .await
        .map_err(|e| AppError::InternalError(format!("Failed to configure RLS: {}", e)))?;

    // Execute the function inside the transaction
    let res = f(&mut tx)
        .await
        .map_err(|e| AppError::InternalError(e.to_string()))?;

    tx.commit().await.map_err(AppError::DatabaseError)?;

    Ok(res)
}

/// Sanitize SQL identifiers (table names, column names, etc.)
fn sanitize_identifier(ident: &str) -> String {
    // Only allow alphanumeric characters and underscores
    ident
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '_')
        .collect()
}

/// Escape SQL string literals
fn escape_sql_string(s: &str) -> String {
    s.replace('\\', "\\\\").replace('\'', "''")
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    fn create_test_claims(sub: &str, role: &str) -> Claims {
        let mut extra = HashMap::new();
        extra.insert("role".to_string(), serde_json::json!(role));

        Claims {
            sub: sub.to_string(),
            email: Some("test@example.com".to_string()),
            role: Some(role.to_string()),
            iss: "test".to_string(),
            aud: "test".to_string(),
            exp: 9999999999,
            iat: 0,
            extra,
        }
    }

    #[test]
    fn test_sanitize_identifier() {
        assert_eq!(sanitize_identifier("users"), "users");
        assert_eq!(sanitize_identifier("user_name"), "user_name");
        assert_eq!(sanitize_identifier("user; DROP TABLE users;"), "userDROPTABLEusers");
        assert_eq!(sanitize_identifier("public.users"), "publicusers");
    }

    #[test]
    fn test_escape_sql_string() {
        assert_eq!(escape_sql_string("hello"), "hello");
        assert_eq!(escape_sql_string("it's"), "it''s");
        assert_eq!(escape_sql_string("back\\slash"), "back\\\\slash");
    }
}
