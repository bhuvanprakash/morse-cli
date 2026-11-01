"use strict";
/**
 * Cloud Sync Service
 *
 * Main service for synchronizing data between local storage and cloud.
 * Handles push, pull, conflict detection, and offline support.
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
exports.SyncManager = exports.ConflictManager = exports.SyncEventEmitter = void 0;
exports.createSyncManager = createSyncManager;
const vscode = __importStar(require("vscode"));
const types_1 = require("./types");
/**
 * Sync event emitter for sync status changes
 */
class SyncEventEmitter extends vscode.EventEmitter {
    constructor() {
        super();
    }
}
exports.SyncEventEmitter = SyncEventEmitter;
/**
 * Conflict manager for handling sync conflicts
 */
class ConflictManager {
    policy;
    constructor(policy = 'lastWriteWin') {
        this.policy = policy;
    }
    /**
     * Detect conflict between local and cloud items
     */
    detectConflict(cloudItem, localItem) {
        if (!localItem) {
            return { hasConflict: false, conflict: {} };
        }
        // If cloud item is newer than local, there's a potential conflict
        if (cloudItem.cloudTimestamp && cloudItem.cloudTimestamp > localItem.localTimestamp) {
            const conflict = {
                itemId: cloudItem.id,
                itemType: cloudItem.type,
                localTimestamp: localItem.localTimestamp,
                cloudTimestamp: cloudItem.cloudTimestamp,
                localData: localItem.data,
                cloudData: cloudItem.data,
                resolved: false,
            };
            return { hasConflict: true, conflict };
        }
        return { hasConflict: false, conflict: {} };
    }
    /**
     * Resolve conflict based on policy
     */
    resolve(cloudItem, localItem) {
        switch (this.policy) {
            case 'lastWriteWin':
                // Compare timestamps and keep the newer one
                if (cloudItem.cloudTimestamp && cloudItem.cloudTimestamp > localItem.localTimestamp) {
                    return cloudItem;
                }
                return localItem;
            case 'localFirst':
                // Always prefer local
                return localItem;
            case 'cloudFirst':
                // Always prefer cloud
                return cloudItem;
            case 'manual':
                // Return cloud item - manual resolution required
                return cloudItem;
            default:
                // Default to last write wins
                if (cloudItem.cloudTimestamp && cloudItem.cloudTimestamp > localItem.localTimestamp) {
                    return cloudItem;
                }
                return localItem;
        }
    }
    /**
     * Apply manual conflict resolution
     */
    applyResolution(cloudItem, localItem, resolution) {
        switch (resolution.strategy) {
            case 'keepLocal':
                return { ...localItem, cloudTimestamp: cloudItem.cloudTimestamp };
            case 'keepCloud':
                return cloudItem;
            case 'merge':
                // For now, return cloud as merged result
                return { ...cloudItem, data: resolution.mergedData || cloudItem.data };
            case 'keepBoth':
                // Create a new item with both versions - special handling needed
                return cloudItem;
            default:
                return cloudItem;
        }
    }
    /**
     * Update policy
     */
    setPolicy(policy) {
        this.policy = policy;
    }
    /**
     * Get current policy
     */
    getPolicy() {
        return this.policy;
    }
}
exports.ConflictManager = ConflictManager;
/**
 * SyncManager manages synchronization between local data and cloud
 */
