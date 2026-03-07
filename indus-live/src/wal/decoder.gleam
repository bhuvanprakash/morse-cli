import gleam/bit_array
import gleam/dict.{type Dict}
import gleam/int
import gleam/list
import gleam/option.{type Option, None, Some}
import gleam/result
import gleam/string

import wal/change_event.{
  type ChangeEvent, type ColumnValue, BoolValue, ChangeEvent, Delete, FloatValue,
  Insert, IntValue, JsonValue, NullValue, TextValue, Truncate, UnknownValue,
  Update,
}

/// Column information from relation message
pub type ColumnInfo {
  ColumnInfo(
    flags: Int,
    name: String,
    data_type: Int,
    type_modifier: Int,
  )
}

/// Relation information cached from 'R' messages
pub type RelationInfo {
  RelationInfo(
    id: Int,
    namespace: String,
    name: String,
    replica_identity: Int,
    columns: List(ColumnInfo),
  )
}

/// Decoder state maintains relation cache
pub type DecoderState {
  DecoderState(
    relations: Dict(Int, RelationInfo),
    current_lsn: String,
    current_timestamp: String,
  )
}

/// Create a new decoder state
pub fn new_state() -> DecoderState {
  DecoderState(
    relations: dict.new(),
    current_lsn: "0/0",
    current_timestamp: "",
  )
}

/// A decoded message result
pub type DecodedMessage {
  ChangeMessage(ChangeEvent)
  RelationMessage(RelationInfo)
  BeginMessage(lsn: String, timestamp: String)
  CommitMessage(lsn: String)
  KeepaliveMessage
  UnknownMessage(String)
}

