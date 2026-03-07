//// Error types for indus-live realtime service
////
//// This module defines all error types used throughout the indus-live
//// application for consistent error handling.

/// Main application error type
pub type AppError {
  /// Configuration-related errors
  ConfigError(reason: String)
  
  /// Database connection errors
  DatabaseError(reason: String)
  
  /// Replication stream errors
  ReplicationError(reason: String)
  
  /// WebSocket handling errors
  WebSocketError(reason: String)
  
  /// Authentication/authorization errors
  AuthError(reason: String)
  
  /// Pub/Sub broker errors
  BrokerError(reason: String)
  
  /// Message encoding/decoding errors
  DecodeError(reason: String)
  
  /// Network/IO errors
  IOError(reason: String)
  
  /// Internal/unexpected errors
  InternalError(reason: String)
}

/// Convert an AppError to a human-readable string
pub fn to_string(error: AppError) -> String {
  case error {
    ConfigError(reason) -> "Configuration error: " <> reason
    DatabaseError(reason) -> "Database error: " <> reason
    ReplicationError(reason) -> "Replication error: " <> reason
    WebSocketError(reason) -> "WebSocket error: " <> reason
    AuthError(reason) -> "Authentication error: " <> reason
    BrokerError(reason) -> "Broker error: " <> reason
    DecodeError(reason) -> "Decode error: " <> reason
    IOError(reason) -> "IO error: " <> reason
    InternalError(reason) -> "Internal error: " <> reason
  }
}

/// Get the error code for an AppError
/// Used for structured error responses
pub fn error_code(error: AppError) -> String {
  case error {
    ConfigError(_) -> "CONFIG_ERROR"
    DatabaseError(_) -> "DATABASE_ERROR"
    ReplicationError(_) -> "REPLICATION_ERROR"
    WebSocketError(_) -> "WEBSOCKET_ERROR"
    AuthError(_) -> "AUTH_ERROR"
    BrokerError(_) -> "BROKER_ERROR"
    DecodeError(_) -> "DECODE_ERROR"
    IOError(_) -> "IO_ERROR"
    InternalError(_) -> "INTERNAL_ERROR"
  }
}

/// Get the HTTP status code for an AppError
pub fn http_status(error: AppError) -> Int {
  case error {
    ConfigError(_) -> 500
    DatabaseError(_) -> 503
    ReplicationError(_) -> 503
    WebSocketError(_) -> 400
    AuthError(_) -> 401
    BrokerError(_) -> 500
    DecodeError(_) -> 400
    IOError(_) -> 500
    InternalError(_) -> 500
  }
}

/// Create a ConfigError
pub fn config_error(reason: String) -> AppError {
  ConfigError(reason)
}

/// Create a DatabaseError
pub fn database_error(reason: String) -> AppError {
  DatabaseError(reason)
}

/// Create a ReplicationError
pub fn replication_error(reason: String) -> AppError {
  ReplicationError(reason)
}

/// Create a WebSocketError
pub fn websocket_error(reason: String) -> AppError {
  WebSocketError(reason)
}

/// Create an AuthError
pub fn auth_error(reason: String) -> AppError {
  AuthError(reason)
}

/// Create a BrokerError
pub fn broker_error(reason: String) -> AppError {
  BrokerError(reason)
}

/// Create a DecodeError
pub fn decode_error(reason: String) -> AppError {
  DecodeError(reason)
}

/// Create an IOError
pub fn io_error(reason: String) -> AppError {
  IOError(reason)
}

/// Create an InternalError
pub fn internal_error(reason: String) -> AppError {
  InternalError(reason)
}
