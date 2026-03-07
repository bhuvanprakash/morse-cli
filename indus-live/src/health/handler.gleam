import gleam/json
import gleam/erlang
import gleam/int

import mist.{type ResponseData}

/// Health check response
pub type HealthStatus {
  HealthStatus(
    status: String,
    service: String,
    version: String,
    uptime_seconds: Int,
  )
}

/// Handle health check request
pub fn handle_health() -> ResponseData {
  let status = HealthStatus(
    status: "healthy",
    service: "indus-live",
    version: "0.1.0",
    uptime_seconds: get_uptime_seconds(),
  )
  
  let body = json.object([
    #("status", json.string(status.status)),
    #("service", json.string(status.service)),
    #("version", json.string(status.version)),
    #("uptime_seconds", json.int(status.uptime_seconds)),
  ])
  
  mist.response(200)
  |> mist.set_header("Content-Type", "application/json")
  |> mist.set_body(json.to_string(body))
}

/// Get uptime in seconds (since application start)
fn get_uptime_seconds() -> Int {
  // Get system time in milliseconds and convert to seconds
  // In a real implementation, you'd track application start time
  erlang_system_time(millisecond) / 1000
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
