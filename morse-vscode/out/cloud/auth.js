"use strict";
/**
 * Cloud Auth Service
 *
 * Handles JWT-based authentication with the cloud backend.
 * Supports login, logout, token refresh, and OAuth flows.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.CloudAuth = exports.AuthEventEmitter = void 0;
exports.createCloudAuth = createCloudAuth;
const vscode = __importStar(require("vscode"));
const https = __importStar(require("https"));
const types_1 = require("./types");
/**
 * Event emitter for auth state changes
 */
class AuthEventEmitter extends vscode.EventEmitter {
    constructor() {
        super();
    }
}
exports.AuthEventEmitter = AuthEventEmitter;
/**
 * CloudAuth handles authentication with the cloud backend
 */
class CloudAuth {
    baseUrl;
    apiKey;
    session = null;
    authState = { ...types_1.DEFAULT_AUTH_STATE };
    refreshTimer = null;
    eventEmitter;
    context = null;
    /**
     * Create a new CloudAuth instance
     */
    constructor(baseUrl, apiKey, eventEmitter) {
        this.baseUrl = baseUrl;
        this.apiKey = apiKey;
        this.eventEmitter = eventEmitter;
    }
    /**
     * Initialize the auth service with extension context
     */
    initialize(context) {
        this.context = context;
        this.loadSession();
    }
    /**
     * Authenticate user with email and password
     */
    async login(credentials) {
        this.updateAuthState({ isLoading: true, error: null });
        try {
            const response = await this.makeRequest('/auth/v1/token?grant_type=password', {
                method: 'POST',
                body: JSON.stringify({
                    email: credentials.email,
                    password: credentials.password,
                }),
            });
            if (!response.success || !response.data) {
                throw new Error(response.error || 'Authentication failed');
            }
            const { access_token, refresh_token, expires_in, user } = response.data;
            this.session = {
                accessToken: access_token,
                refreshToken: refresh_token,
                expiresAt: new Date(Date.now() + expires_in * 1000),
                userId: user.id,
                email: user.email,
            };
            await this.saveSession();
            this.scheduleTokenRefresh();
            const cloudUser = {
                id: user.id,
                email: user.email,
                plan: 'free',
            };
            this.updateAuthState({
                isAuthenticated: true,
                isLoading: false,
                user: cloudUser,
                session: this.session,
                error: null,
            });
            return cloudUser;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Login failed';
            this.updateAuthState({
                isLoading: false,
                error: errorMessage,
            });
            throw error;
        }
    }
    /**
     * Authenticate using OAuth provider
     */
    async loginWithOAuth(options) {
        this.updateAuthState({ isLoading: true, error: null });
        try {
            const response = await this.makeRequest('/auth/v1/device/authorize', {
                method: 'POST',
                body: JSON.stringify({
                    provider: options.provider,
                    device_code: this.generateDeviceCode(),
                    verification_uri: options.redirectUri || `${this.baseUrl}/auth/v1/device`,
                }),
            });
            if (!response.success || !response.data) {
                throw new Error(response.error || 'OAuth authorization failed');
            }
            return response.data.user_code;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'OAuth failed';
            this.updateAuthState({
                isLoading: false,
                error: errorMessage,
            });
            throw error;
        }
    }
    /**
     * Poll for OAuth token completion
     */
    async pollForToken(deviceCode) {
        return new Promise((resolve, reject) => {
            const poll = async () => {
                try {
                    const response = await this.makeRequest('/auth/v1/token', {
                        method: 'POST',
                        body: JSON.stringify({
                            device_code: deviceCode,
                            grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
                        }),
                    });
                    if (response.success && response.data) {
                        const { access_token, refresh_token, expires_in, user } = response.data;
                        this.session = {
                            accessToken: access_token,
                            refreshToken: refresh_token,
                            expiresAt: new Date(Date.now() + expires_in * 1000),
                            userId: user.id,
                            email: user.email,
                        };
                        await this.saveSession();
                        this.scheduleTokenRefresh();
                        const cloudUser = {
                            id: user.id,
                            email: user.email,
                            plan: 'free',
                        };
                        this.updateAuthState({
                            isAuthenticated: true,
                            isLoading: false,
                            user: cloudUser,
                            session: this.session,
                            error: null,
                        });
                        resolve(cloudUser);
                        return;
                    }
                    // Continue polling
                    setTimeout(poll, 5000);
                }
                catch {
                    // Continue polling on error
                    setTimeout(poll, 5000);
                }
            };
            // Set timeout for 5 minutes
            setTimeout(() => {
                reject(new Error('OAuth authentication timed out'));
            }, 5 * 60 * 1000);
            poll();
        });
    }
    /**
     * Refresh the current session token
     */
    async refreshToken() {
        if (!this.session?.refreshToken) {
            throw new Error('No session to refresh');
        }
        try {
            const response = await this.makeRequest('/auth/v1/token?grant_type=refresh_token', {
                method: 'POST',
                body: JSON.stringify({
                    refresh_token: this.session.refreshToken,
                    grant_type: 'refresh_token',
                }),
            });
            if (!response.success || !response.data) {
                // Clear invalid session
                await this.logout();
                throw new Error(response.error || 'Token refresh failed');
            }
            const { accessToken, refreshToken, expiresIn } = response.data;
            this.session = {
                ...this.session,
                accessToken,
                refreshToken,
                expiresAt: new Date(Date.now() + expiresIn * 1000),
            };
            await this.saveSession();
            this.scheduleTokenRefresh();
        }
        catch (error) {
            await this.logout();
            throw error;
        }
    }
    /**
     * Logout and clear the current session
     */
    async logout() {
        if (this.session?.accessToken) {
            try {
                await this.makeRequest('/auth/v1/logout', {
                    method: 'POST',
                });
            }
            catch {
                // Ignore logout errors
            }
        }
        this.clearRefreshTimer();
        this.session = null;
        await this.clearSession();
        this.updateAuthState({
            isAuthenticated: false,
            isLoading: false,
            user: null,
            session: null,
            error: null,
        });
    }
    /**
     * Get the current authenticated user
     */
    async getUser() {
        if (!this.isAuthenticated()) {
            throw new Error('Not authenticated');
        }
        // Check if token needs refresh
        if (this.session && this.shouldRefreshToken()) {
            await this.refreshToken();
        }
        const response = await this.makeRequest('/auth/v1/user', {
            method: 'GET',
        });
        if (!response.success || !response.data) {
            throw new Error(response.error || 'Failed to get user');
        }
        const user = {
            id: response.data.id,
            email: response.data.email,
            fullName: response.data.full_name,
            avatarUrl: response.data.avatar_url,
            plan: 'free',
        };
        this.updateAuthState({ user });
        return user;
    }
    /**
     * Check if user is authenticated
     */
    isAuthenticated() {
        if (!this.session) {
            return false;
        }
        return !this.isTokenExpired();
    }
    /**
     * Get the current session
     */
    getSession() {
        return this.session;
    }
    /**
     * Get the current access token
     */
    getAccessToken() {
        return this.session?.accessToken || '';
    }
    /**
     * Get current auth state
     */
    getAuthState() {
        return { ...this.authState };
    }
    /**
     * Subscribe to auth state changes
     */
    onAuthStateChanged(callback) {
        return this.eventEmitter.event(callback);
    }
    /**
     * Make authenticated request
     */
    async makeAuthenticatedRequest(path, options) {
        if (!this.isAuthenticated()) {
            return {
                success: false,
                error: 'Not authenticated',
                statusCode: 401,
            };
        }
        // Check if token needs refresh
        if (this.shouldRefreshToken()) {
            try {
                await this.refreshToken();
            }
            catch {
                return {
                    success: false,
                    error: 'Token refresh failed',
                    statusCode: 401,
                };
            }
        }
        return this.makeRequest(path, {
            ...options,
            headers: {
                Authorization: `Bearer ${this.getAccessToken()}`,
            },
        });
    }
    makeRequest(path, options) {
        return new Promise((resolve) => {
            const url = new URL(path, this.baseUrl);
            const isHttps = url.protocol === 'https:';
            const httpModule = isHttps ? https : require('http');
            const headers = {
                'Content-Type': 'application/json',
                apikey: this.apiKey,
                ...options.headers,
            };
            const requestOptions = {
                hostname: url.hostname,
                port: url.port || (isHttps ? 443 : 80),
                path: url.pathname + url.search,
                method: options.method,
                headers,
            };
            const req = httpModule.request(requestOptions, (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    const statusCode = res.statusCode || 500;
                    let parsedData;
                    let parseError;
                    try {
                        parsedData = JSON.parse(data);
                    }
                    catch {
                        parseError = 'Failed to parse response';
                    }
                    resolve({
                        success: statusCode >= 200 && statusCode < 300,
                        data: parsedData,
                        error: parseError || (statusCode >= 400 ? `Request failed with status ${statusCode}` : undefined),
                        statusCode,
                    });
                });
            });
            req.on('error', (error) => {
                resolve({
                    success: false,
                    error: error.message,
                    statusCode: 500,
                });
            });
            if (options.body) {
                req.write(options.body);
            }
            req.end();
        });
    }
    updateAuthState(partial) {
        this.authState = { ...this.authState, ...partial };
        this.eventEmitter.fire(this.authState);
    }
    isTokenExpired() {
        if (!this.session) {
            return true;
        }
        return new Date() >= this.session.expiresAt;
    }
    shouldRefreshToken() {
        if (!this.session) {
            return false;
        }
        // Refresh 5 minutes before expiry
        const refreshThreshold = new Date(this.session.expiresAt.getTime() - 5 * 60 * 1000);
        return new Date() >= refreshThreshold;
    }
    scheduleTokenRefresh() {
        this.clearRefreshTimer();
        if (!this.session) {
            return;
        }
        // Schedule refresh 5 minutes before expiry
        const refreshTime = new Date(this.session.expiresAt.getTime() - 5 * 60 * 1000);
        const delay = refreshTime.getTime() - Date.now();
        if (delay > 0) {
            this.refreshTimer = vscode.commands.registerCommand('morse.cloud.refreshToken', async () => {
                try {
                    await this.refreshToken();
                }
                catch (error) {
                    console.error('[CloudAuth] Token refresh failed:', error);
                }
            });
            // Use setTimeout as fallback since vscode commands need user action
            setTimeout(async () => {
                try {
                    await this.refreshToken();
                }
                catch (error) {
                    console.error('[CloudAuth] Token refresh failed:', error);
                }
            }, delay);
        }
    }
    clearRefreshTimer() {
        if (this.refreshTimer) {
            this.refreshTimer.dispose();
            this.refreshTimer = null;
        }
    }
    generateDeviceCode() {
        return `dc_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 15)}`;
    }
    getSessionKey() {
        return 'morse-cloud-session';
    }
    async saveSession() {
        if (!this.context || !this.session) {
            return;
        }
        await this.context.secrets.store(this.getSessionKey(), JSON.stringify(this.session));
    }
    async loadSession() {
        if (!this.context) {
            return;
        }
        try {
            const stored = await this.context.secrets.get(this.getSessionKey());
            if (stored) {
                const session = JSON.parse(stored);
                session.expiresAt = new Date(session.expiresAt);
                if (!this.isTokenExpired()) {
                    this.session = session;
                    this.scheduleTokenRefresh();
                    this.updateAuthState({
                        isAuthenticated: true,
                        user: {
                            id: session.userId,
                            email: session.email,
                            plan: 'free',
                        },
                        session,
                    });
                }
                else {
                    // Try to refresh expired token
                    try {
                        await this.refreshToken();
                    }
                    catch {
                        await this.clearSession();
                    }
                }
            }
        }
        catch (error) {
            console.error('[CloudAuth] Failed to load session:', error);
        }
    }
    async clearSession() {
        if (!this.context) {
            return;
        }
        try {
            await this.context.secrets.delete(this.getSessionKey());
        }
        catch {
            // Ignore errors
        }
    }
}
exports.CloudAuth = CloudAuth;
/**
 * Create a new auth service
 */
function createCloudAuth(baseUrl, apiKey) {
    const eventEmitter = new AuthEventEmitter();
    const auth = new CloudAuth(baseUrl, apiKey, eventEmitter);
    return { auth, eventEmitter };
}
//# sourceMappingURL=auth.js.map