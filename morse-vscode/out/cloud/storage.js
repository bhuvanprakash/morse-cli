"use strict";
/**
 * Storage Sync Module
 *
 * Handles syncing different types of data: sessions, settings, history, and checkpoints.
 * Provides abstraction layer for local storage operations.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.StorageSync = void 0;
exports.createStorageSync = createStorageSync;
const types_1 = require("./types");
/**
 * Session storage adapter
 */
class SessionStorageAdapter {
    context;
    constructor(context) {
        this.context = context;
    }
    async getAll() {
        const sessions = this.context.workspaceState.get('morse-sessions') || [];
        return sessions.map(s => ({
            ...s,
            createdAt: new Date(s.createdAt),
            updatedAt: new Date(s.updatedAt),
        }));
    }
    async get(id) {
        const sessions = await this.getAll();
        const session = sessions.find(s => s.id === id);
        return session || null;
    }
    async save(item) {
        const sessions = await this.getAll();
        const index = sessions.findIndex(s => s.id === item.id);
        if (index >= 0) {
            sessions[index] = item;
        }
        else {
            sessions.push(item);
        }
        await this.context.workspaceState.update('morse-sessions', sessions);
    }
    async delete(id) {
        const sessions = await this.getAll();
        const filtered = sessions.filter(s => s.id !== id);
        await this.context.workspaceState.update('morse-sessions', filtered);
    }
    async getLastModified() {
        const sessions = await this.getAll();
        if (sessions.length === 0)
            return null;
        const sorted = sessions.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        return new Date(sorted[0].updatedAt);
    }
}
/**
 * Settings storage adapter
 */
class SettingsStorageAdapter {
    context;
    constructor(context) {
        this.context = context;
    }
    async getAll() {
        const settings = this.context.workspaceState.get('morse-settings') || [];
        return settings.map(s => ({
            ...s,
            updatedAt: new Date(s.updatedAt),
        }));
    }
    async get(id) {
        const settings = await this.getAll();
        const setting = settings.find(s => s.id === id);
        return setting || null;
    }
    async save(item) {
        const settings = await this.getAll();
        const index = settings.findIndex(s => s.id === item.id);
        if (index >= 0) {
            settings[index] = item;
        }
        else {
            settings.push(item);
        }
        await this.context.workspaceState.update('morse-settings', settings);
    }
    async delete(id) {
        const settings = await this.getAll();
        const filtered = settings.filter(s => s.id !== id);
        await this.context.workspaceState.update('morse-settings', filtered);
    }
    async getLastModified() {
        const settings = await this.getAll();
        if (settings.length === 0)
            return null;
        const sorted = settings.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        return new Date(sorted[0].updatedAt);
    }
}
/**
 * History storage adapter
 */
class HistoryStorageAdapter {
    context;
    maxItems = 1000;
    constructor(context) {
        this.context = context;
    }
    async getAll() {
        const history = this.context.workspaceState.get('morse-history') || [];
        return history.map(h => ({
            ...h,
            timestamp: new Date(h.timestamp),
        }));
    }
    async get(id) {
        const history = await this.getAll();
        const item = history.find(h => h.id === id);
        return item || null;
    }
    async save(item) {
        let history = await this.getAll();
        // Add new item
        history.push(item);
        // Trim to max items
        if (history.length > this.maxItems) {
            history = history
                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                .slice(0, this.maxItems);
        }
        await this.context.workspaceState.update('morse-history', history);
    }
    async delete(id) {
        const history = await this.getAll();
        const filtered = history.filter(h => h.id !== id);
        await this.context.workspaceState.update('morse-history', filtered);
    }
    async getLastModified() {
        const history = await this.getAll();
        if (history.length === 0)
            return null;
        const sorted = history.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        return new Date(sorted[0].timestamp);
    }
}
/**
 * Checkpoint storage adapter
 */
