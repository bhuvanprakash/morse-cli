/**
 * Secure Credential Storage
 * 
 * Uses VS Code's built-in SecretStorage API for secure credential storage.
 * This ensures credentials are encrypted at rest by the OS.
 */

import * as vscode from 'vscode';

const CREDENTIAL_KEYS = {
    AUTH_TOKEN: 'morse.authToken',
    REFRESH_TOKEN: 'morse.refreshToken',
    API_KEY: 'morse.apiKey',
    PROVIDER_CONFIGS: 'morse.providerConfigs',
    DEVICE_CODE: 'morse.deviceCode',
    SYNC_TOKEN: 'morse.syncToken',
} as const;

export class CredentialManager {
    private secrets: vscode.SecretStorage;

    constructor(context: vscode.ExtensionContext) {
        this.secrets = context.secrets;
    }

    /**
     * Store authentication token securely
     */
    async storeAuthToken(token: string): Promise<void> {
        await this.secrets.store(CREDENTIAL_KEYS.AUTH_TOKEN, token);
    }

    /**
     * Retrieve authentication token
     */
    async getAuthToken(): Promise<string | undefined> {
        return await this.secrets.get(CREDENTIAL_KEYS.AUTH_TOKEN);
    }

    /**
     * Delete authentication token
     */
    async deleteAuthToken(): Promise<void> {
        await this.secrets.delete(CREDENTIAL_KEYS.AUTH_TOKEN);
    }

    /**
     * Store refresh token
     */
    async storeRefreshToken(token: string): Promise<void> {
        await this.secrets.store(CREDENTIAL_KEYS.REFRESH_TOKEN, token);
    }

    /**
     * Retrieve refresh token
     */
    async getRefreshToken(): Promise<string | undefined> {
        return await this.secrets.get(CREDENTIAL_KEYS.REFRESH_TOKEN);
    }

    /**
     * Delete refresh token
     */
    async deleteRefreshToken(): Promise<void> {
        await this.secrets.delete(CREDENTIAL_KEYS.REFRESH_TOKEN);
    }

    /**
     * Store API key for direct CLI connection
     */
    async storeApiKey(apiKey: string): Promise<void> {
        await this.secrets.store(CREDENTIAL_KEYS.API_KEY, apiKey);
    }

    /**
     * Retrieve API key
     */
    async getApiKey(): Promise<string | undefined> {
        return await this.secrets.get(CREDENTIAL_KEYS.API_KEY);
    }

    /**
     * Delete API key
     */
    async deleteApiKey(): Promise<void> {
        await this.secrets.delete(CREDENTIAL_KEYS.API_KEY);
    }

    /**
     * Store provider configurations (encrypted)
     */
    async storeProviderConfigs(configs: ProviderConfig[]): Promise<void> {
        const encrypted = JSON.stringify(configs);
        await this.secrets.store(CREDENTIAL_KEYS.PROVIDER_CONFIGS, encrypted);
    }

    /**
     * Retrieve provider configurations
     */
    async getProviderConfigs(): Promise<ProviderConfig[]> {
        const stored = await this.secrets.get(CREDENTIAL_KEYS.PROVIDER_CONFIGS);
        if (!stored) return [];

        try {
            return JSON.parse(stored);
        } catch {
            return [];
        }
    }

    /**
     * Store device code for CLI auth
     */
    async storeDeviceCode(deviceCode: string): Promise<void> {
        await this.secrets.store(CREDENTIAL_KEYS.DEVICE_CODE, deviceCode);
    }

    /**
     * Get stored device code
     */
    async getDeviceCode(): Promise<string | undefined> {
        return await this.secrets.get(CREDENTIAL_KEYS.DEVICE_CODE);
    }

    /**
     * Store sync token for provider sync
     */
    async storeSyncToken(token: string): Promise<void> {
        await this.secrets.store(CREDENTIAL_KEYS.SYNC_TOKEN, token);
    }

    /**
     * Get sync token
     */
    async getSyncToken(): Promise<string | undefined> {
        return await this.secrets.get(CREDENTIAL_KEYS.SYNC_TOKEN);
    }

    /**
     * Clear all stored credentials (logout)
     */
    async clearAll(): Promise<void> {
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
    async isAuthenticated(): Promise<boolean> {
        const token = await this.getAuthToken();
        return !!token;
    }
}

export interface ProviderConfig {
    id: string;
    provider: string;
    name: string;
    apiKey: string;
    baseUrl?: string;
    defaultModel: string;
    maxTokens: number;
    temperature: number;
    isDefault: boolean;
}