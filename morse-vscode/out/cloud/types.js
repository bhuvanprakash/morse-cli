"use strict";
/**
 * Cloud Sync Types
 *
 * Defines types for the cloud sync system in morse-vscode extension.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_AUTH_STATE = exports.DEFAULT_SYNC_CONFIG = exports.ALL_SYNC_ITEM_TYPES = void 0;
exports.syncStatusToDisplayText = syncStatusToDisplayText;
exports.syncStatusToIcon = syncStatusToIcon;
exports.conflictPolicyToDisplayText = conflictPolicyToDisplayText;
exports.isValidSyncItemType = isValidSyncItemType;
exports.getSyncItemType = getSyncItemType;
/**
 * All available sync item types
 */
exports.ALL_SYNC_ITEM_TYPES = [
    'session',
    'settings',
    'history',
    'checkpoints',
];
/**
 * Default sync configuration
 */
exports.DEFAULT_SYNC_CONFIG = {
    enabled: false,
    endpoint: 'https://api.morse-cli.com',
    apiKey: '',
    syncIntervalMinutes: 5,
    syncTypes: ['session', 'settings', 'history', 'checkpoints'],
    conflictPolicy: 'lastWriteWin',
    autoSync: true,
    maxRetries: 3,
};
/**
 * Default auth state
 */
exports.DEFAULT_AUTH_STATE = {
    isAuthenticated: false,
    isLoading: false,
    user: null,
    session: null,
    error: null,
};
/**
 * Convert sync status value to display text
 */
function syncStatusToDisplayText(status) {
    const names = {
        synced: 'Synced',
        pending: 'Pending',
        conflict: 'Conflict',
        error: 'Error',
        offline: 'Offline',
    };
    return names[status];
}
/**
 * Convert sync status value to icon
 */
function syncStatusToIcon(status) {
    const icons = {
        synced: '$(check)',
        pending: '$(sync)',
        conflict: '$(warning)',
        error: '$(error)',
        offline: '$(cloud-offline)',
    };
    return icons[status];
}
/**
 * Convert conflict policy to display text
 */
function conflictPolicyToDisplayText(policy) {
    const names = {
        lastWriteWin: 'Last Write Wins',
        localFirst: 'Local First',
        cloudFirst: 'Cloud First',
        manual: 'Manual Resolution',
    };
    return names[policy];
}
/**
 * Check if sync type is valid
 */
function isValidSyncItemType(type) {
    return exports.ALL_SYNC_ITEM_TYPES.includes(type);
}
/**
 * Get sync item type from string
 */
function getSyncItemType(type) {
    return isValidSyncItemType(type) ? type : null;
}
//# sourceMappingURL=types.js.map