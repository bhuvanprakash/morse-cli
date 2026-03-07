import { AuthError, IndusBaseError } from './errors.js';

export interface Session {
    access_token: string;
    refresh_token: string;
    expires_at?: number;
    user?: unknown;
}

export type FetchImpl = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface FetchClientOptions {
    baseUrl: string;
    anonKey: string;
    fetchImpl?: FetchImpl | undefined;
    persistSession?: boolean | undefined;
}

export class FetchClient {
    private baseUrl: string;
    private anonKey: string;
    private fetchImpl: FetchImpl;
    private persistSession: boolean;
    private accessToken: string | null = null;
    private refreshToken: string | null = null;
    private refreshPromise: Promise<Session | null> | null = null;

    constructor(options: FetchClientOptions) {
        this.baseUrl = options.baseUrl.replace(/\/$/, '');
        this.anonKey = options.anonKey;
        this.fetchImpl = options.fetchImpl ?? fetch;
        this.persistSession = options.persistSession ?? true;

        // Load session from storage if persistSession is enabled
        if (this.persistSession && typeof globalThis !== 'undefined' && globalThis.localStorage) {
            const savedSession = globalThis.localStorage.getItem('indusbase_session');
            if (savedSession) {
                try {
                    const session = JSON.parse(savedSession) as Session;
                    this.setTokens(session.access_token, session.refresh_token);
                } catch {
                    // Ignore invalid session
                }
            }
        }
    }

    setTokens(accessToken: string, refreshToken?: string): void {
        this.accessToken = accessToken;
        if (refreshToken) {
            this.refreshToken = refreshToken;
        }

        if (this.persistSession && typeof globalThis !== 'undefined' && globalThis.localStorage) {
            const session: Session = {
                access_token: accessToken,
                refresh_token: refreshToken ?? this.refreshToken ?? '',
            };
            globalThis.localStorage.setItem('indusbase_session', JSON.stringify(session));
        }
    }

    clearTokens(): void {
        this.accessToken = null;
        this.refreshToken = null;

        if (this.persistSession && typeof globalThis !== 'undefined' && globalThis.localStorage) {
            globalThis.localStorage.removeItem('indusbase_session');
        }
    }

    getAccessToken(): string | null {
        return this.accessToken;
    }

    getAnonKey(): string {
        return this.anonKey;
    }

    getBaseUrl(): string {
        return this.baseUrl;
    }

    async request<T = unknown>(
        path: string,
        options: RequestInit = {}
    ): Promise<{ data: T; response: Response }> {
        const url = `${this.baseUrl}${path}`;
        const headers = new Headers(options.headers);

        // Set default headers
        headers.set('apikey', this.anonKey);
        headers.set('Content-Type', 'application/json');

        // Add auth header if we have an access token
        if (this.accessToken) {
            headers.set('Authorization', `Bearer ${this.accessToken}`);
        }

        let response = await this.fetchImpl(url, {
            ...options,
            headers,
        });

        // Handle token expiration with automatic refresh
        if (response.status === 401 && this.refreshToken) {
            const refreshed = await this.refreshSession();
            if (refreshed) {
                headers.set('Authorization', `Bearer ${refreshed.access_token}`);
                response = await this.fetchImpl(url, {
                    ...options,
                    headers,
                });
            }
        }

        // Handle errors
        if (!response.ok) {
            const errorBody = await response.json().catch(() => ({})) as { error?: string; message?: string; code?: string };
            const errorMessage = errorBody.error ?? errorBody.message ?? `HTTP ${response.status}`;
            const errorCode = errorBody.code ?? 'REQUEST_ERROR';

            throw new IndusBaseError(
                errorMessage,
                errorCode,
                response.status,
                errorBody
            );
        }

        const data = (await response.json()) as T;
        return { data, response };
    }

    private async refreshSession(): Promise<Session | null> {
        if (this.refreshPromise) {
            return this.refreshPromise;
        }

        this.refreshPromise = this.doRefreshSession();

        try {
            const result = await this.refreshPromise;
            return result;
        } finally {
            this.refreshPromise = null;
        }
    }

    private async doRefreshSession(): Promise<Session | null> {
        if (!this.refreshToken) {
            return null;
        }

        try {
            const url = `${this.baseUrl}/auth/v1/token?grant_type=refresh_token`;
            const response = await this.fetchImpl(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': this.anonKey,
                },
                body: JSON.stringify({ refresh_token: this.refreshToken }),
            });

            if (!response.ok) {
                this.clearTokens();
                return null;
            }

            const result = await response.json() as { session: Session };
            if (result.session) {
                this.setTokens(result.session.access_token, result.session.refresh_token);
                return result.session;
            }

            return null;
        } catch (error) {
            this.clearTokens();
            throw new AuthError(
                error instanceof Error ? error.message : 'Failed to refresh session',
                'TOKEN_REFRESH_ERROR',
                401
            );
        }
    }
}
