import { FetchClient } from '../lib/fetch.js';
import { FunctionsError } from '../lib/errors.js';
import { FunctionResponse, InvokeOptions } from './types.js';

export class FunctionsClient {
    private fetchClient: FetchClient;

    constructor(fetchClient: FetchClient) {
        this.fetchClient = fetchClient;
    }

    /**
     * Invoke an edge function
     */
    async invoke<T = unknown>(functionName: string, options: InvokeOptions = {}): Promise<FunctionResponse<T>> {
        const method = options.method ?? 'POST';
        const headers: Record<string, string> = {
            ...options.headers,
        };

        // Build URL with query params
        let url = `/functions/v1/${functionName}`;
        if (options.query) {
            const params = new URLSearchParams();
            for (const [key, value] of Object.entries(options.query)) {
                params.set(key, String(value));
            }
            url += `?${params.toString()}`;
        }

        // Determine body
        let body: BodyInit | null = null;
        if (options.body) {
            if (typeof options.body === 'string') {
                body = options.body;
            } else if (options.body instanceof Blob || options.body instanceof ArrayBuffer || options.body instanceof FormData) {
                body = options.body;
            } else {
                body = JSON.stringify(options.body);
                if (!headers['Content-Type']) {
                    headers['Content-Type'] = 'application/json';
                }
            }
        }

        try {
            const { data } = await this.fetchClient.request<T>(url, {
                method,
                headers,
                body,
            });

            return { data, error: null };
        } catch (error) {
            throw new FunctionsError(
                error instanceof Error ? error.message : 'Function invocation failed',
                'FUNCTION_INVOCATION_ERROR',
                500,
                {},
                functionName
            );
        }
    }

    /**
     * Invoke a function with GET method (shorthand)
     */
    async get<T = unknown>(functionName: string, options?: Omit<InvokeOptions, 'method' | 'body'>): Promise<FunctionResponse<T>> {
        return this.invoke<T>(functionName, { ...options, method: 'GET' });
    }

    /**
     * Invoke a function with POST method (shorthand)
     */
    async post<T = unknown>(functionName: string, options?: Omit<InvokeOptions, 'method'>): Promise<FunctionResponse<T>> {
        return this.invoke<T>(functionName, { ...options, method: 'POST' });
    }

    /**
     * Invoke a function with PUT method (shorthand)
     */
    async put<T = unknown>(functionName: string, options?: Omit<InvokeOptions, 'method'>): Promise<FunctionResponse<T>> {
        return this.invoke<T>(functionName, { ...options, method: 'PUT' });
    }

    /**
     * Invoke a function with DELETE method (shorthand)
     */
    async delete<T = unknown>(functionName: string, options?: Omit<InvokeOptions, 'method'>): Promise<FunctionResponse<T>> {
        return this.invoke<T>(functionName, { ...options, method: 'DELETE' });
    }
}
