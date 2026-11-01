"use strict";
/**
 * Cloud Sync Module
 *
 * Main entry point for the cloud sync system.
 * Provides authentication, synchronization, and storage services.
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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CloudSync = void 0;
exports.initializeCloudSync = initializeCloudSync;
exports.createCloudSync = createCloudSync;
__exportStar(require("./types"), exports);
__exportStar(require("./auth"), exports);
__exportStar(require("./service"), exports);
__exportStar(require("./storage"), exports);
__exportStar(require("./ui"), exports);
const auth_1 = require("./auth");
const service_1 = require("./service");
const storage_1 = require("./storage");
const ui_1 = require("./ui");
const types_1 = require("./types");
/**
 * Main cloud sync controller
 */
class CloudSync {
    auth;
    syncManager;
    storageSync;
    authEventEmitter;
    syncEventEmitter;
    context;
    initialized = false;
    /**
     * Create a new CloudSync instance
     */
    constructor(context, options = {}) {
        this.context = context;
        // Merge options with config
        const fullConfig = {
            ...types_1.DEFAULT_SYNC_CONFIG,
            ...options.config,
            endpoint: options.config?.endpoint || options.baseUrl || types_1.DEFAULT_SYNC_CONFIG.endpoint,
        };
        const baseUrl = fullConfig.endpoint;
        const apiKey = options.apiKey || options.config?.apiKey || '';
        this.authEventEmitter = new auth_1.AuthEventEmitter();
        this.syncEventEmitter = new service_1.SyncEventEmitter();
        const { auth, eventEmitter: authEmitter } = (0, auth_1.createCloudAuth)(baseUrl, apiKey);
        this.auth = auth;
        const { syncManager, eventEmitter: syncEmitter } = (0, service_1.createSyncManager)(this.auth, fullConfig);
        this.syncManager = syncManager;
        this.storageSync = (0, storage_1.createStorageSync)(context);
    }
    /**
     * Initialize cloud sync
     */
    async initialize() {
        if (this.initialized) {
            return;
        }
        // Initialize auth with extension context
        this.auth.initialize(this.context);
        // Initialize sync manager
        this.syncManager.initialize(this.context);
        // Register commands
        (0, ui_1.registerCloudSyncCommands)(this.context, this.auth, this.syncManager);
        // Start sync if enabled and authenticated
        if (this.syncManager.isEnabled() && this.auth.isAuthenticated()) {
            this.syncManager.startSync();
        }
        this.initialized = true;
    }
    /**
     * Get auth service
     */
    getAuth() {
        return this.auth;
    }
    /**
     * Get sync manager
     */
    getSyncManager() {
        return this.syncManager;
    }
    /**
     * Get storage sync
     */
    getStorageSync() {
        return this.storageSync;
    }
    /**
     * Get auth state
     */
    getAuthState() {
        return this.auth.getAuthState();
    }
    /**
     * Check if authenticated
     */
    isAuthenticated() {
        return this.auth.isAuthenticated();
    }
    /**
     * Login with credentials
     */
    async login(email, password) {
        const user = await this.auth.login({ email, password });
        if (this.syncManager.isEnabled()) {
            this.syncManager.startSync();
        }
        return user;
    }
    /**
     * Logout
     */
    async logout() {
        this.syncManager.stopSync();
        await this.auth.logout();
    }
    /**
     * Trigger manual sync
     */
    async sync() {
        await this.syncManager.doSync();
    }
    /**
     * Subscribe to auth state changes
     */
    onAuthStateChanged(callback) {
        return this.auth.onAuthStateChanged(callback);
    }
    /**
     * Subscribe to sync events
     */
    onSyncEvent(callback) {
        return this.syncManager.onSyncEvent(callback);
    }
    /**
     * Dispose resources
     */
    dispose() {
        this.syncManager.stopSync();
    }
}
exports.CloudSync = CloudSync;
/**
 * Initialize cloud sync
 */
async function initializeCloudSync(context, options = {}) {
    const cloudSync = new CloudSync(context, options);
    await cloudSync.initialize();
    return cloudSync;
}
/**
 * Create cloud sync instance (without auto-initialization)
 */
function createCloudSync(context, options = {}) {
    return new CloudSync(context, options);
}
//# sourceMappingURL=index.js.map