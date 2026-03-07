use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Filter {
    pub field: String,
    pub operator: FilterOperator,
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum FilterOperator {
    Eq,
    Neq,
    Gt,
    Gte,
    Lt,
    Lte,
    Like,
    Ilike,
    In,
    IsNull,
    IsNotNull,
}

impl From<&str> for FilterOperator {
    fn from(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "eq" | "=" => FilterOperator::Eq,
            "neq" | "!=" | "<>" => FilterOperator::Neq,
            "gt" | ">" => FilterOperator::Gt,
            "gte" | ">=" => FilterOperator::Gte,
            "lt" | "<" => FilterOperator::Lt,
            "lte" | "<=" => FilterOperator::Lte,
            "like" => FilterOperator::Like,
            "ilike" => FilterOperator::Ilike,
            "in" => FilterOperator::In,
            "isnull" | "is.null" => FilterOperator::IsNull,
            "isnotnull" | "not.is.null" => FilterOperator::IsNotNull,
            _ => FilterOperator::Eq,
        }
    }
}

impl FilterOperator {
    pub fn to_sql(&self) -> &'static str {
        match self {
            FilterOperator::Eq => "=",
            FilterOperator::Neq => "!=",
            FilterOperator::Gt => ">",
            FilterOperator::Gte => ">=",
            FilterOperator::Lt => "<",
            FilterOperator::Lte => "<=",
            FilterOperator::Like => "LIKE",
            FilterOperator::Ilike => "ILIKE",
            FilterOperator::In => "IN",
            FilterOperator::IsNull => "IS NULL",
            FilterOperator::IsNotNull => "IS NOT NULL",
        }
    }
}

#[derive(Debug, Clone)]
pub struct OrderBy {
    pub field: String,
    pub direction: OrderDirection,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum OrderDirection {
    Asc,
    Desc,
}

impl From<&str> for OrderDirection {
    fn from(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "desc" => OrderDirection::Desc,
            _ => OrderDirection::Asc,
        }
    }
}

impl OrderDirection {
    pub fn to_sql(&self) -> &'static str {
        match self {
            OrderDirection::Asc => "ASC",
            OrderDirection::Desc => "DESC",
        }
    }
}

#[derive(Debug, Clone, Default)]
pub struct QueryParams {
    pub select: Vec<String>,
    pub filters: Vec<Filter>,
    pub order_by: Vec<OrderBy>,
    pub page: Option<u32>,
    pub limit: Option<u32>,
    pub offset: Option<u32>,
}

impl QueryParams {
    pub fn limit_or_default(&self, default: u32) -> u32 {
        self.limit.unwrap_or(default).min(1000) // Max 1000 rows per request
    }

    pub fn offset_or_default(&self) -> u32 {
        self.offset.or_else(|| {
            self.page.map(|p| (p.saturating_sub(1)) * self.limit.unwrap_or(20))
        }).unwrap_or(0)
    }
}

/// Parse query parameters into a structured QueryParams
/// Supports:
/// - select=col1,col2 → selected_columns
/// - {column}=eq.{value} → conditions
/// - order={column}.{asc|desc}
/// - limit={n}, offset={n}, page={n}
pub fn parse_query_params(params: &HashMap<String, String>) -> QueryParams {
    let mut result = QueryParams::default();

    for (key, value) in params {
        match key.as_str() {
            "select" => {
                result.select = value.split(',').map(|s| s.trim().to_string()).collect();
            }
            "order" => {
                // Format: order=column.asc or order=column.desc
                let parts: Vec<&str> = value.split('.').collect();
                if parts.len() >= 1 {
                    let field = parts[0].to_string();
                    let direction = parts.get(1).map(|&d| OrderDirection::from(d)).unwrap_or(OrderDirection::Asc);
                    result.order_by.push(OrderBy { field, direction });
                }
            }
            "limit" => {
                result.limit = value.parse().ok();
            }
            "offset" => {
                result.offset = value.parse().ok();
            }
            "page" => {
                result.page = value.parse().ok();
            }
            _ => {
                // Try to parse as a filter: key=operator.value
                if let Some(filter) = parse_filter(key, value) {
                    result.filters.push(filter);
                }
            }
        }
    }

    result
}

/// Parse a filter from a key-value pair
/// Format: column=operator.value or just column=value (defaults to eq)
pub fn parse_filter(column: &str, value: &str) -> Option<Filter> {
    // Check if value contains an operator
    let (operator, actual_value) = if let Some(pos) = value.find('.') {
        let (op_str, val) = value.split_at(pos);
        (FilterOperator::from(op_str), val[1..].to_string())
    } else {
        (FilterOperator::Eq, value.to_string())
    };

    Some(Filter {
        field: column.to_string(),
        operator,
        value: actual_value,
    })
}

/// Represents a complete filter set for a query
#[derive(Debug, Clone, Default)]
pub struct FilterSet {
    pub selected_columns: Vec<String>,
    pub conditions: Vec<Condition>,
    pub order: Option<(String, OrderDirection)>,
    pub limit: Option<u32>,
    pub offset: Option<u32>,
}

