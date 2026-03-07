import { FetchClient } from './lib/fetch.js';
import { AuthClient } from './auth/auth-client.js';
import { QueryClient } from './query/query-client.js';
import { RealtimeClient } from './realtime/realtime-client.js';
import { StorageClient } from './storage/storage-client.js';
import { FunctionsClient } from './functions/functions-client.js';
import { NotifyClient } from './notify/notify-client.js';
import { ConfigClient } from './config/config-client.js';
import { BillingClient } from './billing/billing-client.js';

export interface IndusBaseClientOptions {
    /**
     * The IndusBase API URL (e.g., https://your-project.indusbase.io)
     */
    url: string;

    /**
     * The anonymous/public API key for your project
     */
    anonKey: string;

    /**
     * Whether to persist the session in localStorage (default: true)
     */
    persistSession?: boolean;

    /**
     * Custom fetch implementation (for Node.js, React Native, etc.)
     */
    fetch?: typeof fetch;

    /**
     * Realtime/WebSocket configuration
     */
    realtime?: {
        url?: string;
    };
}

export class IndusBaseClient {
    /**
     * Authentication client
     */
    readonly auth: AuthClient;

    /**
     * Database query client
     */
    readonly db: QueryClient;

    /**
     * Storage client
     */
    readonly storage: StorageClient;

    /**
     * Realtime client
     */
    readonly realtime: RealtimeClient;

    /**
     * Edge functions client
     */
    readonly functions: FunctionsClient;

    /**
     * Notifications client
     */
    readonly notify: NotifyClient;

    /**
     * Feature flags/config client
     */
    readonly config: ConfigClient;

    /**
     * Billing and usage client
     */
    readonly billing: BillingClient;

    private fetchClient: FetchClient;

    constructor(options: IndusBaseClientOptions) {
        const baseUrl = options.url.replace(/\/$/, '');

        this.fetchClient = new FetchClient({
            baseUrl,
            anonKey: options.anonKey,
            fetchImpl: options.fetch,
            persistSession: options.persistSession ?? true,
        });

        this.auth = new AuthClient(this.fetchClient);
        this.db = new QueryClient(this.fetchClient);
        this.storage = new StorageClient(this.fetchClient);
        this.functions = new FunctionsClient(this.fetchClient);
        this.notify = new NotifyClient(this.fetchClient);
        this.config = new ConfigClient(this.fetchClient);
        this.billing = new BillingClient(this.fetchClient);

        // Initialize realtime with WebSocket URL
        const realtimeUrl = options.realtime?.url ?? baseUrl.replace(/^http/, 'ws');
        this.realtime = new RealtimeClient({
            url: realtimeUrl,
            apiKey: options.anonKey,
        });
    }

    /**
     * Get the base URL
     */
    getBaseUrl(): string {
        return this.fetchClient.getBaseUrl();
    }

    /**
     * Get the anonymous key
     */
    getAnonKey(): string {
        return this.fetchClient.getAnonKey();
    }

    /**
     * Create a new IndusBase client
     */
    static createClient(url: string, anonKey: string, options?: Omit<IndusBaseClientOptions, 'url' | 'anonKey'>): IndusBaseClient {
        return new IndusBaseClient({
            url,
            anonKey,
            ...options,
        });
    }
}

/**
 * Create a new IndusBase client
 * 
 * @param url - Your IndusBase project URL
 * @param anonKey - Your IndusBase anonymous/public API key
 * @param options - Additional client options
 * 
 * @example
 * ```typescript
 * import { createClient } from 'indusbase-js';
 * 
 * const client = createClient(
 *   'https://your-project.indusbase.io',
 *   'your-anon-key'
 * );
 * ```
 */
export function createClient(
    url: string,
    anonKey: string,
    options?: Omit<IndusBaseClientOptions, 'url' | 'anonKey'>
): IndusBaseClient {
    return new IndusBaseClient({
        url,
        anonKey,
        ...options,
    });
}
