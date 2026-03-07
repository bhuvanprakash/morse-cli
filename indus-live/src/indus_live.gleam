import gleam/erlang/process
import gleam/int
import gleam/io
import gleam/string

import application
import config

/// Main entry point
pub fn main() {
  io.println("=================================")
  io.println("  indus-live: Realtime Engine")
  io.println("=================================")
  
  // Load configuration from environment
  case config.from_env() {
    Ok(cfg) -> {
      io.println("Configuration loaded successfully")
      io.println("Server port: " <> int.to_string(cfg.server_port))
      io.println("Database URL: " <> mask_url(cfg.database_url))
      io.println("Replication slot: " <> cfg.replication_slot)
      io.println("Publication: " <> cfg.publication_name)
      
      // Start the application
      case application.start(cfg) {
        Ok(#(_broker, _replication, _server)) -> {
          io.println("Application started successfully!")
          io.println("Waiting for connections...")
          
          // Keep the main process alive
          keep_alive()
        }
        Error(e) -> {
          io.println("Failed to start application: " <> e)
        }
      }
    }
    Error(e) -> {
      io.println("Configuration error: " <> e)
      io.println("")
      io.println("Required environment variables:")
      io.println("  SERVER_PORT       - HTTP server port (default: 4000)")
      io.println("  DATABASE_URL      - PostgreSQL connection URL")
      io.println("  REPLICATION_URL   - PostgreSQL replication connection URL")
      io.println("")
      io.println("Optional environment variables:")
      io.println("  JWT_PUBLIC_KEY_PATH      - Path to JWT public key")
      io.println("  INTERNAL_SECRET          - Internal API secret")
      io.println("  AUTH_SERVICE_URL         - indus-auth service URL")
      io.println("  MAX_CONNECTIONS_PER_TOPIC - Max WebSocket connections per topic (default: 1000)")
      io.println("  REPLICATION_SLOT         - PostgreSQL replication slot name")
      io.println("  PUBLICATION_NAME         - PostgreSQL publication name")
    }
  }
}

/// Keep the main process alive
fn keep_alive() -> Nil {
  // Sleep for a long time and loop
  process.sleep(60_000)
  keep_alive()
}

/// Mask sensitive parts of a URL for logging
fn mask_url(url: String) -> String {
  // Simple masking - hide password if present
  case string.split(url, "@") {
    [credentials, host] -> {
      case string.split(credentials, "://") {
        [protocol, user_pass] -> {
          case string.split(user_pass, ":") {
            [user, _pass] -> {
              protocol <> "://" <> user <> ":***@" <> host
            }
            _ -> url
          }
        }
        _ -> url
      }
    }
    _ -> url
  }
}
