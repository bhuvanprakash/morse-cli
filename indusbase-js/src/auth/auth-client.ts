import { FetchClient } from '../lib/fetch.js';
import { AuthError } from '../lib/errors.js';
import {
    AuthChangeEvent,
    AuthResponse,
    AuthStateChangeCallback,
    CreateEnterpriseConnectionOptions,
    Session,
    SignInWithOAuthOptions,
    SignInWithOTPOptions,
    SignInWithPasswordOptions,
    SignUpOptions,
    User,
    UserUpdateOptions,
    VerifyOTPOptions,
} from './types.js';

export class AuthClient {
    private fetchClient: FetchClient;
    private listeners: Set<AuthStateChangeCallback> = new Set();

    constructor(fetchClient: FetchClient) {
        this.fetchClient = fetchClient;
    }

    /**
     * Sign up a new user with email and password
     */
    async signUp(options: SignUpOptions): Promise<AuthResponse> {
        const { data } = await this.fetchClient.request<{ user: User | null; session: Session | null }>(
            '/auth/v1/signup',
            {
                method: 'POST',
                body: JSON.stringify({
                    email: options.email,
                    password: options.password,
                    phone: options.phone,
                    data: options.data,
                }),
            }
        );

        if (data.session) {
            this.fetchClient.setTokens(data.session.access_token, data.session.refresh_token);
            this.notifyListeners('SIGNED_IN', data.session);
        }

        return { user: data.user, session: data.session };
    }

    /**
     * Sign in with email/phone and password
     */
    async signInWithPassword(options: SignInWithPasswordOptions): Promise<AuthResponse> {
        const { data } = await this.fetchClient.request<{ user: User | null; session: Session | null }>(
            '/auth/v1/token?grant_type=password',
            {
                method: 'POST',
                body: JSON.stringify({
                    email: options.email,
                    password: options.password,
                    phone: options.phone,
                }),
            }
        );

        if (data.session) {
            this.fetchClient.setTokens(data.session.access_token, data.session.refresh_token);
            this.notifyListeners('SIGNED_IN', data.session);
        }

        return { user: data.user, session: data.session };
    }

    /**
     * Sign in with OTP (magic link or SMS)
     */
    async signInWithOTP(options: SignInWithOTPOptions): Promise<{ success: boolean }> {
        const { data } = await this.fetchClient.request<{ success: boolean }>(
            '/auth/v1/otp',
            {
                method: 'POST',
                body: JSON.stringify({
                    email: options.email,
                    phone: options.phone,
                    ...options.options,
                }),
            }
        );

        return data;
    }

    /**
     * Verify an OTP token
     */
    async verifyOTP(options: VerifyOTPOptions): Promise<AuthResponse> {
        const { data } = await this.fetchClient.request<{ user: User | null; session: Session | null }>(
            '/auth/v1/verify',
            {
                method: 'POST',
                body: JSON.stringify({
                    email: options.email,
                    phone: options.phone,
                    token: options.token,
                    type: options.type,
                }),
            }
        );

        if (data.session) {
            this.fetchClient.setTokens(data.session.access_token, data.session.refresh_token);
            this.notifyListeners('SIGNED_IN', data.session);
        }

        return { user: data.user, session: data.session };
    }

    /**
     * Sign in with OAuth provider
     */
    async signInWithOAuth(options: SignInWithOAuthOptions): Promise<{ url: string; provider: string }> {
        const url = new URL('/auth/v1/authorize', this.fetchClient.getBaseUrl());
        url.searchParams.set('provider', options.provider);

        if (options.options?.redirectTo) {
            url.searchParams.set('redirect_to', options.options.redirectTo);
        }

        if (options.options?.scopes) {
            url.searchParams.set('scopes', options.options.scopes);
        }

        if (options.options?.queryParams) {
            for (const [key, value] of Object.entries(options.options.queryParams)) {
                url.searchParams.set(key, value);
            }
        }

        // If not skipping browser redirect, do it now
        if (!options.options?.skipBrowserRedirect && typeof window !== 'undefined') {
            window.location.href = url.toString();
        }

        return { url: url.toString(), provider: options.provider };
    }

    /**
     * Create an enterprise SSO connection (admin only).
     */
    async createEnterpriseConnection(options: CreateEnterpriseConnectionOptions): Promise<any> {
        const { data } = await this.fetchClient.request<any>('/auth/enterprise/connections', {
            method: 'POST',
            body: JSON.stringify(options),
        });
        return data;
    }

