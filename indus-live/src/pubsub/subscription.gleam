import gleam/erlang/process.{type Subject}
import gleam/string

import pubsub/topic.{type Topic}

/// A subscription represents a client's subscription to a topic
pub type Subscription {
  Subscription(
    id: String,
    topic: Topic,
    reply_to: Subject(WsMessage),
    user_id: String,
    role: String,
    created_at: String,
  )
}

/// WebSocket message type for communication with subscribers
pub type WsMessage {
  EventMessage(String)  // JSON-encoded event
  ErrorMessage(String)
  SubscribedMessage(String)  // Topic string
  UnsubscribedMessage(String)  // Topic string
  PongMessage
}

/// Generate a unique subscription ID
pub fn generate_id() -> String {
  // Use timestamp + random for uniqueness
  // In production, use a proper UUID library
  let timestamp = erlang_system_time(millisecond)
  let random = erlang_rand_uniform(1000000)
  "sub_" <> int.to_string(timestamp) <> "_" <> int.to_string(random)
}

/// Create a new subscription
pub fn new(
  topic: Topic,
  reply_to: Subject(WsMessage),
  user_id: String,
  role: String,
) -> Subscription {
  Subscription(
    id: generate_id(),
    topic: topic,
    reply_to: reply_to,
    user_id: user_id,
    role: role,
    created_at: int.to_string(erlang_system_time(second)),
  )
}

/// Get the topic string from a subscription
pub fn topic_string(sub: Subscription) -> String {
  topic.to_string(sub.topic)
}

/// FFI: Get system time
@external(erlang, "erlang", "system_time")
fn erlang_system_time(unit: TimeUnit) -> Int

type TimeUnit {
  Second
  Millisecond
  Microsecond
  Nanosecond
}

/// FFI: Random uniform
@external(erlang, "rand", "uniform")
fn erlang_rand_uniform(n: Int) -> Int
