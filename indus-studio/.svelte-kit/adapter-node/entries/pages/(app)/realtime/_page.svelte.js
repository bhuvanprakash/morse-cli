import { i as ssr_context, a as attr_class, e as escape_html, d as ensure_array_like, s as stringify } from "../../../../chunks/index2.js";
import "clsx";
import { B as Button } from "../../../../chunks/Button.js";
import { B as Badge } from "../../../../chunks/Badge.js";
import "../../../../chunks/toast.js";
import { g as getRealtimeWebSocketUrl } from "../../../../chunks/urls.js";
import { a as auth } from "../../../../chunks/auth.js";
function onDestroy(fn) {
  /** @type {SSRContext} */
  ssr_context.r.on_destroy(fn);
}
class RealtimeClient {
  ws = null;
  url;
  subscriptions = /* @__PURE__ */ new Map();
  reconnectAttempts = 0;
  maxReconnectAttempts = 10;
  reconnectTimeout = null;
  heartbeatInterval = null;
  heartbeatTimeout = null;
  isConnecting = false;
  messageQueue = [];
  // Event callbacks
  onConnect;
  onDisconnect;
  onError;
  constructor() {
    this.url = getRealtimeWebSocketUrl();
  }
  connect(accessToken) {
    {
      return;
    }
  }
  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.reconnectAttempts = 0;
  }
  subscribe(topic, handler) {
    const id = `${topic}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.subscriptions.set(id, { id, topic, handler });
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send({
        action: "subscribe",
        topic
      });
    } else {
      this.messageQueue.push(JSON.stringify({
        action: "subscribe",
        topic
      }));
    }
    return id;
  }
  unsubscribe(id) {
    const subscription = this.subscriptions.get(id);
    if (!subscription) return;
    this.subscriptions.delete(id);
    const hasOtherSubs = Array.from(this.subscriptions.values()).some((s) => s.topic === subscription.topic);
    if (!hasOtherSubs && this.ws?.readyState === WebSocket.OPEN) {
      this.send({
        action: "unsubscribe",
        topic: subscription.topic
      });
    }
  }
  isConnected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }
  getConnectionState() {
    return this.ws?.readyState ?? WebSocket.CLOSED;
  }
  handleMessage(data) {
    try {
      const message = JSON.parse(data);
      if (message.type === "pong") {
        this.resetHeartbeatTimeout();
        return;
      }
      if (message.type === "realtime") {
        const realtimeMsg = message.payload;
        for (const sub of this.subscriptions.values()) {
          if (this.matchesTopic(sub.topic, realtimeMsg)) {
            sub.handler(realtimeMsg);
          }
        }
      }
    } catch (error) {
      console.error("Failed to parse realtime message:", error);
    }
  }
  matchesTopic(subscriptionTopic, message) {
    const [subSchema, subTable, subAction] = subscriptionTopic.split(":");
    const schemaMatch = subSchema === "*" || subSchema === message.schema;
    const tableMatch = subTable === "*" || subTable === message.table;
    const actionMatch = subAction === "*" || subAction === message.action;
    return schemaMatch && tableMatch && actionMatch;
  }
  send(data) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }
  flushQueue() {
    while (this.messageQueue.length > 0) {
      const msg = this.messageQueue.shift();
      if (msg && this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(msg);
      }
    }
  }
  scheduleReconnect(accessToken) {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("Max reconnection attempts reached");
      return;
    }
    const delay = Math.min(1e3 * Math.pow(2, this.reconnectAttempts), 3e4);
    this.reconnectAttempts++;
    this.reconnectTimeout = setTimeout(() => {
      this.connect(accessToken);
    }, delay);
  }
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.send({ type: "ping" });
      this.heartbeatTimeout = setTimeout(() => {
        console.warn("Heartbeat timeout - reconnecting");
        this.ws?.close();
      }, 1e4);
    }, 3e4);
  }
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    this.resetHeartbeatTimeout();
  }
  resetHeartbeatTimeout() {
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
  }
}
const realtimeClient = new RealtimeClient();
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let events = [];
    let selectedTopic = "public:users:*";
    let subscriptionId = null;
    const topics = [
      "public:users:*",
      "public:orders:*",
      "public:products:*",
      "*:*:*"
    ];
    function handleRealtimeMessage(message) {
      events = [
        {
          id: `${Date.now()}_${Math.random()}`,
          timestamp: /* @__PURE__ */ new Date(),
          message
        },
        ...events
      ].slice(0, 100);
    }
    function connect() {
      if (subscriptionId) {
        realtimeClient.unsubscribe(subscriptionId);
        subscriptionId = null;
      }
      realtimeClient.connect(auth.accessToken || void 0);
      subscriptionId = realtimeClient.subscribe(selectedTopic, handleRealtimeMessage);
    }
    function disconnect() {
      if (subscriptionId) {
        realtimeClient.unsubscribe(subscriptionId);
        subscriptionId = null;
      }
      realtimeClient.disconnect();
    }
    function clearEvents() {
      events = [];
    }
    function getEventColor(action) {
      switch (action) {
        case "INSERT":
          return "success";
        case "UPDATE":
          return "primary";
        case "DELETE":
          return "danger";
        default:
          return "default";
      }
    }
    onDestroy(() => {
      disconnect();
    });
    $$renderer2.push(`<div class="space-y-6"><div class="flex items-center justify-between"><div><h1 class="text-2xl font-bold text-surface-12">Realtime</h1> <p class="text-surface-10 mt-1">Live feed of database changes</p></div> <div class="flex items-center gap-2"><div class="flex items-center gap-2 mr-4"><span${attr_class(`w-2 h-2 rounded-full ${stringify("bg-red-500")}`)}></span> <span class="text-sm text-surface-10">${escape_html("Disconnected")}</span></div> `);
    $$renderer2.select(
      {
        value: selectedTopic,
        class: "px-3 py-2 bg-surface-2 border border-surface-6 rounded-md text-sm",
        onchange: () => {
          disconnect();
          connect();
        }
      },
      ($$renderer3) => {
        $$renderer3.push(`<!--[-->`);
        const each_array = ensure_array_like(topics);
        for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
          let topic = each_array[$$index];
          $$renderer3.option({ value: topic }, ($$renderer4) => {
            $$renderer4.push(`${escape_html(topic)}`);
          });
        }
        $$renderer3.push(`<!--]-->`);
      }
    );
    $$renderer2.push(` `);
    Button($$renderer2, {
      variant: "secondary",
      size: "sm",
      onclick: clearEvents,
      children: ($$renderer3) => {
        $$renderer3.push(`<!---->Clear`);
      }
    });
    $$renderer2.push(`<!----></div></div> <div class="bg-surface-2 rounded-lg border border-surface-6 overflow-hidden"><div class="px-4 py-2 bg-surface-3 border-b border-surface-6"><span class="text-sm font-medium text-surface-12">Events (${escape_html(events.length)})</span></div> <div class="divide-y divide-surface-6 max-h-[600px] overflow-auto">`);
    if (events.length === 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="p-8 text-center text-surface-10"><p>No events yet. Waiting for database changes...</p></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<!--[-->`);
      const each_array_1 = ensure_array_like(events);
      for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
        let event = each_array_1[$$index_1];
        $$renderer2.push(`<div class="p-4 hover:bg-surface-1 transition-colors"><div class="flex items-center justify-between"><div class="flex items-center gap-3">`);
        Badge($$renderer2, {
          variant: getEventColor(event.message.action),
          children: ($$renderer3) => {
            $$renderer3.push(`<!---->${escape_html(event.message.action)}`);
          }
        });
        $$renderer2.push(`<!----> <span class="text-surface-12 font-medium">${escape_html(event.message.schema)}.${escape_html(event.message.table)}</span></div> <span class="text-xs text-surface-10">${escape_html(event.timestamp.toLocaleTimeString())}</span></div> `);
        if (event.message.record) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<div class="mt-2 p-2 bg-surface-1 rounded text-xs font-mono text-surface-11 overflow-x-auto"><pre>${escape_html(JSON.stringify(event.message.record, null, 2))}</pre></div>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--></div>`);
      }
      $$renderer2.push(`<!--]-->`);
    }
    $$renderer2.push(`<!--]--></div></div></div>`);
  });
}
export {
  _page as default
};
