import gleeunit/should
import gleam/dict

import wal/change_event.{ChangeEvent, Insert, TextValue, IntValue}
import wal/decoder.{new_state, decode_message, DecoderState, ChangeMessage, RelationInfo}

// Test decoder state creation
pub fn new_state_test() {
  let state = new_state()
  
  // State should have empty relations
  state.current_lsn
  |> should.equal("0/0")
}

// Test relation info structure
pub fn relation_info_test() {
  let rel = RelationInfo(
    id: 1,
    namespace: "public",
    name: "users",
    replica_identity: 0,
    columns: [],
  )
  
  rel.namespace
  |> should.equal("public")
  
  rel.name
  |> should.equal("users")
}

// Test change event creation
pub fn change_event_test() {
  let record = dict.from_list([
    #("id", IntValue(1)),
    #("name", TextValue("Alice")),
  ])
  
  let event = ChangeEvent(
    schema: "public",
    table: "users",
    change_type: Insert,
    new_record: Some(record),
    old_record: None,
    changed_columns: None,
    lsn: "0/123ABC",
    timestamp: "1234567890",
  )
  
  event.schema
  |> should.equal("public")
  
  event.table
  |> should.equal("users")
}
