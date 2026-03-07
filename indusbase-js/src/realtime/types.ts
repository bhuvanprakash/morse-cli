/**
 * Realtime change event types
 */
export type ChangeEventType = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

/**
 * Change event payload
 */
export interface ChangeEvent<T = Record<string, unknown>> {
    schema: string;
    table: string;
    commit_timestamp: string;
    eventType: ChangeEventType;
    new: T | null;
    old: T | null;
    errors: string[] | null;
}

/**
 * Channel connection state
 */
export type ChannelState =
    | 'closed'
    | 'errored'
    | 'joined'
    | 'joining'
    | 'leaving';

/**
 * Realtime channel configuration
 */
export interface ChannelConfig {
    ackTimeoutMs?: number;
    heartbeatIntervalMs?: number;
    timeoutMs?: number;
}

/**
 * Realtime channel options
 */
export interface RealtimeChannelOptions {
    config?: ChannelConfig;
}

/**
 * Filter for realtime events
 */
export interface RealtimeFilter {
    event?: ChangeEventType;
    schema?: string;
    table?: string;
    filter?: string;
}

/**
 * Event callback function
 */
export type EventCallback<T = Record<string, unknown>> = (payload: ChangeEvent<T>) => void;

/**
 * Subscription callback
 */
export type SubscriptionCallback = (status: ChannelState, err?: Error) => void;

/**
 * Realtime message from server
 */
export interface RealtimeMessage<T = Record<string, unknown>> {
    topic: string;
    event: string;
    payload: ChangeEvent<T> | { [key: string]: unknown };
    ref: string | null;
}

/**
 * Realtime channel interface
 */
export interface RealtimeChannel {
    topic: string;
    state: ChannelState;
    on: <T = Record<string, unknown>>(
        event: ChangeEventType,
        filter: RealtimeFilter,
        callback: EventCallback<T>
    ) => RealtimeChannel;
    subscribe: (callback?: SubscriptionCallback) => RealtimeChannel;
    unsubscribe: () => Promise<{ error: Error | null }>;
}