class CheckpointStorageAdapter {
    context;
    constructor(context) {
        this.context = context;
    }
    async getAll() {
        const checkpoints = this.context.workspaceState.get('morse-checkpoints') || [];
        return checkpoints.map(c => ({
            ...c,
            createdAt: new Date(c.createdAt),
        }));
    }
    async get(id) {
        const checkpoints = await this.getAll();
        const checkpoint = checkpoints.find(c => c.id === id);
        return checkpoint || null;
    }
    async save(item) {
        const checkpoints = await this.getAll();
        const index = checkpoints.findIndex(c => c.id === item.id);
        if (index >= 0) {
            checkpoints[index] = item;
        }
        else {
            checkpoints.push(item);
        }
        await this.context.workspaceState.update('morse-checkpoints', checkpoints);
    }
    async delete(id) {
        const checkpoints = await this.getAll();
        const filtered = checkpoints.filter(c => c.id !== id);
        await this.context.workspaceState.update('morse-checkpoints', filtered);
    }
    async getLastModified() {
        const checkpoints = await this.getAll();
        if (checkpoints.length === 0)
            return null;
        const sorted = checkpoints.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        return new Date(sorted[0].createdAt);
    }
}
/**
 * Storage sync manager
 */
class StorageSync {
    context;
    sessionAdapter;
    settingsAdapter;
    historyAdapter;
    checkpointAdapter;
    /**
     * Create a new StorageSync instance
     */
    constructor(context) {
        this.context = context;
        this.sessionAdapter = new SessionStorageAdapter(context);
        this.settingsAdapter = new SettingsStorageAdapter(context);
        this.historyAdapter = new HistoryStorageAdapter(context);
        this.checkpointAdapter = new CheckpointStorageAdapter(context);
    }
    /**
     * Get sync items for a specific type
     */
    async getSyncItems(type) {
        const adapter = this.getAdapter(type);
        const items = await adapter.getAll();
        return items.map((item) => this.toSyncItem(type, item));
    }
    /**
     * Get single sync item
     */
    async getSyncItem(type, id) {
        const adapter = this.getAdapter(type);
        const item = await adapter.get(id);
        if (!item)
            return null;
        return this.toSyncItem(type, item);
    }
    /**
     * Apply sync item to local storage
     */
    async applySyncItem(item) {
        const adapter = this.getAdapter(item.type);
        if (item.deleted) {
            await adapter.delete(item.id);
        }
        else {
            await adapter.save(item.data);
        }
    }
    /**
     * Get last modified date for a type
     */
    async getLastModified(type) {
        const adapter = this.getAdapter(type);
        return adapter.getLastModified();
    }
    /**
     * Create a new sync item from local data
     */
    createSyncItem(type, data, action) {
        return {
            id: this.generateId(),
            type,
            action,
            data,
            localTimestamp: new Date(),
            version: 1,
            deleted: action === 'delete',
        };
    }
    /**
     * Get all syncable types
     */
    getSyncTypes() {
        return [...types_1.ALL_SYNC_ITEM_TYPES];
    }
    getAdapter(type) {
        switch (type) {
            case 'session':
                return this.sessionAdapter;
            case 'settings':
                return this.settingsAdapter;
            case 'history':
                return this.historyAdapter;
            case 'checkpoints':
                return this.checkpointAdapter;
            default:
                throw new Error(`Unknown sync type: ${type}`);
        }
    }
    toSyncItem(type, data) {
        const item = data;
        return {
            id: item.id,
            type,
            action: 'update',
            data,
            localTimestamp: new Date(item.updatedAt || item.createdAt || item.timestamp || Date.now()),
            version: 1,
            deleted: false,
        };
    }
    generateId() {
        return `sync_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
    }
}
exports.StorageSync = StorageSync;
/**
 * Create a new StorageSync instance
 */
function createStorageSync(context) {
    return new StorageSync(context);
}
//# sourceMappingURL=storage.js.map