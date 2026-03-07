import gleam/dict.{type Dict}
import gleam/erlang/process.{type Subject}
import gleam/http/request.{type Request}
import gleam/io
import gleam/option.{type Option, None, Some}
import gleam/otp/actor
import gleam/result
import gleam/string
import gleam/uuid

import config.{type Config}
import mist.{type Connection, type ResponseData}
import pubsub/broker.{type BrokerMessage, Subscribe, Unsubscribe}
import pubsub/subscription.{type Subscription, type WsMessage, new as new_subscription}
import pubsub/topic.{type Topic}
import ws/auth.{type WsAuthResult, validate_token}
import ws/protocol.{
  type ClientMessage, ClientPing, ClientSubscribe, ClientUnsubscribe, ClientUnknown,
  connected, decode_client_message, encode_server_message, error, pong, subscribed,
  unsubscribed,
}

/// WebSocket connection state
pub type WsState {
  WsState(
    connection_id: String,
    user_id: String,
    role: String,
    subscription_ids: Dict(String, String),  // topic -> subscription_id
    broker: Subject(BrokerMessage),
    config: Config,
    ws_subject: Subject(WsMessage),
  )
}

/// Handle WebSocket upgrade request
pub fn handle_ws(
  req: Request(Connection),
  config: Config,
  broker: Subject(BrokerMessage),
) -> ResponseData {
  // Extract token from query params
  let token = extract_token(req)
  
  // Validate token
  case validate_token(token, config) {
    auth.WsAuthSuccess(user_id, _email, role) -> {
      // Generate connection ID
      let connection_id = uuid.v4()
      
      // Create WebSocket subject for receiving messages from broker
      let ws_subject = process.new_subject()
      
      // Create initial state
      let state = WsState(
        connection_id: connection_id,
        user_id: user_id,
        role: role,
        subscription_ids: dict.new(),
        broker: broker,
        config: config,
        ws_subject: ws_subject,
      )
      
      // Upgrade to WebSocket
      mist.websocket(
        request: req,
        on_init: fn(_conn) {
          // Send connected message
          let msg = connected(connection_id)
          #(state, Some(msg))
        },
        on_text: fn(state, text) {
          handle_client_message(state, text)
        },
        on_binary: fn(state, _binary) {
          // Ignore binary messages
          #(state, None)
        },
        on_close: fn(state) {
          // Unsubscribe from all topics
          unsubscribe_all(state)
          Nil
        },
      )
    }
    auth.WsAuthFailure(reason) -> {
      // Return error response
      mist.response(401)
        |> mist.set_header("Content-Type", "application/json")
        |> mist.set_body(error("Authentication failed: " <> reason))
    }
  }
}

/// Extract token from request query parameters
fn extract_token(req: Request(Connection)) -> String {
  // Get query string from request
  let query = request.get_query(req)
  
  case query {
    Ok(params) -> {
      // Find token parameter
      case list.find(params, fn(pair) { pair.0 == "token" }) {
        Ok(#(_, token)) -> token
        Error(_) -> ""
      }
    }
    Error(_) -> ""
  }
}

/// Handle a client message
fn handle_client_message(state: WsState, text: String) -> #(WsState, Option(String)) {
  let msg = decode_client_message(text)
  
  case msg {
    ClientSubscribe(topic_str) -> {
      case handle_subscribe(state, topic_str) {
        Ok(#(new_state, response)) -> #(new_state, Some(response))
        Error(e) -> #(state, Some(error(e)))
      }
    }
    
    ClientUnsubscribe(topic_str) -> {
      case handle_unsubscribe(state, topic_str) {
        Ok(#(new_state, response)) -> #(new_state, Some(response))
        Error(e) -> #(state, Some(error(e)))
      }
    }
    
    ClientPing -> {
      #(state, Some(pong()))
    }
    
    ClientUnknown(reason) -> {
      #(state, Some(error("Unknown message: " <> reason)))
    }
  }
}

/// Handle subscription request
fn handle_subscribe(state: WsState, topic_str: String) -> Result(#(WsState, String), String) {
  // Parse topic
  case topic.parse(topic_str) {
    Ok(topic) -> {
      // Check if already subscribed
      case dict.get(state.subscription_ids, topic_str) {
        Ok(_) -> Error("Already subscribed to: " <> topic_str)
        Error(_) -> {
          // Create subscription
          let sub = new_subscription(
            topic: topic,
            reply_to: state.ws_subject,
            user_id: state.user_id,
            role: state.role,
          )
          
          // Send to broker
          process.send(state.broker, Subscribe(sub))
          
          // Update state
          let new_subs = dict.insert(state.subscription_ids, topic_str, sub.id)
          let new_state = WsState(..state, subscription_ids: new_subs)
          
          Ok(#(new_state, subscribed(topic_str)))
        }
      }
    }
    Error(e) -> Error("Invalid topic: " <> e)
  }
}

/// Handle unsubscription request
fn handle_unsubscribe(state: WsState, topic_str: String) -> Result(#(WsState, String), String) {
  case dict.get(state.subscription_ids, topic_str) {
    Ok(sub_id) -> {
      // Send unsubscribe to broker
      process.send(state.broker, Unsubscribe(sub_id))
      
      // Update state
      let new_subs = dict.delete(state.subscription_ids, topic_str)
      let new_state = WsState(..state, subscription_ids: new_subs)
      
      Ok(#(new_state, unsubscribed(topic_str)))
    }
    Error(_) -> Error("Not subscribed to: " <> topic_str)
  }
}

/// Unsubscribe from all topics (called on close)
fn unsubscribe_all(state: WsState) -> Nil {
  state.subscription_ids
  |> dict.each(fn(_topic, sub_id) {
    process.send(state.broker, Unsubscribe(sub_id))
  })
}

/// Forward loop for receiving messages from broker and sending to WebSocket
/// This runs in a separate process
pub fn forward_loop(
  ws_subject: Subject(WsMessage),
  connection: mist.WebSocketConnection,
) -> Nil {
  // Receive message from broker
  case process.receive(ws_subject, 5000) {
    Ok(msg) -> {
      // Convert to WebSocket text and send
      let text = ws_message_to_string(msg)
      mist.send_text_frame(connection, text)
      
      // Continue loop
      forward_loop(ws_subject, connection)
    }
    Error(_) -> {
      // Timeout, continue waiting
      forward_loop(ws_subject, connection)
    }
  }
}

/// Convert WsMessage to string
fn ws_message_to_string(msg: WsMessage) -> String {
  case msg {
    subscription.EventMessage(json) -> json
    subscription.ErrorMessage(text) -> error(text)
    subscription.SubscribedMessage(topic) -> subscribed(topic)
    subscription.UnsubscribedMessage(topic) -> unsubscribed(topic)
    subscription.PongMessage -> pong()
  }
}

// Required imports
import gleam/list
