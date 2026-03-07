import gleam/erlang/process.{type Subject}
import gleam/http/request.{type Request}
import gleam/http/response.{type Response}
import gleam/json
import gleam/option.{None}
import gleam/result
import gleam/string

import config.{type Config}
import health/handler as health_handler
import mist.{type Connection, type ResponseData}
import pubsub/broker.{type BrokerMessage}
import ws/handler as ws_handler

/// Route HTTP and WebSocket requests
pub fn handle_request(
  req: Request(Connection),
  config: Config,
  broker: Subject(BrokerMessage),
) -> ResponseData {
  let path = request.path_segments(req)
  let method = request.method(req)
  
  case method, path {
    // WebSocket endpoint
    http.Get, ["realtime", "v1", "websocket"] -> {
      ws_handler.handle_ws(req, config, broker)
    }
    
    // Health check endpoint
    http.Get, ["health"] -> {
      health_handler.handle_health()
    }
    
    // Default: 404 Not Found
    _, _ -> {
      let body = json.object([
        #("error", json.string("Not Found")),
        #("path", json.string(string.join(path, "/"))),
      ])
      
      response.new(404)
      |> response.set_header("Content-Type", "application/json")
      |> response.set_body(json.to_string(body))
      |> mist.response()
    }
  }
}

// Required imports
import gleam/http
