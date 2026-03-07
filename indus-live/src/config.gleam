import gleam/erlang/os
import gleam/int
import gleam/option.{type Option, None, Some}
import gleam/result
import gleam/string

/// Configuration for the indus-live service
pub type Config {
  Config(
    // Required
    server_port: Int,
    database_url: String,
    replication_url: String,
    // Optional auth/security
    jwt_public_key_path: Option(String),
    internal_secret: Option(String),
    auth_service_url: Option(String),
    queue_service_url: Option(String),
    // Replication settings
    max_connections_per_topic: Int,
    replication_slot: String,
    publication_name: String,
  )
}

/// Default configuration values
const default_port = 4000

const default_max_connections = 1000

const default_replication_slot = "indus_live_slot"

const default_publication_name = "indus_live_pub"

/// Load configuration from environment variables
pub fn from_env() -> Result(Config, String) {
  use server_port <- result.try(get_int_env("SERVER_PORT", default_port))
  use database_url <- result.try(get_required_env("DATABASE_URL"))
  use replication_url <- result.try(get_required_env("REPLICATION_URL"))

  use max_connections <- result.try(get_int_env(
    "MAX_CONNECTIONS_PER_TOPIC",
    default_max_connections,
  ))

  let jwt_public_key_path = get_optional_env("JWT_PUBLIC_KEY_PATH")
  let internal_secret = get_optional_env("INTERNAL_SECRET")
  let auth_service_url = get_optional_env("AUTH_SERVICE_URL")
  let queue_service_url = get_optional_env("QUEUE_SERVICE_URL")
  let replication_slot =
    get_optional_env("REPLICATION_SLOT")
    |> option.unwrap(default_replication_slot)
  let publication_name =
    get_optional_env("PUBLICATION_NAME")
    |> option.unwrap(default_publication_name)

  Ok(Config(
    server_port: server_port,
    database_url: database_url,
    replication_url: replication_url,
    jwt_public_key_path: jwt_public_key_path,
    internal_secret: internal_secret,
    auth_service_url: auth_service_url,
    queue_service_url: queue_service_url,
    max_connections_per_topic: max_connections,
    replication_slot: replication_slot,
    publication_name: publication_name,
  ))
}

/// Get a required environment variable
fn get_required_env(name: String) -> Result(String, String) {
  case os.get_env(name) {
    Ok(value) ->
      case string.trim(value) {
        "" -> Error(name <> " is not set")
        trimmed -> Ok(trimmed)
      }
    Error(_) -> Error(name <> " is not set")
  }
}

/// Get an optional environment variable
fn get_optional_env(name: String) -> Option(String) {
  case os.get_env(name) {
    Ok(value) ->
      case string.trim(value) {
        "" -> None
        trimmed -> Some(trimmed)
      }
    Error(_) -> None
  }
}

/// Get an integer environment variable with a default
fn get_int_env(name: String, default: Int) -> Result(Int, String) {
  case os.get_env(name) {
    Ok(value) ->
      case int.parse(string.trim(value)) {
        Ok(n) -> Ok(n)
        Error(_) -> Error(name <> " must be a valid integer")
      }
    Error(_) -> Ok(default)
  }
}
