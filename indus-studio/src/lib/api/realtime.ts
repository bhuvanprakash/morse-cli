import { browser } from '$app/environment';
import { getRealtimeWebSocketUrl } from '$lib/utils/urls';

export interface RealtimeMessage {
    topic: string;
    action: 'INSERT' | 'UPDATE' | 'DELETE';
    schema: string;
    table: string;
    record?: Record<string, unknown>;
    old_record?: Record<string, unknown>;
    timestamp: string;
}

export interface SubscriptionHandler {
    (message: RealtimeMessage): void;
}

export interface Subscription {
    id: string;
    topic: string;
    handler: SubscriptionHandler;
}

export class RealtimeClient {
    private ws: WebSocket | null = null;
    private url: string;
    private subscriptions = new Map<string, Subscription>();
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 10;
    private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
    private heartbeatTimeout: ReturnType<typeof setTimeout> | null = null;
    private isConnecting = false;
    private messageQueue: string[] = [];

    // Event callbacks
    onConnect?: () => void;
    onDisconnect?: () => void;
    onError?: (error: Event) => void;

    constructor() {
        this.url = getRealtimeWebSocketUrl();
    }

    connect(accessToken?: string): void {
        if (!browser || this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
            return;
        }

        this.isConnecting = true;

        const wsUrl = accessToken
            ? `${this.url}?token=${accessToken}`
            : this.url;

        try {
            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = () => {
                this.isConnecting = false;
                this.reconnectAttempts = 0;
                this.startHeartbeat();
                this.flushQueue();
                this.onConnect?.();
            };

            this.ws.onmessage = (event) => {
                this.handleMessage(event.data);
            };

            this.ws.onclose = () => {
                this.isConnecting = false;
                this.stopHeartbeat();
                this.onDisconnect?.();
                this.scheduleReconnect(accessToken);
            };

            this.ws.onerror = (error) => {
                this.isConnecting = false;
                this.onError?.(error);
            };
        } catch (error) {
            this.isConnecting = false;
            this.scheduleReconnect(accessToken);
        }
    }

    disconnect(): void {
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

    subscribe(topic: string, handler: SubscriptionHandler): string {
        const id = `${topic}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        this.subscriptions.set(id, { id, topic, handler });

        // Send subscribe message if connected
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.send({
                action: 'subscribe',
                topic
            });
        } else {
            this.messageQueue.push(JSON.stringify({
                action: 'subscribe',
                topic
            }));
        }

        return id;
    }

    unsubscribe(id: string): void {
        const subscription = this.subscriptions.get(id);
        if (!subscription) return;

        this.subscriptions.delete(id);

        // Check if any other subscriptions for this topic
        const hasOtherSubs = Array.from(this.subscriptions.values())
            .some(s => s.topic === subscription.topic);

        if (!hasOtherSubs && this.ws?.readyState === WebSocket.OPEN) {
            this.send({
                action: 'unsubscribe',
                topic: subscription.topic
            });
        }
    }

    isConnected(): boolean {
        return this.ws?.readyState === WebSocket.OPEN;
    }

    getConnectionState(): number {
        return this.ws?.readyState ?? WebSocket.CLOSED;
    }

    private handleMessage(data: string): void {
        try {
            const message = JSON.parse(data);

            // Handle heartbeat pong
            if (message.type === 'pong') {
                this.resetHeartbeatTimeout();
                return;
            }

            // Handle realtime messages
            if (message.type === 'realtime') {
                const realtimeMsg: RealtimeMessage = message.payload;

                // Notify all matching subscribers
                for (const sub of this.subscriptions.values()) {
                    if (this.matchesTopic(sub.topic, realtimeMsg)) {
                        sub.handler(realtimeMsg);
                    }
                }
            }
        } catch (error) {
            console.error('Failed to parse realtime message:', error);
        }
    }

    private matchesTopic(subscriptionTopic: string, message: RealtimeMessage): boolean {
        // Topic format: schema:table:action or wildcard patterns
        // Examples: public:users:*, public:users:INSERT, *:*:*
        const [subSchema, subTable, subAction] = subscriptionTopic.split(':');

        const schemaMatch = subSchema === '*' || subSchema === message.schema;
        const tableMatch = subTable === '*' || subTable === message.table;
        const actionMatch = subAction === '*' || subAction === message.action;

        return schemaMatch && tableMatch && actionMatch;
    }

    private send(data: unknown): void {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        }
    }

    private flushQueue(): void {
        while (this.messageQueue.length > 0) {
            const msg = this.messageQueue.shift();
            if (msg && this.ws?.readyState === WebSocket.OPEN) {
                this.ws.send(msg);
            }
        }
    }

    private scheduleReconnect(accessToken?: string): void {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('Max reconnection attempts reached');
            return;
        }

        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
        this.reconnectAttempts++;

        this.reconnectTimeout = setTimeout(() => {
            this.connect(accessToken);
        }, delay);
    }

    private startHeartbeat(): void {
        // Send ping every 30 seconds
        this.heartbeatInterval = setInterval(() => {
            this.send({ type: 'ping' });

            // Set timeout for pong response (10 seconds)
            this.heartbeatTimeout = setTimeout(() => {
                console.warn('Heartbeat timeout - reconnecting');
                this.ws?.close();
            }, 10000);
        }, 30000);
    }

    private stopHeartbeat(): void {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
        this.resetHeartbeatTimeout();
    }

    private resetHeartbeatTimeout(): void {
        if (this.heartbeatTimeout) {
            clearTimeout(this.heartbeatTimeout);
            this.heartbeatTimeout = null;
        }
    }
}

// Singleton instance
export const realtimeClient = new RealtimeClient();

// Helper for table subscriptions
export function subscribeToTable(
    schema: string,
    table: string,
    handler: SubscriptionHandler,
    action?: 'INSERT' | 'UPDATE' | 'DELETE'
): string {
    const topic = `${schema}:${table}:${action ?? '*'}`;
    return realtimeClient.subscribe(topic, handler);
}