class SyncManager {
    auth;
    config;
    status;
    syncInterval = null;
    isRunning = false;
    conflictManager;
    eventEmitter;
    operationQueue = [];
    pendingChanges = new Map();
    context = null;
    /**
     * Create a new SyncManager instance
     */
    constructor(auth, config, eventEmitter) {
        this.auth = auth;
        this.config = config;
        this.eventEmitter = eventEmitter;
        this.conflictManager = new ConflictManager(config.conflictPolicy);
        this.status = {
            isEnabled: config.enabled,
            isRunning: false,
            lastSyncTime: null,
            lastError: null,
            pendingItems: 0,
            conflicts: 0,
            isOffline: false,
        };
    }
    /**
     * Initialize the sync manager with extension context
     */
    initialize(context) {
        this.context = context;
        this.loadState();
    }
    /**
     * Start background sync process
     */
    startSync() {
        if (this.isRunning) {
            return;
        }
        if (!this.auth.isAuthenticated()) {
            this.status.lastError = 'Not authenticated';
            return;
        }
        this.isRunning = true;
        this.status.isRunning = true;
        this.eventEmitter.fire({ type: 'syncStarted' });
        if (this.config.autoSync) {
            const intervalMs = this.config.syncIntervalMinutes * 60 * 1000;
            this.syncInterval = setInterval(() => {
                this.doSync().catch((error) => {
                    console.error('[SyncManager] Sync failed:', error);
                });
            }, intervalMs);
        }
        // Do initial sync
        this.doSync().catch((error) => {
            console.error('[SyncManager] Initial sync failed:', error);
        });
    }
    /**
     * Stop background sync process
     */
    stopSync() {
        if (!this.isRunning) {
            return;
        }
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
        this.isRunning = false;
        this.status.isRunning = false;
    }
    /**
     * Push local changes to cloud
     */
    async push() {
        const result = {
            success: false,
            itemsPushed: 0,
            itemsPulled: 0,
            conflicts: [],
            error: null,
            timestamp: new Date(),
        };
        if (!this.auth.isAuthenticated()) {
            result.error = 'Not authenticated';
            return result;
        }
        try {
            // Get local items based on configured sync types
            const items = await this.getLocalItems();
            for (const item of items) {
                try {
                    await this.pushItem(item);
                    result.itemsPushed++;
                }
                catch (error) {
                    // Queue for retry
                    this.queueOperation(item);
                    result.error = `Failed to push item ${item.id}: ${error}`;
                }
            }
            result.success = !result.error;
            this.status.lastSyncTime = new Date();
            this.status.pendingItems = this.operationQueue.length;
            // Process queued operations
            await this.processQueue();
        }
        catch (error) {
            result.error = error instanceof Error ? error.message : 'Push failed';
            this.status.lastError = result.error;
        }
        return result;
    }
    /**
     * Pull remote changes from cloud
     */
    async pull() {
        const result = {
            success: false,
            itemsPushed: 0,
            itemsPulled: 0,
            conflicts: [],
            error: null,
            timestamp: new Date(),
        };
        if (!this.auth.isAuthenticated()) {
            result.error = 'Not authenticated';
            return result;
        }
        try {
            for (const syncType of this.config.syncTypes) {
                try {
                    const items = await this.pullItems(syncType);
                    for (const cloudItem of items) {
                        // Check for conflicts
                        const localItem = this.pendingChanges.get(cloudItem.id) || null;
                        const { hasConflict, conflict } = this.conflictManager.detectConflict(cloudItem, localItem);
                        if (hasConflict) {
                            result.conflicts.push(conflict);
                            this.status.conflicts++;
                            // Auto-resolve if not manual policy
                            if (this.config.conflictPolicy !== 'manual') {
                                const resolved = this.conflictManager.resolve(cloudItem, localItem);
                                await this.applyLocalItem(resolved);
                                result.itemsPulled++;
                            }
                        }
                        else {
                            await this.applyLocalItem(cloudItem);
                            result.itemsPulled++;
                        }
                    }
                }
                catch (error) {
                    result.error = `Failed to pull ${syncType}: ${error}`;
                }
            }
            result.success = !result.error;
            this.status.lastSyncTime = new Date();
        }
        catch (error) {
            result.error = error instanceof Error ? error.message : 'Pull failed';
            this.status.lastError = result.error;
        }
        return result;
    }
    /**
     * Perform full sync (push and pull)
     */
    async doSync() {
        const result = {
            success: false,
            itemsPushed: 0,
            itemsPulled: 0,
            conflicts: [],
            error: null,
            timestamp: new Date(),
        };
        // Push local changes
        const pushResult = await this.push();
        result.itemsPushed = pushResult.itemsPushed;
        result.error = pushResult.error;
        // Pull remote changes
        const pullResult = await this.pull();
        result.itemsPulled = pullResult.itemsPulled;
        result.conflicts = pullResult.conflicts;
        if (!result.error && pullResult.error) {
            result.error = pullResult.error;
        }
        result.success = !result.error;
        this.status.lastSyncTime = new Date();
        this.eventEmitter.fire({
            type: result.success ? 'syncCompleted' : 'syncFailed',
            data: result,
        });
        return result;
    }
    /**
     * Resolve conflicts
     */
    async resolveConflicts(resolutions) {
        for (const [itemId, resolution] of resolutions) {
            const cloudItem = await this.getCloudItem(itemId);
            if (!cloudItem)
                continue;
            const localItem = this.pendingChanges.get(itemId);
            if (!localItem)
                continue;
            const resolved = this.conflictManager.applyResolution(cloudItem, localItem, resolution);
            await this.applyLocalItem(resolved);
            if (resolution.strategy === 'keepLocal') {
                await this.pushItem(resolved);
            }
            this.status.conflicts--;
        }
        this.saveState();
    }
    /**
     * Get current sync status
     */
    getStatus() {
        return { ...this.status };
    }
    /**
     * Check if sync is enabled
     */
    isEnabled() {
        return this.config.enabled;
    }
    /**
     * Check if sync is running
     */
    getIsRunning() {
        return this.isRunning;
    }
    /**
     * Update sync configuration
     */
    updateConfig(config) {
        this.config = { ...this.config, ...config };
        this.conflictManager.setPolicy(this.config.conflictPolicy);
        this.saveState();
    }
    /**
     * Get configuration
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * Add pending change
     */
    addPendingChange(item) {
        this.pendingChanges.set(item.id, item);
        this.status.pendingItems = this.pendingChanges.size;
        this.saveState();
    }
    /**
     * Subscribe to sync events
     */
    onSyncEvent(callback) {
        return this.eventEmitter.event(callback);
    }
    async getLocalItems() {
        const items = [];
        for (const syncType of this.config.syncTypes) {
            const typeItems = await this.getLocalItemsByType(syncType);
            items.push(...typeItems);
        }
        return items;
    }
    async getLocalItemsByType(type) {
        // Placeholder - would integrate with actual storage
        return [];
    }
    async pushItem(item) {
        const response = await this.auth.makeAuthenticatedRequest(`/api/sync/items`, {
            method: 'POST',
            body: JSON.stringify({
                ...item,
                localTimestamp: item.localTimestamp.toISOString(),
                cloudTimestamp: item.cloudTimestamp?.toISOString(),
            }),
        });
        if (!response.success) {
            throw new Error(response.error || 'Push failed');
        }
        // Remove from pending
        this.pendingChanges.delete(item.id);
    }
    async pullItems(type) {
        const response = await this.auth.makeAuthenticatedRequest(`/api/sync/items?type=${type}`, { method: 'GET' });
        if (!response.success || !response.data) {
            return [];
        }
        return response.data.map((item) => ({
            ...item,
            localTimestamp: new Date(item.localTimestamp),
            cloudTimestamp: item.cloudTimestamp ? new Date(item.cloudTimestamp) : undefined,
        }));
    }
    async getCloudItem(itemId) {
        const response = await this.auth.makeAuthenticatedRequest(`/api/sync/items/${itemId}`, { method: 'GET' });
        if (!response.success || !response.data) {
            return null;
        }
        const item = response.data;
        return {
            ...item,
            localTimestamp: new Date(item.localTimestamp),
            cloudTimestamp: item.cloudTimestamp ? new Date(item.cloudTimestamp) : undefined,
        };
    }
    async applyLocalItem(item) {
        // Apply item to local storage based on type
        switch (item.type) {
            case 'session':
                await this.applySession(item);
                break;
            case 'settings':
                await this.applySettings(item);
                break;
            case 'history':
                await this.applyHistory(item);
                break;
            case 'checkpoints':
                await this.applyCheckpoints(item);
                break;
        }
        if (!item.deleted) {
            this.pendingChanges.set(item.id, item);
        }
        else {
            this.pendingChanges.delete(item.id);
        }
        this.status.pendingItems = this.pendingChanges.size;
    }
    async applySession(item) {
        // Placeholder - would integrate with session storage
    }
    async applySettings(item) {
        // Placeholder - would integrate with settings storage
    }
    async applyHistory(item) {
        // Placeholder - would integrate with history storage
    }
    async applyCheckpoints(item) {
        // Placeholder - would integrate with checkpoint storage
    }
    queueOperation(item) {
        const operation = {
            id: `op_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            item,
            createdAt: new Date(),
            retryCount: 0,
        };
        this.operationQueue.push(operation);
        this.saveState();
    }
    async processQueue() {
        const maxRetries = this.config.maxRetries;
        const failed = [];
        for (const operation of this.operationQueue) {
            try {
                await this.pushItem(operation.item);
                operation.retryCount++;
            }
            catch (error) {
                operation.retryCount++;
                operation.lastAttempt = new Date();
                operation.error = error instanceof Error ? error.message : 'Unknown error';
                if (operation.retryCount < maxRetries) {
                    failed.push(operation);
                }
            }
        }
        this.operationQueue = failed;
        this.status.pendingItems = this.operationQueue.length;
        this.saveState();
    }
    getStateKey() {
        return 'morse-sync-state';
    }
    saveState() {
        if (!this.context)
            return;
        const state = {
            config: this.config,
            pendingChanges: Array.from(this.pendingChanges.entries()),
            operationQueue: this.operationQueue,
        };
        this.context.workspaceState.update(this.getStateKey(), state);
    }
    loadState() {
        if (!this.context)
            return;
        const state = this.context.workspaceState.get(this.getStateKey());
        if (state) {
            this.config = { ...types_1.DEFAULT_SYNC_CONFIG, ...state.config };
            this.pendingChanges = new Map(state.pendingChanges);
            this.operationQueue = state.operationQueue;
            this.status.pendingItems = this.pendingChanges.size;
        }
    }
}
exports.SyncManager = SyncManager;
/**
 * Create a new sync manager
 */
function createSyncManager(auth, config) {
    const eventEmitter = new SyncEventEmitter();
    const syncManager = new SyncManager(auth, config, eventEmitter);
    return { syncManager, eventEmitter };
}
//# sourceMappingURL=service.js.map