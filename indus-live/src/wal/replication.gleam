import gleam/erlang/atom.{type Atom}
import gleam/erlang/process.{type Subject, type Pid}
import gleam/io
import gleam/option.{type Option, None, Some}
import gleam/otp/actor.{type StartResult}
import gleam/result
import gleam/json

import config.{type Config}
import wal/change_event.{type ChangeEvent}
import wal/change_event
import wal/decoder.{type DecoderState, type DecodedMessage, new_state, decode_message}
import pubsub/broker.{type BrokerMessage, Publish}
import webhook_dispatcher

/// Replication message types
pub type ReplicationMessage {
  Start
  Stop
  XLogData(lsn: String, data: BitArray)
  PrimaryKeepalive(lsn: String, reply_required: Bool)
}

/// Replication actor state
pub type ReplicationState {
  ReplicationState(
    config: Config,
    decoder_state: DecoderState,
    broker: Subject(BrokerMessage),
    connection: Option(Pid),
  )
}

/// Start the replication actor
pub fn start(
  config: Config,
  broker: Subject(BrokerMessage),
) -> StartResult(ReplicationMessage) {
  let state = ReplicationState(
    config: config,
    decoder_state: new_state(),
    broker: broker,
    connection: None,
  )
  
  actor.start(state, handle_message)
}

/// Handle replication messages
fn handle_message(
  msg: ReplicationMessage,
  state: ReplicationState,
) -> actor.Next(ReplicationMessage, ReplicationState) {
  case msg {
    Start -> {
      case connect_and_start_replication(state) {
        Ok(new_state) -> actor.continue(new_state)
        Error(e) -> {
          io.println("Replication start failed: " <> e)
          actor.continue(state)
        }
      }
    }
    
    Stop -> {
      disconnect(state)
      actor.continue(ReplicationState(..state, connection: None))
    }
    
    XLogData(lsn, data) -> {
      case decode_message(data, state.decoder_state) {
        Ok(#(decoded, new_decoder_state)) -> {
          let new_state = ReplicationState(..state, decoder_state: new_decoder_state)
          
          case decoded {
            decoder.ChangeMessage(event) -> {
              publish_event(new_state, event)
            }
            _ -> Nil
          }
          
          actor.continue(new_state)
        }
        Error(e) -> {
          io.println("Decode error: " <> e)
          actor.continue(state)
        }
      }
    }
    
    PrimaryKeepalive(_lsn, reply_required) -> {
      // Send standby status update if required
      case reply_required {
        True -> send_standby_status_update(state)
        False -> Nil
      }
      actor.continue(state)
    }
  }
}

/// Connect to PostgreSQL and start logical replication
fn connect_and_start_replication(state: ReplicationState) -> Result(ReplicationState, String) {
  // FFI to epgsql for replication connection
  case epgsql_connect(state.config.replication_url) {
    Ok(conn) -> {
      // Start logical replication slot
      case start_replication_slot(conn, state.config) {
        Ok(_) -> {
          // Spawn a process to receive replication messages
          let receiver = spawn_replication_receiver(conn, self())
          Ok(ReplicationState(..state, connection: Some(conn)))
        }
        Error(e) -> {
          epgsql_close(conn)
          Error("Failed to start replication: " <> e)
        }
      }
    }
    Error(e) -> Error("Connection failed: " <> e)
  }
}

/// Disconnect from PostgreSQL
fn disconnect(state: ReplicationState) -> Nil {
  case state.connection {
    Some(conn) -> epgsql_close(conn)
    None -> Nil
  }
}

/// Publish a change event to the broker
fn publish_event(state: ReplicationState, event: ChangeEvent) -> Nil {
  process.send(state.broker, Publish(event))

  case #(state.config.queue_service_url, state.config.internal_secret) {
    #(Some(queue_url), Some(secret)) -> {
      let event_type = change_event.change_type_to_string(event.change_type)
      let record = case event.new_record {
        Some(new_record) -> change_event.record_to_json(new_record)
        None -> case event.old_record {
          Some(old_record) -> change_event.record_to_json(old_record)
          None -> json.null()
        }
      }
      let old_record = case event.old_record {
        Some(old) -> Some(change_event.record_to_json(old))
        None -> None
      }
      _ = webhook_dispatcher.dispatch_to_queue(
        queue_url,
        secret,
        event.schema,
        event.table,
        event_type,
        record,
        old_record,
      )
      Nil
    }
    _ -> Nil
  }
}

/// Send standby status update to server
fn send_standby_status_update(state: ReplicationState) -> Nil {
  case state.connection {
    Some(conn) -> {
      // FFI to send standby status
      epgsql_send_standby_status(conn)
    }
    None -> Nil
  }
}

/// Spawn a process to receive replication messages
fn spawn_replication_receiver(conn: Pid, parent: Subject(ReplicationMessage)) -> Pid {
  // FFI to spawn Erlang process for receiving
  spawn_replication_loop(conn, parent)
}

/// FFI: Connect to PostgreSQL using epgsql
@external(erlang, "epgsql", "connect")
fn epgsql_connect(url: String) -> Result(Pid, String)

/// FFI: Close epgsql connection
@external(erlang, "epgsql", "close")
fn epgsql_close(conn: Pid) -> Nil

/// FFI: Start logical replication slot
fn start_replication_slot(conn: Pid, config: Config) -> Result(Nil, String) {
  let slot = config.replication_slot
  let publication = config.publication_name
  epgsql_start_replication(conn, slot, publication)
}

@external(erlang, "indus_live_ffi", "start_replication")
fn epgsql_start_replication(
  conn: Pid,
  slot: String,
  publication: String,
) -> Result(Nil, String)

/// FFI: Send standby status update
@external(erlang, "indus_live_ffi", "send_standby_status")
fn epgsql_send_standby_status(conn: Pid) -> Nil

/// FFI: Spawn replication message receiver loop
@external(erlang, "indus_live_ffi", "spawn_replication_receiver")
fn spawn_replication_loop(conn: Pid, parent: Subject(ReplicationMessage)) -> Pid

/// Get the subject for the current actor
fn self() -> Subject(ReplicationMessage) {
  // This would be provided by the actor framework
  // For now, placeholder
  process.new_subject()
}
