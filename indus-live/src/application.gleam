import gleam/erlang/process.{type Subject}
import gleam/int
import gleam/io
import gleam/otp/actor
import gleam/result

import config.{type Config}
import mist.{type ResponseData}
import pubsub/broker.{type BrokerMessage, start as start_broker}
import router
import wal/replication.{type ReplicationMessage, start as start_replication}

/// Start the OTP application supervisor tree
pub fn start(config: Config) {
  io.println("Starting indus-live application...")
  
  // Start broker first
  case start_broker(config) {
    Ok(broker) -> {
      io.println("Broker started successfully")
      
      // Start replication connection
      case start_replication(config, broker) {
        Ok(replication) -> {
          io.println("Replication started successfully")
          
          // Start HTTP server
          case start_http_server(config, broker) {
            Ok(server) -> {
              io.println("HTTP server started on port " <> int.to_string(config.server_port))
              Ok(#(broker, replication, server))
            }
            Error(e) -> {
              io.println("Failed to start HTTP server: " <> e)
              Error(e)
            }
          }
        }
        Error(e) -> {
          io.println("Failed to start replication: " <> e)
          Error(e)
        }
      }
    }
    Error(e) -> {
      io.println("Failed to start broker: " <> e)
      Error(e)
    }
  }
}

/// Start the HTTP server
fn start_http_server(
  config: Config,
  broker: Subject(BrokerMessage),
) -> Result(mist.Server, String) {
  let handler = fn(req) {
    router.handle_request(req, config, broker)
  }
  
  mist.new()
  |> mist.port(config.server_port)
  |> mist.handler(handler)
  |> mist.start()
  |> result.map_error(fn(_e) { "Server start failed" })
}
