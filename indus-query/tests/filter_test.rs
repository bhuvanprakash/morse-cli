use indus_query::rest::filter::{parse_query_params, FilterOperator, OrderDirection};
use std::collections::HashMap;

#[test]
fn test_parse_simple_filter() {
    let mut params = HashMap::new();
    params.insert("name".to_string(), "eq.John".to_string());

    let query = parse_query_params(&params);

    assert_eq!(query.filters.len(), 1);
    assert_eq!(query.filters[0].field, "name");
    assert!(matches!(query.filters[0].operator, FilterOperator::Eq));
    assert_eq!(query.filters[0].value, "John");
}

#[test]
fn test_parse_filter_with_special_chars() {
    let mut params = HashMap::new();
    params.insert("name".to_string(), "eq.O'Connor".to_string());

    let query = parse_query_params(&params);

    assert_eq!(query.filters.len(), 1);
    assert_eq!(query.filters[0].value, "O'Connor");
}

#[test]
fn test_parse_multiple_filters() {
    let mut params = HashMap::new();
    params.insert("name".to_string(), "eq.John".to_string());
    params.insert("age".to_string(), "gt.18".to_string());
    params.insert("status".to_string(), "eq.active".to_string());

    let query = parse_query_params(&params);

    assert_eq!(query.filters.len(), 3);
}

#[test]
fn test_parse_query_params_with_select() {
    let mut params = HashMap::new();
    params.insert("select".to_string(), "id,name,email".to_string());

    let query = parse_query_params(&params);

    assert_eq!(query.select.len(), 3);
    assert_eq!(query.select, vec!["id", "name", "email"]);
}

#[test]
fn test_parse_query_params_with_pagination() {
    let mut params = HashMap::new();
    params.insert("page".to_string(), "2".to_string());
    params.insert("limit".to_string(), "50".to_string());

    let query = parse_query_params(&params);

    assert_eq!(query.page, Some(2));
    assert_eq!(query.limit, Some(50));
}

#[test]
fn test_parse_query_params_with_order_by() {
    let mut params = HashMap::new();
    params.insert("order".to_string(), "created_at.desc".to_string());

    let query = parse_query_params(&params);

    assert_eq!(query.order_by.len(), 1);
    assert_eq!(query.order_by[0].field, "created_at");
    assert_eq!(query.order_by[0].direction, OrderDirection::Desc);
}

#[test]
fn test_filter_operator_from_str() {
    assert!(matches!(FilterOperator::from("eq"), FilterOperator::Eq));
    assert!(matches!(FilterOperator::from("="), FilterOperator::Eq));
    assert!(matches!(FilterOperator::from("neq"), FilterOperator::Neq));
    assert!(matches!(FilterOperator::from("gt"), FilterOperator::Gt));
    assert!(matches!(FilterOperator::from("gte"), FilterOperator::Gte));
    assert!(matches!(FilterOperator::from("lt"), FilterOperator::Lt));
    assert!(matches!(FilterOperator::from("lte"), FilterOperator::Lte));
    assert!(matches!(FilterOperator::from("like"), FilterOperator::Like));
    assert!(matches!(FilterOperator::from("ilike"), FilterOperator::Ilike));
}

#[test]
fn test_order_direction_from_str() {
    assert!(matches!(OrderDirection::from("asc"), OrderDirection::Asc));
    assert!(matches!(OrderDirection::from("desc"), OrderDirection::Desc));
    assert!(matches!(OrderDirection::from("ASC"), OrderDirection::Asc));
    assert!(matches!(OrderDirection::from("DESC"), OrderDirection::Desc));
}

#[test]
fn test_filter_null_values() {
    let mut params = HashMap::new();
    params.insert("deleted_at".to_string(), "isnull".to_string());

    let query = parse_query_params(&params);

    assert_eq!(query.filters.len(), 1);
    assert!(matches!(query.filters[0].operator, FilterOperator::IsNull));
}

#[test]
fn test_filter_in_operator() {
    let mut params = HashMap::new();
    params.insert("status".to_string(), "in.active,pending,archived".to_string());

    let query = parse_query_params(&params);

    assert_eq!(query.filters.len(), 1);
    assert!(matches!(query.filters[0].operator, FilterOperator::In));
    assert_eq!(query.filters[0].value, "active,pending,archived");
}