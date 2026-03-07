import gleam/dict.{type Dict}
import gleam/list
import gleam/option.{type Option, None, Some}
import gleam/result
import gleam/string

import wal/change_event.{type ChangeEvent, type ColumnValue, column_value_eq}

/// Filter operator for topic filtering
pub type FilterOperator {
  Eq  // equals
  Neq // not equals
  Gt  // greater than
  Gte // greater than or equal
  Lt  // less than
  Lte // less than or equal
  Like // SQL LIKE
  Ilike // case-insensitive LIKE
  In // in list
}

/// A filter on a specific column
pub type TopicFilter {
  TopicFilter(
    column: String,
    operator: FilterOperator,
    value: String,
  )
}

/// A topic represents a subscription pattern
pub type Topic {
  Topic(
    schema: String,
    table: String,
    filter: Option(TopicFilter),
  )
}

/// Parse a topic string into a Topic struct
/// Format: "schema:table" or "schema:table:column=op.value"
/// Examples:
///   - "public:posts"
///   - "public:posts:user_id=eq.abc123"
///   - "public:posts:status=eq.active"
pub fn parse(topic_string: String) -> Result(Topic, String) {
  let parts = string.split(topic_string, ":")
  
  case parts {
    [schema, table] -> {
      Ok(Topic(schema: schema, table: table, filter: None))
    }
    [schema, table, filter_str] -> {
      use filter <- result.try(parse_filter(filter_str))
      Ok(Topic(schema: schema, table: table, filter: Some(filter)))
    }
    _ -> Error("Invalid topic format. Expected 'schema:table' or 'schema:table:column=op.value'")
  }
}

/// Parse a filter string
/// Format: "column=op.value"
/// Examples:
///   - "user_id=eq.abc123"
///   - "age=gt.18"
///   - "status=in.active,pending"
fn parse_filter(filter_str: String) -> Result(TopicFilter, String) {
  // Split by '=' to get column and operator-value
  case string.split(filter_str, "=") {
    [column, op_value] -> {
      // Split op_value by first '.' to get operator and value
      case string.split_once(op_value, ".") {
        Ok(#(op_str, value)) -> {
          use operator <- result.try(parse_operator(op_str))
          Ok(TopicFilter(column: column, operator: operator, value: value))
        }
        Error(_) -> Error("Invalid filter format. Expected 'column=op.value'")
      }
    }
    _ -> Error("Invalid filter format. Expected 'column=op.value'")
  }
}

/// Parse an operator string
fn parse_operator(op_str: String) -> Result(FilterOperator, String) {
  case op_str {
    "eq" -> Ok(Eq)
    "neq" -> Ok(Neq)
    "gt" -> Ok(Gt)
    "gte" -> Ok(Gte)
    "lt" -> Ok(Lt)
    "lte" -> Ok(Lte)
    "like" -> Ok(Like)
    "ilike" -> Ok(Ilike)
    "in" -> Ok(In)
    _ -> Error("Unknown operator: " <> op_str)
  }
}

/// Check if a change event matches a topic
pub fn matches(topic: Topic, event: ChangeEvent) -> Bool {
  // First check schema and table match
  case event.schema == topic.schema && event.table == topic.table {
    False -> False
    True -> {
      // Then apply filter if present
      case topic.filter {
        None -> True
        Some(filter) -> apply_filter(filter, event)
      }
    }
  }
}

/// Apply a filter to a change event
fn apply_filter(filter: TopicFilter, event: ChangeEvent) -> Bool {
  // Get the record to filter on (prefer new_record for inserts/updates, old_record for deletes)
  let record = case event.change_type {
    change_event.Insert | change_event.Update -> event.new_record
    change_event.Delete -> event.old_record
    change_event.Truncate -> None
  }
  
  case record {
    None -> False
    Some(r) -> {
      case dict.get(r, filter.column) {
        Ok(column_value) -> evaluate_filter(filter, column_value)
        Error(_) -> False
      }
    }
  }
}

/// Evaluate a filter against a column value
fn evaluate_filter(filter: TopicFilter, value: ColumnValue) -> Bool {
  let value_str = case value {
    change_event.TextValue(s) -> s
    change_event.IntValue(i) -> int.to_string(i)
    change_event.FloatValue(f) -> float.to_string(f)
    change_event.BoolValue(True) -> "true"
    change_event.BoolValue(False) -> "false"
    change_event.NullValue -> "null"
    change_event.JsonValue(s) -> s
    change_event.BinaryValue(_) -> ""
    change_event.UnknownValue(s) -> s
  }
  
  case filter.operator {
    Eq -> value_str == filter.value
    Neq -> value_str != filter.value
    Gt -> compare_values(value_str, filter.value) == Gt
    Gte -> {
      let cmp = compare_values(value_str, filter.value)
      cmp == Gt || cmp == Eq
    }
    Lt -> compare_values(value_str, filter.value) == Lt
    Lte -> {
      let cmp = compare_values(value_str, filter.value)
      cmp == Lt || cmp == Eq
    }
    Like -> string.contains(value_str, filter.value)
    Ilike -> {
      let lower_val = string.lowercase(value_str)
      let lower_filter = string.lowercase(filter.value)
      string.contains(lower_val, lower_filter)
    }
    In -> {
      let values = string.split(filter.value, ",")
      list.contains(values, value_str)
    }
  }
}

/// Comparison result
type Comparison {
  Lt
  Eq
  Gt
  Na  // Not comparable
}

/// Compare two string values (attempt numeric comparison first)
fn compare_values(a: String, b: String) -> Comparison {
  // Try numeric comparison first
  case int.parse(a), int.parse(b) {
    Ok(a_int), Ok(b_int) -> {
      case a_int > b_int {
        True -> Gt
        False -> {
          case a_int < b_int {
            True -> Lt
            False -> Eq
          }
        }
      }
    }
    _, _ -> {
      // Try float comparison
      case float.parse(a), float.parse(b) {
        Ok(a_float), Ok(b_float) -> {
          case a_float >. b_float {
            True -> Gt
            False -> {
              case a_float <. b_float {
                True -> Lt
                False -> Eq
              }
            }
          }
        }
        _, _ -> {
          // String comparison
          case string.compare(a, b) {
            order.Eq -> Eq
            order.Lt -> Lt
            order.Gt -> Gt
          }
        }
      }
    }
  }
}

/// Convert topic to string representation
pub fn to_string(topic: Topic) -> String {
  let base = topic.schema <> ":" <> topic.table
  case topic.filter {
    None -> base
    Some(filter) -> {
      let op_str = operator_to_string(filter.operator)
      base <> ":" <> filter.column <> "=" <> op_str <> "." <> filter.value
    }
  }
}

/// Convert operator to string
fn operator_to_string(op: FilterOperator) -> String {
  case op {
    Eq -> "eq"
    Neq -> "neq"
    Gt -> "gt"
    Gte -> "gte"
    Lt -> "lt"
    Lte -> "lte"
    Like -> "like"
    Ilike -> "ilike"
    In -> "in"
  }
}