#[derive(Debug, Clone)]
pub struct Condition {
    pub column: String,
    pub operator: FilterOperator,
    pub value: String,
}

impl FilterSet {
    pub fn from_query_params(params: &QueryParams) -> Self {
        let conditions = params.filters.iter().map(|f| Condition {
            column: f.field.clone(),
            operator: f.operator.clone(),
            value: f.value.clone(),
        }).collect();

        let order = params.order_by.first().map(|o| (o.field.clone(), o.direction.clone()));

        Self {
            selected_columns: params.select.clone(),
            conditions,
            order,
            limit: params.limit,
            offset: params.offset,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_filter_operator_from_str() {
        assert_eq!(FilterOperator::from("eq"), FilterOperator::Eq);
        assert_eq!(FilterOperator::from("="), FilterOperator::Eq);
        assert_eq!(FilterOperator::from("neq"), FilterOperator::Neq);
        assert_eq!(FilterOperator::from("gt"), FilterOperator::Gt);
        assert_eq!(FilterOperator::from("gte"), FilterOperator::Gte);
        assert_eq!(FilterOperator::from("lt"), FilterOperator::Lt);
        assert_eq!(FilterOperator::from("lte"), FilterOperator::Lte);
        assert_eq!(FilterOperator::from("like"), FilterOperator::Like);
        assert_eq!(FilterOperator::from("ilike"), FilterOperator::Ilike);
        assert_eq!(FilterOperator::from("in"), FilterOperator::In);
        assert_eq!(FilterOperator::from("isnull"), FilterOperator::IsNull);
        assert_eq!(FilterOperator::from("isnotnull"), FilterOperator::IsNotNull);
    }

    #[test]
    fn test_order_direction_from_str() {
        assert_eq!(OrderDirection::from("asc"), OrderDirection::Asc);
        assert_eq!(OrderDirection::from("desc"), OrderDirection::Desc);
        assert_eq!(OrderDirection::from("ASC"), OrderDirection::Asc);
        assert_eq!(OrderDirection::from("DESC"), OrderDirection::Desc);
    }

    #[test]
    fn test_parse_filter() {
        let filter = parse_filter("name", "eq.John").unwrap();
        assert_eq!(filter.field, "name");
        assert_eq!(filter.operator, FilterOperator::Eq);
        assert_eq!(filter.value, "John");

        let filter = parse_filter("age", "gt.18").unwrap();
        assert_eq!(filter.field, "age");
        assert_eq!(filter.operator, FilterOperator::Gt);
        assert_eq!(filter.value, "18");
    }

    #[test]
    fn test_parse_filter_default_eq() {
        let filter = parse_filter("name", "John").unwrap();
        assert_eq!(filter.field, "name");
        assert_eq!(filter.operator, FilterOperator::Eq);
        assert_eq!(filter.value, "John");
    }

    #[test]
    fn test_parse_query_params() {
        let mut params = HashMap::new();
        params.insert("select".to_string(), "id,name,email".to_string());
        params.insert("order".to_string(), "created_at.desc".to_string());
        params.insert("limit".to_string(), "50".to_string());
        params.insert("page".to_string(), "2".to_string());
        params.insert("name".to_string(), "eq.John".to_string());
        params.insert("age".to_string(), "gt.18".to_string());

        let query = parse_query_params(&params);

        assert_eq!(query.select, vec!["id", "name", "email"]);
        assert_eq!(query.order_by.len(), 1);
        assert_eq!(query.order_by[0].field, "created_at");
        assert_eq!(query.order_by[0].direction, OrderDirection::Desc);
        assert_eq!(query.limit, Some(50));
        assert_eq!(query.page, Some(2));
        assert_eq!(query.filters.len(), 2);
    }

    #[test]
    fn test_query_params_offset_calculation() {
        let params = QueryParams {
            page: Some(3),
            limit: Some(25),
            ..Default::default()
        };
        assert_eq!(params.offset_or_default(), 50); // (3-1) * 25 = 50

        let params = QueryParams {
            offset: Some(100),
            page: Some(3),
            limit: Some(25),
            ..Default::default()
        };
        assert_eq!(params.offset_or_default(), 100); // offset takes precedence
    }

    #[test]
    fn test_filter_null_values() {
        let filter = parse_filter("deleted_at", "isnull").unwrap();
        assert_eq!(filter.operator, FilterOperator::IsNull);
        assert_eq!(filter.value, "");

        let filter = parse_filter("deleted_at", "isnotnull").unwrap();
        assert_eq!(filter.operator, FilterOperator::IsNotNull);
        assert_eq!(filter.value, "");
    }

    #[test]
    fn test_filter_in_operator() {
        let filter = parse_filter("status", "in.active,pending,archived").unwrap();
        assert_eq!(filter.operator, FilterOperator::In);
        assert_eq!(filter.value, "active,pending,archived");
    }
}
