import { ChangeEvent, ChangeEventType, ChannelState, EventCallback, RealtimeFilter, SubscriptionCallback } from './types.js';
import type { RealtimeClient } from './realtime-client.js';

interface EventHandler {
    event: ChangeEventType;
    filter: RealtimeFilter;
    callback: EventCallback<unknown>;
}

export class Channel {
    private client: RealtimeClient;
    private topic: string;
    private state: ChannelState = 'closed';
    private handlers: EventHandler[] = [];
    private subscriptionCallback: SubscriptionCallback | undefined;
    private joinRef: string | null = null;
    private config: { timeoutMs: number | undefined };

    constructor(client: RealtimeClient, topic: string, config: { timeoutMs?: number | undefined } = {}) {
        this.client = client;
        this.topic = topic;
        this.config = { timeoutMs: config.timeoutMs };
    }

    /**
     * Get the channel topic
     */
    getTopic(): string {
        return this.topic;
    }

    /**
     * Get the channel state
     */
    getState(): ChannelState {
        return this.state;
    }

    /**
     * Subscribe to an event
     */
    on<T = Record<string, unknown>>(
        event: ChangeEventType,
        filter: RealtimeFilter,
        callback: EventCallback<T>
    ): Channel {
        this.handlers.push({
            event,
            filter,
            callback: callback as EventCallback<unknown>,
        });
        return this;
    }

    /**
     * Subscribe to the channel
     */
    subscribe(callback?: SubscriptionCallback): Channel {
        this.subscriptionCallback = callback;
        this.state = 'joining';
        this.joinRef = this.generateRef();

        // Send join message
        this.client.send({
            topic: this.topic,
            event: 'phx_join',
            payload: {},
            ref: this.joinRef,
        });

        // Set timeout for join
        setTimeout(() => {
            if (this.state === 'joining') {
                this.state = 'errored';
                this.subscriptionCallback?.('errored', new Error('Join timeout'));
            }
        }, this.config.timeoutMs ?? 10000);

        return this;
    }

    /**
     * Unsubscribe from the channel
     */
    async unsubscribe(): Promise<{ error: Error | null }> {
        if (this.state === 'closed') {
            return { error: null };
        }

        this.state = 'leaving';

        this.client.send({
            topic: this.topic,
            event: 'phx_leave',
            payload: {},
            ref: this.generateRef(),
        });

        return new Promise((resolve) => {
            setTimeout(() => {
                this.state = 'closed';
                this.handlers = [];
                resolve({ error: null });
            }, 1000);
        });
    }

    /**
     * Internal method to handle incoming messages
     */
    _dispatch<T = Record<string, unknown>>(event: ChangeEvent<T>): void {
        for (const handler of this.handlers) {
            if (this.matchesFilter(handler, event)) {
                try {
                    handler.callback(event);
                } catch {
                    // Ignore callback errors
                }
            }
        }
    }

    /**
     * Internal method to handle state changes
     */
    _setState(state: ChannelState, err?: Error): void {
        this.state = state;
        this.subscriptionCallback?.(state, err);
    }

    /**
     * Get the current join ref
     */
    _getJoinRef(): string | null {
        return this.joinRef;
    }

    private matchesFilter<T>(handler: EventHandler, event: ChangeEvent<T>): boolean {
        // Check event type match
        if (handler.event !== '*' && handler.event !== event.eventType) {
            return false;
        }

        // Check schema match
        if (handler.filter.schema && handler.filter.schema !== event.schema) {
            return false;
        }

        // Check table match
        if (handler.filter.table && handler.filter.table !== event.table) {
            return false;
        }

        return true;
    }

    private generateRef(): string {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
}
