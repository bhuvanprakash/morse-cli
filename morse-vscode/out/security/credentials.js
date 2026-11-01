"use strict";
/**
 * Secure Credential Storage
 *
 * Uses VS Code's built-in SecretStorage API for secure credential storage.
 * This ensures credentials are encrypted at rest by the OS.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CredentialManager = void 0;
const CREDENTIAL_KEYS = {
    AUTH_TOKEN: 'morse.authToken',
    REFRESH_TOKEN: 'morse.refreshToken',
    API_KEY: 'morse.apiKey',
    PROVIDER_CONFIGS: 'morse.providerConfigs',
    DEVICE_CODE: 'morse.deviceCode',
    SYNC_TOKEN: 'morse.syncToken',
};
class CredentialManager {
    secrets;
    constructor(context) {
        this.secrets = context.secrets;
    }
    /**
     * Store authentication token securely
     */
    async storeAuthToken(token) {
        await this.secrets.store(CREDENTIAL_KEYS.AUTH_TOKEN, token);
    }
    /**
     * Retrieve authentication token
     */
    async getAuthToken() {
        return await this.secrets.get(CREDENTIAL_KEYS.AUTH_TOKEN);
    }
    /**
     * Delete authentication token
     */
    async deleteAuthToken() {
        await this.secrets.delete(CREDENTIAL_KEYS.AUTH_TOKEN);
    }
    /**
     * Store refresh token
     */
    async storeRefreshToken(token) {
        await this.secrets.store(CREDENTIAL_KEYS.REFRESH_TOKEN, token);
    }
    /**
     * Retrieve refresh token
     */
    async getRefreshToken() {
        return await this.secrets.get(CREDENTIAL_KEYS.REFRESH_TOKEN);
    }
    /**
     * Delete refresh token
     */
    async deleteRefreshToken() {
        await this.secrets.delete(CREDENTIAL_KEYS.REFRESH_TOKEN);
    }
    /**
     * Store API key for direct CLI connection
     */
    async storeApiKey(apiKey) {
        await this.secrets.store(CREDENTIAL_KEYS.API_KEY, apiKey);
    }
    /**
     * Retrieve API key
     */
    async getApiKey() {
        return await this.secrets.get(CREDENTIAL_KEYS.API_KEY);
    }
    /**
     * Delete API key
     */
    async deleteApiKey() {
        await this.secrets.delete(CREDENTIAL_KEYS.API_KEY);
    }
    /**
     * Store provider configurations (encrypted)
     */
    async storeProviderConfigs(configs) {
        const encrypted = JSON.stringify(configs);
        await this.secrets.store(CREDENTIAL_KEYS.PROVIDER_CONFIGS, encrypted);
    }
    /**
     * Retrieve provider configurations
     */
    async getProviderConfigs() {
        const stored = await this.secrets.get(CREDENTIAL_KEYS.PROVIDER_CONFIGS);
        if (!stored)
            return [];
        try {
            return JSON.parse(stored);
        }
        catch {
            return [];
        }
    }
    /**
     * Store device code for CLI auth
     */
    async storeDeviceCode(deviceCode) {
        await this.secrets.store(CREDENTIAL_KEYS.DEVICE_CODE, deviceCode);
    }
    /**
     * Get stored device code
     */
    async getDeviceCode() {
        return await this.secrets.get(CREDENTIAL_KEYS.DEVICE_CODE);
    }
    /**
     * Store sync token for provider sync
     */
    async storeSyncToken(token) {
        await this.secrets.store(CREDENTIAL_KEYS.SYNC_TOKEN, token);
    }
    /**
     * Get sync token
     */
    async getSyncToken() {
        return await this.secrets.get(CREDENTIAL_KEYS.SYNC_TOKEN);
    }
    /**
     * Clear all stored credentials (logout)
     */
    async clearAll() {
        await Promise.all([
            this.deleteAuthToken(),
            this.deleteRefreshToken(),
            this.deleteApiKey(),
            this.secrets.delete(CREDENTIAL_KEYS.PROVIDER_CONFIGS),
            this.secrets.delete(CREDENTIAL_KEYS.DEVICE_CODE),
            this.secrets.delete(CREDENTIAL_KEYS.SYNC_TOKEN),
        ]);
    }
    /**
     * Check if user is authenticated
     */
    async isAuthenticated() {
        const token = await this.getAuthToken();
        return !!token;
    }
}
exports.CredentialManager = CredentialManager;
//# sourceMappingURL=credentials.js.map