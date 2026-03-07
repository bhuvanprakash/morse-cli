use async_graphql::{EmptySubscription, Schema};
use sqlx::PgPool;

use crate::graphql::resolver::{MutationRoot, QueryRoot};

pub type AppSchema = Schema<QueryRoot, MutationRoot, EmptySubscription>;

pub fn build_schema(pool: PgPool) -> AppSchema {
    Schema::build(
        QueryRoot { pool: pool.clone() },
        MutationRoot { pool: pool.clone() },
        EmptySubscription,
    )
    .finish()
}
