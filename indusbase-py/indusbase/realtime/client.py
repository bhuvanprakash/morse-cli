"""
Realtime client for IndusBase.

Provides WebSocket-based real-time subscriptions for database changes.
"""

import asyncio
import json
from typing import Any, Callable, Dict, List, Optional
import websockets


class RealtimeChannel:
    """
    A real-time channel for subscribing to database changes.
    
    Allows listening to INSERT, UPDATE, DELETE events on tables.
    """

    def __init__(
        self,
        websocket: Any,
        topic: str,
        event: str = "*",
    ):
        """
        Initialize the realtime channel.

        Args:
            websocket: The WebSocket connection
            topic: The topic to subscribe to (e.g., "table:users")
            event: The event type (*, INSERT, UPDATE, DELETE)
        """
        self._ws = websocket
        self._topic = topic
        self._event = event
        self._callbacks: List[Callable] = []

    def on(self, event: str, callback: Callable) -> None:
        """
        Register a callback for a specific event.

        Args:
            event: Event type (INSERT, UPDATE, DELETE, or *)
            callback: Callback function
        """
        self._callbacks.append({"event": event, "callback": callback})

    async def subscribe(self) -> None:
        """
        Subscribe to the channel.
        """
        if self._ws is None:
            raise RuntimeError("WebSocket connection not established")
        await self._ws.send(json.dumps({
            "event": "phx_join",
            "topic": self._topic,
            "payload": {"event": self._event},
            "ref": "1",
        }))

    async def unsubscribe(self) -> None:
        """
        Unsubscribe from the channel.
        """
        if self._ws is None:
            return
        await self._ws.send(json.dumps({
            "event": "phx_leave",
            "topic": self._topic,
            "payload": {},
            "ref": "1",
        }))


class AsyncRealtimeClient:
    """
    Asynchronous realtime client for IndusBase.
    
    Provides WebSocket connections for:
    - Listening to database changes
    - Real-time updates
    - Presence and broadcast
    """

    def __init__(self, http_client: Any):
        """
        Initialize the realtime client.

        Args:
            http_client: The HTTP client for API calls
        """
        self._http = http_client
        self._ws: Optional[websockets.WebSocketClientProtocol] = None
        self._channels: Dict[str, RealtimeChannel] = {}

    async def connect(self) -> None:
        """
        Establish WebSocket connection.
        """
        ws_url = self._http.url.rstrip("/").replace("http://", "ws://").replace("https://", "wss://")
        self._ws = await websockets.connect(f"{ws_url}/realtime/v1")

    async def disconnect(self) -> None:
        """
        Close WebSocket connection.
        """
        if self._ws is not None:
            await self._ws.close()
            self._ws = None

    def channel(
        self,
        topic: str,
        event: str = "*",
    ) -> RealtimeChannel:
        """
        Create a realtime channel.

        Args:
            topic: The topic to subscribe to (e.g., "table:users")
            event: The event type

        Returns:
            RealtimeChannel: A channel for the topic
        """
        channel = RealtimeChannel(self._ws, topic, event)
        self._channels[topic] = channel
        return channel

    async def subscribe(
        self,
        table: str,
        callback: Callable,
        filter: Optional[str] = None,
    ) -> RealtimeChannel:
        """
        Subscribe to database changes on a table.

        Args:
            table: The table name
            callback: Callback function for updates
            filter: Optional filter string

        Returns:
            RealtimeChannel: The subscription channel

        Example:
            >>> async def on_insert(data):
            ...     print(f"New row: {data}")
            >>> channel = await client.realtime.subscribe("users", on_insert)
        """
        topic = f"table:{table}"
        if filter:
            topic = f"{topic}:{filter}"
        channel = self.channel(topic)
        channel.on("*", callback)
        await channel.subscribe()
        return channel

    async def unsubscribe(self, channel: RealtimeChannel) -> None:
        """
        Unsubscribe from a channel.

        Args:
            channel: The channel to unsubscribe from
        """
        await channel.unsubscribe()
        self._channels.pop(channel._topic, None)

    async def listen(self) -> None:
        """
        Start listening for messages.
        """
        if self._ws is None:
            await self.connect()
        if self._ws is None:
            return
        async for message in self._ws:
            payload = json.loads(message)
            topic = payload.get("topic")
            if topic in self._channels:
                for cb in self._channels[topic]._callbacks:
                    event = cb.get("event")
                    if event == "*" or event == payload.get("event"):
                        callback = cb["callback"]
                        result = callback(payload.get("payload"))
                        if asyncio.iscoroutine(result):
                            await result

    # Presence features
    async def track(
        self,
        channel: str,
        payload: Dict[str, Any],
    ) -> None:
        """
        Track presence in a channel.

        Args:
            channel: Channel name
            payload: Presence data
        """
        if self._ws is None:
            await self.connect()
        await self._ws.send(json.dumps({"event": "presence", "topic": channel, "payload": payload, "ref": "1"}))

    async def untrack(self, channel: str) -> None:
        """
        Untrack presence in a channel.

        Args:
            channel: Channel name
        """
        if self._ws is None:
            return
        await self._ws.send(json.dumps({"event": "presence_leave", "topic": channel, "payload": {}, "ref": "1"}))

    # Broadcast features
    async def broadcast(
        self,
        channel: str,
        event: str,
        payload: Dict[str, Any],
    ) -> None:
        """
        Broadcast a message to a channel.

        Args:
            channel: Channel name
            event: Event name
            payload: Message payload
        """
        if self._ws is None:
            await self.connect()
        await self._ws.send(json.dumps({"event": event, "topic": channel, "payload": payload, "ref": "1"}))
