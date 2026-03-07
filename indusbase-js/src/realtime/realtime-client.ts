import { RealtimeError } from '../lib/errors.js';
import { Channel } from './channel.js';
import { RealtimeChannelOptions, RealtimeMessage, ChangeEvent } from './types.js';

export interface RealtimeClientOptions {
    url: string;
    apiKey: string;
    transport?: 'websocket';
    heartbeatIntervalMs?: number;
    timeout?: number;
}

export class RealtimeClient {
    private url: string;
    private apiKey: string;
    private heartbeatIntervalMs: number;
    private ws: WebSocket | null = null;
    private channels: Map<string, Channel> = new Map();
    private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private isConnected = false;
    private messageQueue: RealtimeMessage<unknown>[] = [];
    private ref = 0;

    constructor(options: RealtimeClientOptions) {
        this.url = options.url;
        this.apiKey = options.apiKey;
        this.heartbeatIntervalMs = options.heartbeatIntervalMs ?? 30000;
    }

    /**
     * Create a new channel
     */
    channel(topic: string, options: RealtimeChannelOptions = {}): Channel {
        if (this.channels.has(topic)) {
            return this.channels.get(topic)!;
        }

        const channel = new Channel(this, topic, {
            timeoutMs: options.config?.timeoutMs,
        });
        this.channels.set(topic, channel);
        return channel;
    }

    /**
     * Connect to the realtime server
     */
    async connect(): Promise<void> {
        if (this.isConnected) {
            return;
        }

        return new Promise((resolve, reject) => {
            try {
                const wsUrl = `${this.url}/realtime/v1/websocket?apikey=${this.apiKey}&vsn=1.0.0`;
                this.ws = new WebSocket(wsUrl);

                this.ws.onopen = () => {
                    this.isConnected = true;
                    this.startPing();
                    this.flushMessageQueue();
                    resolve();
                };

                this.ws.onclose = () => {
                    this.isConnected = false;
                    this.stopPing();
                    this.scheduleReconnect();
                };

                this.ws.onerror = (error) => {
                    reject(new RealtimeError('WebSocket error', 'WS_ERROR', undefined, { error }));
                };

                this.ws.onmessage = (event) => {
                    this.handleMessage(event.data as string);
                };
            } catch (error) {
                reject(new RealtimeError(
                    error instanceof Error ? error.message : 'Failed to connect',
                    'CONNECTION_ERROR'
                ));
            }
        });
    }

    /**
     * Disconnect from the realtime server
     */
    disconnect(): void {
        this.stopPing();
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }

        this.isConnected = false;
        this.channels.clear();
        this.messageQueue = [];
    }

    /**
     * Remove a channel
     */
    async removeChannel(channel: Channel): Promise<{ error: Error | null }> {
        const topic = channel.getTopic();
        const result = await channel.unsubscribe();
        this.channels.delete(topic);
        return result;
    }

    /**
     * Get all channels
     */
    getChannels(): Channel[] {
        return Array.from(this.channels.values());
    }

    /**
     * Send a message to the server
     */
    send<T = unknown>(message: RealtimeMessage<T>): void {
        if (!this.isConnected || !this.ws) {
            this.messageQueue.push(message as RealtimeMessage<unknown>);
            return;
        }

        this.ws.send(JSON.stringify(message));
    }

    /**
     * Get connection state
     */
    isSocketConnected(): boolean {
        return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
    }

    private handleMessage(data: string): void {
        try {
            const message = JSON.parse(data) as RealtimeMessage<unknown>;
            const { topic, event, payload } = message;

            // Handle Phoenix protocol messages
            if (event === 'phx_reply') {
                const channel = this.channels.get(topic);
                if (channel) {
                    const responsePayload = payload as { status?: string };
                    if (responsePayload.status === 'ok') {
                        channel._setState('joined');
                    } else {
                        channel._setState('errored', new Error('Join failed'));
                    }
                }
                return;
            }

            if (event === 'phx_error') {
                const channel = this.channels.get(topic);
                if (channel) {
                    channel._setState('errored', new Error('Channel error'));
                }
                return;
            }

            if (event === 'phx_close') {
                const channel = this.channels.get(topic);
                if (channel) {
                    channel._setState('closed');
                }
                return;
            }

            // Dispatch to channel handlers
            const channel = this.channels.get(topic);
            if (channel && event !== 'heartbeat') {
                if (payload && typeof payload === 'object' && 'eventType' in payload) {
                    channel._dispatch(payload as ChangeEvent<unknown>);
                }
            }
        } catch (error) {
            // Ignore parse errors
            console.error('Failed to parse message:', error);
        }
    }

    private startPing(): void {
        this.stopPing();
        this.heartbeatTimer = setInterval(() => {
            this.send({
                topic: 'phoenix',
                event: 'heartbeat',
                payload: {},
                ref: this.makeRef(),
            });
        }, this.heartbeatIntervalMs);
    }

    private stopPing(): void {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }

    private scheduleReconnect(): void {
        if (this.reconnectTimer) {
            return;
        }

        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connect().catch(() => {
                // Retry will be scheduled by onclose handler
            });
        }, 5000);
    }

    private flushMessageQueue(): void {
        while (this.messageQueue.length > 0) {
            const message = this.messageQueue.shift();
            if (message) {
                this.send(message);
            }
        }
    }

    private makeRef(): string {
        this.ref++;
        return this.ref.toString();
    }
}