/// Decode a pgoutput message
pub fn decode_message(
  data: BitArray,
  state: DecoderState,
) -> Result(#(DecodedMessage, DecoderState), String) {
  case data {
    <<message_type:8, rest:bits>> -> {
      case message_type {
        0x42 -> decode_begin(rest, state)  // 'B' - Begin
        0x43 -> decode_commit(rest, state)  // 'C' - Commit
        0x49 -> decode_insert(rest, state)  // 'I' - Insert
        0x55 -> decode_update(rest, state)  // 'U' - Update
        0x44 -> decode_delete(rest, state)  // 'D' - Delete
        0x54 -> decode_truncate(rest, state)  // 'T' - Truncate
        0x52 -> decode_relation(rest, state)  // 'R' - Relation
        0x4b -> Ok(#(KeepaliveMessage, state))  // 'K' - Keepalive
        _ -> Ok(#(UnknownMessage("Unknown message type"), state))
      }
    }
    _ -> Error("Invalid message format")
  }
}

/// Decode a begin message
fn decode_begin(
  data: BitArray,
  state: DecoderState,
) -> Result(#(DecodedMessage, DecoderState), String) {
  case data {
    <<lsn:64, _:64, timestamp:64, _xid:32, _:bits>> -> {
      let lsn_str = lsn_to_string(lsn)
      let ts_str = timestamp_to_string(timestamp)
      let new_state = DecoderState(..state, current_lsn: lsn_str, current_timestamp: ts_str)
      Ok(#(BeginMessage(lsn: lsn_str, timestamp: ts_str), new_state))
    }
    _ -> Error("Invalid begin message")
  }
}

/// Decode a commit message
fn decode_commit(
  data: BitArray,
  state: DecoderState,
) -> Result(#(DecodedMessage, DecoderState), String) {
  case data {
    <<_:8, lsn:64, _:64, _timestamp:64, _:bits>> -> {
      let lsn_str = lsn_to_string(lsn)
      Ok(#(CommitMessage(lsn: lsn_str), state))
    }
    _ -> Error("Invalid commit message")
  }
}

/// Decode an insert message
fn decode_insert(
  data: BitArray,
  state: DecoderState,
) -> Result(#(DecodedMessage, DecoderState), String) {
  case data {
    <<relation_id:32, _tuple_type:8, tuple_data:bits>> -> {
      use relation <- result.try(get_relation(state, relation_id))
      use record <- result.try(decode_tuple(tuple_data, relation))
      
      let event = ChangeEvent(
        schema: relation.namespace,
        table: relation.name,
        change_type: Insert,
        new_record: Some(record),
        old_record: None,
        changed_columns: None,
        lsn: state.current_lsn,
        timestamp: state.current_timestamp,
      )
      Ok(#(ChangeMessage(event), state))
    }
    _ -> Error("Invalid insert message")
  }
}

/// Decode an update message
fn decode_update(
  data: BitArray,
  state: DecoderState,
) -> Result(#(DecodedMessage, DecoderState), String) {
  case data {
    <<relation_id:32, flags:8, rest:bits>> -> {
      use relation <- result.try(get_relation(state, relation_id))
      
      // Parse optional old tuple for replica identity
      let #(old_record, new_data) = case flags {
        0x01 -> {
          // Has old tuple (key)
          case decode_tuple_with_prefix(rest, relation) {
            Ok(#(record, remaining)) -> #(Some(record), remaining)
            Error(_) -> #(None, rest)
          }
        }
        0x02 -> {
          // Has old tuple (full)
          case decode_tuple_with_prefix(rest, relation) {
            Ok(#(record, remaining)) -> #(Some(record), remaining)
            Error(_) -> #(None, rest)
          }
        }
        _ -> #(None, rest)
      }
      
      // Parse new tuple
      use #(new_record, _) <- result.try(decode_tuple_with_prefix(new_data, relation))
      
      let changed_cols = case old_record {
        Some(old) -> Some(find_changed_columns(old, new_record))
        None -> None
      }
      
      let event = ChangeEvent(
        schema: relation.namespace,
        table: relation.name,
        change_type: Update,
        new_record: Some(new_record),
        old_record: old_record,
        changed_columns: changed_cols,
        lsn: state.current_lsn,
        timestamp: state.current_timestamp,
      )
      Ok(#(ChangeMessage(event), state))
    }
    _ -> Error("Invalid update message")
  }
}

/// Decode a delete message
fn decode_delete(
  data: BitArray,
  state: DecoderState,
) -> Result(#(DecodedMessage, DecoderState), String) {
  case data {
    <<relation_id:32, _key_type:8, tuple_data:bits>> -> {
      use relation <- result.try(get_relation(state, relation_id))
      use old_record <- result.try(decode_tuple(tuple_data, relation))
      
      let event = ChangeEvent(
        schema: relation.namespace,
        table: relation.name,
        change_type: Delete,
        new_record: None,
        old_record: Some(old_record),
        changed_columns: None,
        lsn: state.current_lsn,
        timestamp: state.current_timestamp,
      )
      Ok(#(ChangeMessage(event), state))
    }
    _ -> Error("Invalid delete message")
  }
}

/// Decode a truncate message
fn decode_truncate(
  data: BitArray,
  state: DecoderState,
) -> Result(#(DecodedMessage, DecoderState), String) {
  case data {
    <<_options:8, n_relations:32, rest:bits>> -> {
      use relations <- result.try(decode_truncate_relations(rest, n_relations, state, []))
      // For simplicity, use first relation
      case relations {
        [first, ..] -> {
          let event = ChangeEvent(
            schema: first.namespace,
            table: first.name,
            change_type: Truncate,
            new_record: None,
            old_record: None,
            changed_columns: None,
            lsn: state.current_lsn,
            timestamp: state.current_timestamp,
          )
          Ok(#(ChangeMessage(event), state))
        }
        [] -> Error("No relations in truncate")
      }
    }
    _ -> Error("Invalid truncate message")
  }
}

/// Decode truncate relation IDs
fn decode_truncate_relations(
  data: BitArray,
  n: Int,
  state: DecoderState,
  acc: List(RelationInfo),
) -> Result(List(RelationInfo), String) {
  case n {
    0 -> Ok(list.reverse(acc))
    _ -> {
      case data {
        <<rel_id:32, rest:bits>> -> {
          use relation <- result.try(get_relation(state, rel_id))
          decode_truncate_relations(rest, n - 1, state, [relation, ..acc])
        }
        _ -> Error("Invalid truncate relations")
      }
    }
  }
}

/// Decode a relation message and cache it
fn decode_relation(
  data: BitArray,
  state: DecoderState,
) -> Result(#(DecodedMessage, DecoderState), String) {
  case data {
    <<rel_id:32, namespace_len:8, namespace:bytes-size(namespace_len),
      name_len:8, name:bytes-size(name_len), replica_identity:8,
      n_cols:16, cols_data:bits>> -> {
      use columns <- result.try(decode_columns(cols_data, n_cols, []))
      
      let relation = RelationInfo(
        id: rel_id,
        namespace: bit_array_to_string(namespace),
        name: bit_array_to_string(name),
        replica_identity: replica_identity,
        columns: columns,
      )
      
      let new_relations = dict.insert(state.relations, rel_id, relation)
      let new_state = DecoderState(..state, relations: new_relations)
      
      Ok(#(RelationMessage(relation), new_state))
    }
    _ -> Error("Invalid relation message")
  }
}

/// Decode column definitions
fn decode_columns(
  data: BitArray,
  n: Int,
  acc: List(ColumnInfo),
) -> Result(List(ColumnInfo), String) {
  case n {
    0 -> Ok(list.reverse(acc))
    _ -> {
      case data {
        <<flags:8, name_len:8, name:bytes-size(name_len),
          data_type:32, type_modifier:32, rest:bits>> -> {
          let col = ColumnInfo(
            flags: flags,
            name: bit_array_to_string(name),
            data_type: data_type,
            type_modifier: type_modifier,
          )
          decode_columns(rest, n - 1, [col, ..acc])
        }
        _ -> Error("Invalid column definition")
      }
    }
  }
}

/// Decode tuple data with 'N' or 'O' prefix
fn decode_tuple_with_prefix(
  data: BitArray,
  relation: RelationInfo,
) -> Result(#(Dict(String, ColumnValue), BitArray), String) {
  case data {
    <<_prefix:8, rest:bits>> -> decode_tuple(rest, relation)
    _ -> Error("Invalid tuple prefix")
  }
}

/// Decode tuple data into a record
fn decode_tuple(
  data: BitArray,
  relation: RelationInfo,
) -> Result(Dict(String, ColumnValue), String) {
  case data {
    <<n_cols:16, col_data:bits>> -> {
      decode_column_values(col_data, relation.columns, dict.new())
    }
    _ -> Error("Invalid tuple data")
  }
}

/// Decode column values
fn decode_column_values(
  data: BitArray,
  columns: List(ColumnInfo),
  acc: Dict(String, ColumnValue),
) -> Result(Dict(String, ColumnValue), String) {
  case columns {
    [] -> Ok(acc)
    [col, ..rest] -> {
      case data {
        <<0xff, 0xff, 0xff, 0xff, rest_data:bits>> -> {
          // NULL value
          let new_acc = dict.insert(acc, col.name, NullValue)
          decode_column_values(rest_data, rest, new_acc)
        }
        <<len:32, value:bytes-size(len), rest_data:bits>> -> {
          let col_value = parse_column_value(value, col.data_type)
          let new_acc = dict.insert(acc, col.name, col_value)
          decode_column_values(rest_data, rest, new_acc)
        }
        _ -> Error("Invalid column value")
      }
    }
  }
}

/// Parse a column value based on PostgreSQL type
fn parse_column_value(data: BitArray, data_type: Int) -> ColumnValue {
  let str_val = bit_array_to_string(data)
  
  // Common PostgreSQL OIDs
  case data_type {
    16 -> parse_bool(str_val)  // bool
    20 | 21 | 23 -> parse_int(str_val)  // int8, int2, int4
    700 | 701 -> parse_float(str_val)  // float4, float8
    3802 | 114 -> JsonValue(str_val)  // jsonb, json
    _ -> TextValue(str_val)  // Treat as text by default
  }
}

/// Parse boolean value
fn parse_bool(s: String) -> ColumnValue {
  case s {
    "t" | "true" | "1" -> BoolValue(True)
    "f" | "false" | "0" -> BoolValue(False)
    _ -> TextValue(s)
  }
}

/// Parse integer value
fn parse_int(s: String) -> ColumnValue {
  case int.parse(s) {
    Ok(i) -> IntValue(i)
    Error(_) -> TextValue(s)
  }
}

/// Parse float value
fn parse_float(s: String) -> ColumnValue {
  case float.parse(s) {
    Ok(f) -> FloatValue(f)
    Error(_) -> TextValue(s)
  }
}

/// Find changed columns between old and new records
fn find_changed_columns(
  old: Dict(String, ColumnValue),
  new: Dict(String, ColumnValue),
) -> List(String) {
  dict.keys(new)
  |> list.filter(fn(key) {
    case dict.get(old, key), dict.get(new, key) {
      Ok(old_val), Ok(new_val) -> old_val != new_val
      _, _ -> True
    }
  })
}

/// Get a relation from cache
fn get_relation(state: DecoderState, id: Int) -> Result(RelationInfo, String) {
  case dict.get(state.relations, id) {
    Ok(rel) -> Ok(rel)
    Error(_) -> Error("Unknown relation ID: " <> int.to_string(id))
  }
}

/// Convert LSN (Log Sequence Number) to string
fn lsn_to_string(lsn: Int) -> String {
  let hi = int.bitwise_shift_right(lsn, 32)
  let lo = int.bitwise_and(lsn, 0xffffffff)
  int.to_base16(hi) <> "/" <> int.to_base16(lo)
}

/// Convert PostgreSQL timestamp to string (microseconds since 2000-01-01)
fn timestamp_to_string(ts: Int) -> String {
  // This is a simplified conversion - in production, use proper time handling
  int.to_string(ts)
}

/// Convert BitArray to String
fn bit_array_to_string(bits: BitArray) -> String {
  case bit_array.to_string(bits) {
    Ok(s) -> s
    Error(_) -> ""
  }
}