    /**
     * List enterprise SSO connections.
     */
    async listSSOConnections(): Promise<any> {
        const { data } = await this.fetchClient.request<any>('/auth/enterprise/connections', {
            method: 'GET',
        });
        return data;
    }

    /**
     * Start SP-initiated SSO flow for a connection slug.
     */
    async startSSO(slug: string, redirect = true): Promise<{ url: string }> {
        const url = new URL(`/auth/sso/${slug}/start`, this.fetchClient.getBaseUrl()).toString();
        if (redirect && typeof window !== 'undefined') {
            window.location.href = url;
        }
        return { url };
    }

    /**
     * Get the current user
     */
    async getUser(): Promise<{ user: User | null }> {
        try {
            const { data } = await this.fetchClient.request<{ user: User }>('/auth/v1/user', {
                method: 'GET',
            });
            return { user: data.user };
        } catch (error) {
            if (error instanceof AuthError && error.statusCode === 401) {
                return { user: null };
            }
            throw error;
        }
    }

    /**
     * Update the current user's data
     */
    async updateUser(updates: UserUpdateOptions): Promise<{ user: User | null }> {
        const { data } = await this.fetchClient.request<{ user: User }>('/auth/v1/user', {
            method: 'PUT',
            body: JSON.stringify(updates),
        });

        this.notifyListeners('USER_UPDATED', this.getSession());

        return { user: data.user };
    }

    /**
     * Sign out the current user
     */
    async signOut(): Promise<{ success: boolean }> {
        try {
            await this.fetchClient.request('/auth/v1/logout', {
                method: 'POST',
            });
        } catch {
            // Ignore errors during signout
        }

        this.fetchClient.clearTokens();
        this.notifyListeners('SIGNED_OUT', null);

        return { success: true };
    }

    /**
     * Get the current session
     */
    getSession(): Session | null {
        const accessToken = this.fetchClient.getAccessToken();
        if (!accessToken) {
            return null;
        }

        // Try to get full session from storage
        if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
            const savedSession = globalThis.localStorage.getItem('indusbase_session');
            if (savedSession) {
                try {
                    const session = JSON.parse(savedSession) as Session;
                    if (session.access_token === accessToken) {
                        return session;
                    }
                } catch {
                    // Invalid session
                }
            }
        }

        return null;
    }

    /**
     * Resend confirmation email
     */
    async resend(options: { email: string; type: 'signup' | 'email_change' }): Promise<{ success: boolean }> {
        const { data } = await this.fetchClient.request<{ success: boolean }>(
            '/auth/v1/resend',
            {
                method: 'POST',
                body: JSON.stringify({
                    email: options.email,
                    type: options.type,
                }),
            }
        );

        return data;
    }

    /**
     * Reset password for email
     */
    async resetPasswordForEmail(email: string, options?: { redirectTo?: string; captchaToken?: string }): Promise<{ success: boolean }> {
        const { data } = await this.fetchClient.request<{ success: boolean }>(
            '/auth/v1/recover',
            {
                method: 'POST',
                body: JSON.stringify({
                    email,
                    ...options,
                }),
            }
        );

        return data;
    }

    /**
     * Exchange an auth code for a session
     */
    async exchangeCodeForSession(code: string): Promise<AuthResponse> {
        const { data } = await this.fetchClient.request<{ user: User | null; session: Session | null }>(
            '/auth/v1/token?grant_type=authorization_code',
            {
                method: 'POST',
                body: JSON.stringify({ code }),
            }
        );

        if (data.session) {
            this.fetchClient.setTokens(data.session.access_token, data.session.refresh_token);
            this.notifyListeners('SIGNED_IN', data.session);
        }

        return { user: data.user, session: data.session };
    }

    /**
     * Subscribe to auth state changes
     */
    onAuthStateChange(callback: AuthStateChangeCallback): { data: { subscription: { unsubscribe: () => void } } } {
        this.listeners.add(callback);

        // Immediately notify with current state
        const session = this.getSession();
        if (session) {
            callback('SIGNED_IN', session);
        } else {
            callback('SIGNED_OUT', null);
        }

        return {
            data: {
                subscription: {
                    unsubscribe: () => {
                        this.listeners.delete(callback);
                    },
                },
            },
        };
    }

    private notifyListeners(event: AuthChangeEvent, session: Session | null): void {
        for (const listener of this.listeners) {
            try {
                listener(event, session);
            } catch {
                // Ignore listener errors
            }
        }
    }
}
