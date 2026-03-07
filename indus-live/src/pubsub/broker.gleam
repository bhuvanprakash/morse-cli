import gleam/dict.{type Dict}
import gleam/erlang/process.{type Subject, type Pid}
import gleam/int
import gleam/io
import gleam/list
import gleam/option.{type Option, None, Some}
import gleam/otp/actor.{type StartResult}
import gleam/string

import config.{type Config}
import wal/change_event.{type ChangeEvent}
import pubsub/subscription.{type Subscription, type WsMessage, EventMessage}
import pubsub/topic.{type Topic}

/// Broker messages
pub type BrokerMessage {
  Subscribe(Subscription)
  Unsubscribe(subscription_id: String)
  Publish(ChangeEvent)
  GetStats(reply_to: Subject(BrokerStats))
}

/// Broker statistics
pub type BrokerStats {
  BrokerStats(
    total_subscriptions: Int,
    subscriptions_per_topic: Dict(String, Int),
    events_published: Int,
    events_delivered: Int,
  )
}

/// Broker state
pub type BrokerState {
  BrokerState(
    subscriptions: Dict(String, Subscription),
    topic_index: Dict(String, List(String)),  // topic -> subscription_ids
    config: Config,
    stats: BrokerStats,
  )
}

/// Start the broker actor
pub fn start(config: Config) -> StartResult(BrokerMessage) {
  let state = BrokerState(
    subscriptions: dict.new(),
    topic_index: dict.new(),
    config: config,
    stats: BrokerStats(
      total_subscriptions: 0,
      subscriptions_per_topic: dict.new(),
      events_published: 0,
      events_delivered: 0,
    ),
  )
  
  actor.start(state, handle_message)
}

/// Handle broker messages
fn handle_message(
  msg: BrokerMessage,
  state: BrokerState,
) -> actor.Next(BrokerMessage, BrokerState) {
  case msg {
    Subscribe(sub) -> {
      let new_state = add_subscription(state, sub)
      actor.continue(new_state)
    }
    
    Unsubscribe(sub_id) -> {
      let new_state = remove_subscription(state, sub_id)
      actor.continue(new_state)
    }
    
    Publish(event) -> {
      let new_state = publish_event(state, event)
      actor.continue(new_state)
    }
    
    GetStats(reply_to) -> {
      process.send(reply_to, state.stats)
      actor.continue(state)
    }
  }
}

/// Add a subscription to the broker
fn add_subscription(state: BrokerState, sub: Subscription) -> BrokerState {
  let topic_str = subscription.topic_string(sub)
  
  // Check connection limit for this topic
  let current_count = case dict.get(state.stats.subscriptions_per_topic, topic_str) {
    Ok(n) -> n
    Error(_) -> 0
  }
  
  case current_count >= state.config.max_connections_per_topic {
    True -> {
      io.println("Max connections reached for topic: " <> topic_str)
      state
    }
    False -> {
      // Add to subscriptions
      let new_subs = dict.insert(state.subscriptions, sub.id, sub)
      
      // Update topic index
      let topic_subs = case dict.get(state.topic_index, topic_str) {
        Ok(subs) -> [sub.id, ..subs]
        Error(_) -> [sub.id]
      }
      let new_index = dict.insert(state.topic_index, topic_str, topic_subs)
      
      // Update stats
      let new_topic_counts = dict.insert(
        state.stats.subscriptions_per_topic,
        topic_str,
        current_count + 1,
      )
      let new_stats = BrokerStats(
        ..state.stats,
        total_subscriptions: state.stats.total_subscriptions + 1,
        subscriptions_per_topic: new_topic_counts,
      )
      
      BrokerState(..state, 
        subscriptions: new_subs,
        topic_index: new_index,
        stats: new_stats,
      )
    }
  }
}

/// Remove a subscription from the broker
fn remove_subscription(state: BrokerState, sub_id: String) -> BrokerState {
  case dict.get(state.subscriptions, sub_id) {
    Ok(sub) -> {
      let topic_str = subscription.topic_string(sub)
      
      // Remove from subscriptions
      let new_subs = dict.delete(state.subscriptions, sub_id)
      
      // Update topic index
      let new_index = case dict.get(state.topic_index, topic_str) {
        Ok(subs) -> {
          let filtered = list.filter(subs, fn(id) { id != sub_id })
          case filtered {
            [] -> dict.delete(state.topic_index, topic_str)
            _ -> dict.insert(state.topic_index, topic_str, filtered)
          }
        }
        Error(_) -> state.topic_index
      }
      
      // Update stats
      let new_topic_counts = case dict.get(state.stats.subscriptions_per_topic, topic_str) {
        Ok(n) -> dict.insert(state.stats.subscriptions_per_topic, topic_str, int.max(0, n - 1))
        Error(_) -> state.stats.subscriptions_per_topic
      }
      let new_stats = BrokerStats(
        ..state.stats,
        total_subscriptions: int.max(0, state.stats.total_subscriptions - 1),
        subscriptions_per_topic: new_topic_counts,
      )
      
      BrokerState(..state,
        subscriptions: new_subs,
        topic_index: new_index,
        stats: new_stats,
      )
    }
    Error(_) -> state
  }
}

/// Publish an event to matching subscribers
fn publish_event(state: BrokerState, event: ChangeEvent) -> BrokerState {
  let event_json = change_event.to_json(event)
  
  // Find matching subscriptions
  let matching_subs = find_matching_subscriptions(state, event)
  
  // Deliver to each subscriber
  let delivered_count = list.fold(matching_subs, 0, fn(count, sub) {
    case deliver_to_subscriber(sub, event_json) {
      True -> count + 1
      False -> count
    }
  })
  
  // Update stats
  let new_stats = BrokerStats(
    ..state.stats,
    events_published: state.stats.events_published + 1,
    events_delivered: state.stats.events_delivered + delivered_count,
  )
  
  BrokerState(..state, stats: new_stats)
}

/// Find all subscriptions matching an event
fn find_matching_subscriptions(
  state: BrokerState,
  event: ChangeEvent,
) -> List(Subscription) {
  // Iterate through all topic index entries
  state.topic_index
  |> dict.to_list
  |> list.fold([], fn(acc, #(_topic_str, sub_ids)) {
    list.fold(sub_ids, acc, fn(inner_acc, sub_id) {
      case dict.get(state.subscriptions, sub_id) {
        Ok(sub) -> {
          // Check if this subscription's topic matches the event
          case topic.matches(sub.topic, event) {
            True -> [sub, ..inner_acc]
            False -> inner_acc
          }
        }
        Error(_) -> inner_acc
      }
    })
  })
}

/// Deliver an event to a subscriber
fn deliver_to_subscriber(sub: Subscription, event_json: String) -> Bool {
  // Send message to subscriber's WebSocket handler
  process.send(sub.reply_to, EventMessage(event_json))
  True
}

/// Get broker statistics
pub fn get_stats(broker: Subject(BrokerMessage)) -> BrokerStats {
  process.call(broker, GetStats, 5000)
}
