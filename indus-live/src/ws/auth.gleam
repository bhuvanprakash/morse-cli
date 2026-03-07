import gleam/bit_array
import gleam/dynamic.{type Dynamic}
import gleam/http
import gleam/http/request
import gleam/http/response
import gleam/int
import gleam/json
import gleam/option.{type Option, None, Some}
import gleam/result
import gleam/string

import config.{type Config}

/// WebSocket authentication result
pub type WsAuthResult {
  WsAuthSuccess(user_id: String, email: String, role: String)
  WsAuthFailure(reason: String)
}

/// Validate a JWT token by calling the auth service
pub fn validate_token(token: String, config: Config) -> WsAuthResult {
  case config.auth_service_url {
    None -> {
      // If no auth service configured, validate locally or allow anonymous
      validate_token_local(token, config)
    }
    Some(auth_url) -> {
      // Call auth service to validate
      case call_auth_service(token, auth_url) {
        Ok(result) -> result
        Error(e) -> WsAuthFailure("Auth service error: " <> e)
      }
    }
  }
}

/// Call the indus-auth service to validate a token
fn call_auth_service(token: String, auth_url: String) -> Result(WsAuthResult, String) {
  let url = auth_url <> "/auth/user"
  
  case request.to(url) {
    Ok(req) -> {
      let req = req
        |> request.set_method(http.Get)
        |> request.set_header("Authorization", "Bearer " <> token)
        |> request.set_header("Accept", "application/json")
      
      // Note: Actual HTTP call would be made here
      // For now, return a mock success for development
      Ok(WsAuthSuccess(user_id: "mock_user", email: "user@example.com", role: "authenticated"))
    }
    Error(_) -> Error("Invalid auth URL")
  }
}

/// Parse the auth service response
fn parse_auth_response(resp: response.Response(String)) -> Result(WsAuthResult, String) {
  case resp.status {
    200 -> {
      case json.decode(resp.body, auth_response_decoder()) {
        Ok(#(user_id, email, role)) -> {
          Ok(WsAuthSuccess(user_id: user_id, email: email, role: role))
        }
        Error(_) -> Error("Invalid auth response format")
      }
    }
    401 -> Ok(WsAuthFailure("Invalid or expired token"))
    403 -> Ok(WsAuthFailure("Forbidden"))
    _ -> Error("Unexpected auth service response: " <> int.to_string(resp.status))
  }
}

/// Decoder for auth service response
fn auth_response_decoder() -> fn(Dynamic) -> Result(#(String, String, String), List(dynamic.DecodeError)) {
  dynamic.decode3(
    fn(user_id, email, role) { #(user_id, email, role) },
    dynamic.field("id", dynamic.string),
    dynamic.field("email", dynamic.string),
    dynamic.field("role", dynamic.string),
  )
}

/// Validate token locally (fallback when no auth service)
fn validate_token_local(token: String, config: Config) -> WsAuthResult {
  // In a real implementation, this would verify JWT signature
  // For now, allow anonymous connections with a special token
  case token {
    "anonymous" -> WsAuthSuccess(user_id: "anon", email: "", role: "anonymous")
    _ -> {
      // Try to decode JWT payload without verification (for development)
      case decode_jwt_payload(token) {
        Ok(#(sub, email, role)) -> WsAuthSuccess(user_id: sub, email: email, role: role)
        Error(_) -> WsAuthFailure("Invalid token format")
      }
    }
  }
}

/// Decode JWT payload (without signature verification)
fn decode_jwt_payload(token: String) -> Result(#(String, String, String), String) {
  let parts = string.split(token, ".")
  
  case parts {
    [_, payload_b64, _] -> {
      // Decode Base64 payload
      case base64_decode(payload_b64) {
        Ok(payload_json) -> {
          case json.decode(payload_json, jwt_payload_decoder()) {
            Ok(#(sub, email, role)) -> Ok(#(sub, email, role))
            Error(_) -> Error("Invalid JWT payload")
          }
        }
        Error(_) -> Error("Invalid Base64 encoding")
      }
    }
    _ -> Error("Invalid JWT format")
  }
}

/// Decoder for JWT payload
fn jwt_payload_decoder() -> fn(Dynamic) -> Result(#(String, String, String), List(dynamic.DecodeError)) {
  fn(dyn) {
    let decoder = dynamic.decode3(
      fn(sub, email, role) { #(sub, email, role) },
      dynamic.field("sub", dynamic.string),
      dynamic.optional_field("email", dynamic.string),
      dynamic.optional_field("role", dynamic.string),
    )
    
    case decoder(dyn) {
      Ok(#(sub, maybe_email, maybe_role)) -> {
        let email = option.unwrap(maybe_email, "")
        let role = option.unwrap(maybe_role, "authenticated")
        Ok(#(sub, email, role))
      }
      Error(e) -> Error(e)
    }
  }
}

/// Base64 decode (URL-safe)
fn base64_decode(input: String) -> Result(String, String) {
  // Convert URL-safe base64 to standard base64
  let normalized = input
    |> string.replace("-", "+")
    |> string.replace("_", "/")
  
  // Add padding if needed
  let padding = case string.length(normalized) % 4 {
    0 -> ""
    2 -> "=="
    3 -> "="
    _ -> ""
  }
  
  let padded = normalized <> padding
  
  // Decode using Erlang base64 module
  case bit_array.to_string(base64_decode_erl(padded)) {
    Ok(decoded) -> Ok(decoded)
    Error(_) -> Error("Failed to decode base64")
  }
}

@external(erlang, "base64", "decode")
fn base64_decode_erl(input: String) -> BitArray
