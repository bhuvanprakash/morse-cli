import gleam/dict.{type Dict}
import gleam/dynamic.{type Dynamic}
import gleam/json.{type Json}
import gleam/option.{type Option}

/// Type of database change
pub type ChangeType {
  Insert
  Update
  Delete
  Truncate
}

/// A column value can be of various types
pub type ColumnValue {
  TextValue(String)
  IntValue(Int)
  FloatValue(Float)
  BoolValue(Bool)
  NullValue
  JsonValue(String)
  BinaryValue(BitArray)
  UnknownValue(String)
}

/// A change event represents a single database change
pub type ChangeEvent {
  ChangeEvent(
    schema: String,
    table: String,
    change_type: ChangeType,
    new_record: Option(Dict(String, ColumnValue)),
    old_record: Option(Dict(String, ColumnValue)),
    changed_columns: Option(List(String)),
    lsn: String,
    timestamp: String,
  )
}

/// Convert ChangeType to string
pub fn change_type_to_string(change_type: ChangeType) -> String {
  case change_type {
    Insert -> "INSERT"
    Update -> "UPDATE"
    Delete -> "DELETE"
    Truncate -> "TRUNCATE"
  }
}

/// Convert string to ChangeType
pub fn change_type_from_string(s: String) -> Result(ChangeType, String) {
  case s {
    "INSERT" -> Ok(Insert)
    "UPDATE" -> Ok(Update)
    "DELETE" -> Ok(Delete)
    "TRUNCATE" -> Ok(Truncate)
    _ -> Error("Unknown change type: " <> s)
  }
}

/// Convert ColumnValue to JSON
fn column_value_to_json(value: ColumnValue) -> Json {
  case value {
    TextValue(s) -> json.string(s)
    IntValue(i) -> json.int(i)
    FloatValue(f) -> json.float(f)
    BoolValue(b) -> json.bool(b)
    NullValue -> json.null()
    JsonValue(s) -> json.string(s)
    BinaryValue(_) -> json.string("<binary>")
    UnknownValue(s) -> json.string(s)
  }
}

/// Convert a record (dict of column values) to JSON
pub fn record_to_json(record: Dict(String, ColumnValue)) -> Json {
  record
  |> dict.to_list
  |> json.object
}

/// Convert ChangeEvent to JSON string
pub fn to_json(event: ChangeEvent) -> String {
  let new_record_json = case event.new_record {
    option.Some(record) -> record_to_json(record)
    option.None -> json.null()
  }

  let old_record_json = case event.old_record {
    option.Some(record) -> record_to_json(record)
    option.None -> json.null()
  }

  let changed_columns_json = case event.changed_columns {
    option.Some(columns) -> json.array(columns, json.string)
    option.None -> json.null()
  }

  json.object([
    #("schema", json.string(event.schema)),
    #("table", json.string(event.table)),
    #("change_type", json.string(change_type_to_string(event.change_type))),
    #("new_record", new_record_json),
    #("old_record", old_record_json),
    #("changed_columns", changed_columns_json),
    #("lsn", json.string(event.lsn)),
    #("timestamp", json.string(event.timestamp)),
  ])
  |> json.to_string
}

/// Convert ColumnValue to string representation
pub fn column_value_to_string(value: ColumnValue) -> String {
  case value {
    TextValue(s) -> s
    IntValue(i) -> int.to_string(i)
    FloatValue(f) -> float.to_string(f)
    BoolValue(True) -> "true"
    BoolValue(False) -> "false"
    NullValue -> "null"
    JsonValue(s) -> s
    BinaryValue(_) -> "<binary>"
    UnknownValue(s) -> s
  }
}

/// Helper to compare column values for filtering
pub fn column_value_eq(value: ColumnValue, other: String) -> Bool {
  column_value_to_string(value) == other
}
