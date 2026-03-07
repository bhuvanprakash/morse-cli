import gleeunit/should
import gleam/dict
import gleam/option.{Some, None}

import pubsub/topic.{Topic, Eq, parse, matches, to_string}
import wal/change_event.{ChangeEvent, Insert, TextValue, IntValue}

// Test parsing simple topic
pub fn parse_simple_topic_test() {
  let result = parse("public:posts")
  
  case result {
    Ok(topic) -> {
      topic.schema |> should.equal("public")
      topic.table |> should.equal("posts")
      topic.filter |> should.equal(None)
    }
    Error(_) -> should.fail()
  }
}

// Test parsing topic with filter
pub fn parse_filtered_topic_test() {
  let result = parse("public:posts:user_id=eq.123")
  
  case result {
    Ok(topic) -> {
      topic.schema |> should.equal("public")
      topic.table |> should.equal("posts")
      
      case topic.filter {
        Some(filter) -> {
          filter.column |> should.equal("user_id")
          filter.value |> should.equal("123")
        }
        None -> should.fail()
      }
    }
    Error(_) -> should.fail()
  }
}

// Test parsing invalid topic
pub fn parse_invalid_topic_test() {
  let result = parse("invalid")
  
  case result {
    Ok(_) -> should.fail()
    Error(_) -> should.be_true()
  }
}

// Test topic matching without filter
pub fn matches_without_filter_test() {
  let topic = Topic(schema: "public", table: "posts", filter: None)
  
  let record = dict.from_list([
    #("id", IntValue(1)),
    #("title", TextValue("Hello")),
  ])
  
  let event = ChangeEvent(
    schema: "public",
    table: "posts",
    change_type: Insert,
    new_record: Some(record),
    old_record: None,
    changed_columns: None,
    lsn: "0/1",
    timestamp: "123",
  )
  
  matches(topic, event)
  |> should.be_true()
}

// Test topic matching with filter
pub fn matches_with_filter_test() {
  let filter = topic.TopicFilter(column: "user_id", operator: Eq, value: "123")
  let topic = Topic(schema: "public", table: "posts", filter: Some(filter))
  
  let record = dict.from_list([
    #("id", IntValue(1)),
    #("user_id", TextValue("123")),
  ])
  
  let event = ChangeEvent(
    schema: "public",
    table: "posts",
    change_type: Insert,
    new_record: Some(record),
    old_record: None,
    changed_columns: None,
    lsn: "0/1",
    timestamp: "123",
  )
  
  matches(topic, event)
  |> should.be_true()
}

// Test topic not matching different table
pub fn not_matches_different_table_test() {
  let topic = Topic(schema: "public", table: "posts", filter: None)
  
  let record = dict.new()
  
  let event = ChangeEvent(
    schema: "public",
    table: "comments",  // Different table
    change_type: Insert,
    new_record: Some(record),
    old_record: None,
    changed_columns: None,
    lsn: "0/1",
    timestamp: "123",
  )
  
  matches(topic, event)
  |> should.be_false()
}

// Test topic to string conversion
pub fn topic_to_string_test() {
  let topic = Topic(schema: "public", table: "posts", filter: None)
  
  to_string(topic)
  |> should.equal("public:posts")
}

// Test topic with filter to string
pub fn topic_with_filter_to_string_test() {
  let filter = topic.TopicFilter(column: "user_id", operator: Eq, value: "123")
  let topic = Topic(schema: "public", table: "posts", filter: Some(filter))
  
  to_string(topic)
  |> should.equal("public:posts:user_id=eq.123")
}
