import gleam/dynamic.{type Dynamic}
import gleam/json
import gleam/option.{type Option}
import gleam/result
import gleam/string

/// Client -> Server messages
pub type ClientMessage {
  ClientSubscribe(topic: String)
  ClientUnsubscribe(topic: String)
  ClientPing
  ClientUnknown(String)
}

/// Server -> Client messages
pub type ServerMessage {
  ServerSubscribed(topic: String)
  ServerUnsubscribed(topic: String)
  ServerEvent(topic: String, payload: String)
  ServerError(message: String)
  ServerPong
  ServerConnected(connection_id: String)
}

/// Decode a client message from JSON string
pub fn decode_client_message(json_str: String) -> ClientMessage {
  case json.decode(json_str, dynamic.dynamic) {
    Ok(dynamic_val) -> parse_client_message(dynamic_val)
    Error(_) -> ClientUnknown("Invalid JSON")
  }
}

/// Parse a dynamic value into a ClientMessage
fn parse_client_message(value: Dynamic) -> ClientMessage {
  use msg_type <- result.try(dynamic.field("type", dynamic.string)(value))
  
  case string.lowercase(msg_type) {
    "subscribe" -> {
      case dynamic.field("topic", dynamic.string)(value) {
        Ok(topic) -> ClientSubscribe(topic)
        Error(_) -> ClientUnknown("Missing topic field")
      }
    }
    "unsubscribe" -> {
      case dynamic.field("topic", dynamic.string)(value) {
        Ok(topic) -> ClientUnsubscribe(topic)
        Error(_) -> ClientUnknown("Missing topic field")
      }
    }
    "ping" -> ClientPing
    _ -> ClientUnknown("Unknown message type: " <> msg_type)
  }
  |> fn(result) {
    case result {
      Ok(msg) -> msg
      Error(_) -> ClientUnknown("Failed to parse message")
    }
  }
}

/// Encode a server message to JSON string
pub fn encode_server_message(msg: ServerMessage) -> String {
  case msg {
    ServerSubscribed(topic) -> {
      json.object([
        #("type", json.string("subscribed")),
        #("topic", json.string(topic)),
      ])
      |> json.to_string
    }
    ServerUnsubscribed(topic) -> {
      json.object([
        #("type", json.string("unsubscribed")),
        #("topic", json.string(topic)),
      ])
      |> json.to_string
    }
    ServerEvent(topic, payload) -> {
      // Parse payload to embed it as an object
      json.object([
        #("type", json.string("event")),
        #("topic", json.string(topic)),
        #("payload", json.parse(payload) |> result.unwrap(json.null())),
      ])
      |> json.to_string
    }
    ServerError(message) -> {
      json.object([
        #("type", json.string("error")),
        #("message", json.string(message)),
      ])
      |> json.to_string
    }
    ServerPong -> {
      json.object([#("type", json.string("pong"))])
      |> json.to_string
    }
    ServerConnected(connection_id) -> {
      json.object([
        #("type", json.string("connected")),
        #("connection_id", json.string(connection_id)),
      ])
      |> json.to_string
    }
  }
}

/// Create a subscription message
pub fn subscribed(topic: String) -> String {
  encode_server_message(ServerSubscribed(topic))
}

/// Create an unsubscription message
pub fn unsubscribed(topic: String) -> String {
  encode_server_message(ServerUnsubscribed(topic))
}

/// Create an event message
pub fn event(topic: String, payload: String) -> String {
  encode_server_message(ServerEvent(topic, payload))
}

/// Create an error message
pub fn error(message: String) -> String {
  encode_server_message(ServerError(message))
}

/// Create a pong message
pub fn pong() -> String {
  encode_server_message(ServerPong)
}

/// Create a connected message
pub fn connected(connection_id: String) -> String {
  encode_server_message(ServerConnected(connection_id))
}
