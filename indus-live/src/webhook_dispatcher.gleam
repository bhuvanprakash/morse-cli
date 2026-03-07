import gleam/http
import gleam/http/request
import gleam/httpc
import gleam/json
import gleam/option
import gleam/result
import gleam/string

/// When a WAL change event arrives, check if any webhook is registered
/// for this table + event combo, then enqueue a job in indus-queue.
pub fn dispatch_to_queue(
  queue_url: String,
  internal_secret: String,
  table_schema: String,
  table_name: String,
  event_type: String,
  record: json.Json,
  old_record: Option(json.Json),
) -> Result(Nil, String) {
  // Build job payload
  let payload = json.object([
    #("table_schema", json.string(table_schema)),
    #("table_name", json.string(table_name)),
    #("event", json.string(event_type)),
    #("record", record),
    #(
      "old_record",
      case old_record {
        option.Some(v) -> v
        option.None -> json.null()
      },
    ),
  ])

  // POST to indus-queue /queue/internal/wal-event
  let body = json.to_string(payload)
  let req_result =
    request.to(queue_url <> "/queue/internal/wal-event")
    |> result.map(fn(req) {
      req
      |> request.set_method(http.Post)
      |> request.set_body(body)
      |> request.set_header("Content-Type", "application/json")
      |> request.set_header("X-IndusBase-Internal", internal_secret)
    })

  case req_result {
    Ok(req) ->
      case httpc.send(req) {
        Ok(resp) if resp.status == 202 -> Ok(Nil)
        Ok(resp) ->
          Error("queue rejected WAL event: " <> string.inspect(resp.status))
        Error(e) ->
          Error("failed to reach indus-queue: " <> string.inspect(e))
      }
    Error(_) -> Error("invalid queue URL")
  }
}
