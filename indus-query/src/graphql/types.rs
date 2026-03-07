use async_graphql::*;
use serde_json::Value;
use std::collections::HashMap;

#[derive(SimpleObject, Clone)]
pub struct DynamicRow {
    pub data: Json<HashMap<String, Value>>,
}

#[derive(SimpleObject)]
pub struct PageInfo {
    pub total_count: i64,
    pub has_next_page: bool,
    pub has_prev_page: bool,
}

#[derive(SimpleObject)]
pub struct TableConnection {
    pub nodes: Vec<DynamicRow>,
    pub page_info: PageInfo,
}

#[derive(InputObject)]
pub struct TableFilter {
    pub column: String,
    pub operator: String,
    pub value: String,
}

#[derive(InputObject)]
pub struct TableOrder {
    pub column: String,
    pub direction: Option<String>,
}

#[derive(InputObject)]
pub struct RowInput {
    pub data: Json<HashMap<String, Value>>,
}
