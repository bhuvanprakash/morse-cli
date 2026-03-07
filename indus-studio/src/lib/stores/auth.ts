import { browser } from '$app/environment';
import { goto } from '$app/navigation';
import { apiClient, authApi, type User } from '$api/client';

// Auth state using Svelte 5 runes
class AuthStore {
    // State
    user = $state<User | null>(null);
    accessToken = $state<string | null>(null);
    refreshToken = $state<string | null>(null);
    loading = $state(false);
    error = $state<string | null>(null);

    // Derived state
    isAuthenticated = $derived(!!this.accessToken && !!this.user);

    constructor() {
        if (browser) {
            this.loadFromStorage();
        }
    }

    setSession(user: User, accessToken: string, refreshToken: string): void {
        this.user = user;
        this.accessToken = accessToken;
        this.refreshToken = refreshToken;
        this.error = null;

        apiClient.setTokens(accessToken, refreshToken);

        if (browser) {
            localStorage.setItem('user', JSON.stringify(user));
            localStorage.setItem('access_token', accessToken);
            localStorage.setItem('refresh_token', refreshToken);
        }
    }

    loadFromStorage(): void {
        if (!browser) return;

        try {
            const userJson = localStorage.getItem('user');
            const access = localStorage.getItem('access_token');
            const refresh = localStorage.getItem('refresh_token');

            if (userJson && access && refresh) {
                this.user = JSON.parse(userJson);
                this.accessToken = access;
                this.refreshToken = refresh;
                apiClient.setTokens(access, refresh);
            }
        } catch (e) {
            console.error('Failed to load auth from storage:', e);
            this.signOut();
        }
    }

    async signOut(): Promise<void> {
        try {
            await authApi.logout();
        } catch (e) {
            // Ignore errors on logout
        } finally {
            this.clearSession();
            if (browser) {
                goto('/login');
            }
        }
    }

    clearSession(): void {
        this.user = null;
        this.accessToken = null;
        this.refreshToken = null;
        this.error = null;

        apiClient.clearTokens();

        if (browser) {
            localStorage.removeItem('user');
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
        }
    }

    async login(email: string, password: string): Promise<boolean> {
        this.loading = true;
        this.error = null;

        try {
            const response = await authApi.login({ email, password });
            this.setSession(response.user, response.access_token, response.refresh_token);
            return true;
        } catch (err: unknown) {
            const error = err as { message?: string };
            this.error = error.message || 'Login failed';
            return false;
        } finally {
            this.loading = false;
        }
    }

    async signup(email: string, password: string, metadata?: Record<string, unknown>): Promise<boolean> {
        this.loading = true;
        this.error = null;

        try {
            const response = await authApi.signup({ email, password, metadata });
            this.setSession(response.user, response.access_token, response.refresh_token);
            return true;
        } catch (err: unknown) {
            const error = err as { message?: string };
            this.error = error.message || 'Signup failed';
            return false;
        } finally {
            this.loading = false;
        }
    }

    async fetchUser(): Promise<void> {
        if (!this.isAuthenticated) return;

        try {
            const user = await authApi.getUser();
            this.user = user;
            if (browser) {
                localStorage.setItem('user', JSON.stringify(user));
            }
        } catch (err) {
            console.error('Failed to fetch user:', err);
        }
    }

    googleLogin(redirectTo: string = '/'): void {
        authApi.googleLogin(redirectTo);
    }
}

// Export singleton instance
export const auth = new AuthStore();

// Legacy Svelte store compatibility (if needed)
import { writable, derived } from 'svelte/store';

function createAuthWritable() {
    const { subscribe, set } = writable(auth);

    // Sync with runes-based store
    $effect(() => {
        set(auth);
    });

    return { subscribe };
}

export const authStore = createAuthWritable();
export const isAuthenticated = derived(authStore, $auth => $auth.isAuthenticated);
export const currentUser = derived(authStore, $auth => $auth.user);
