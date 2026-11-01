"use strict";
/**
 * Hook System Types
 *
 * Defines types for the hook system in morse-vscode extension.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BUILT_IN_HOOKS = exports.DEFAULT_HOOK_SETTINGS = exports.ALL_HOOK_TYPES = void 0;
exports.hookTypeToDisplayName = hookTypeToDisplayName;
exports.hookTypeToEventName = hookTypeToEventName;
exports.isPreHook = isPreHook;
exports.isPostHook = isPostHook;
exports.validateHookConfig = validateHookConfig;
exports.generateHookId = generateHookId;
exports.generateExecutionId = generateExecutionId;
/**
 * All available hook types
 */
exports.ALL_HOOK_TYPES = [
    'preExecute',
    'postExecute',
    'preEdit',
    'postEdit',
    'onError',
    'onMessage',
    'onToolCall',
];
/**
 * Default hook settings
 */
exports.DEFAULT_HOOK_SETTINGS = {
    enabled: true,
    hooks: [],
    maxHistory: 100,
    enableLogging: true,
    logLevel: 'info',
};
/**
 * Built-in hook identifiers
 */
exports.BUILT_IN_HOOKS = {
    COMMAND_VALIDATOR: 'builtin:command-validator',
    FILE_TRACKER: 'builtin:file-tracker',
    COST_TRACKER: 'builtin:cost-tracker',
    AUDIT_LOG: 'builtin:audit-log',
};
/**
 * Convert hook type to display name
 */
function hookTypeToDisplayName(type) {
    const names = {
        preExecute: 'Pre-Execute',
        postExecute: 'Post-Execute',
        preEdit: 'Pre-Edit',
        postEdit: 'Post-Edit',
        onError: 'On Error',
        onMessage: 'On Message',
        onToolCall: 'On Tool Call',
    };
    return names[type];
}
/**
 * Convert hook type to event name
 */
function hookTypeToEventName(type) {
    return `hook:${type}`;
}
/**
 * Check if a hook type is a "pre" hook
 */
function isPreHook(type) {
    return type === 'preExecute' || type === 'preEdit';
}
/**
 * Check if a hook type is a "post" hook
 */
function isPostHook(type) {
    return type === 'postExecute' || type === 'postEdit';
}
/**
 * Validate hook configuration
 */
function validateHookConfig(config) {
    const errors = [];
    if (!config.name || config.name.trim() === '') {
        errors.push('Hook name is required');
    }
    if (!config.type || !exports.ALL_HOOK_TYPES.includes(config.type)) {
        errors.push('Invalid hook type');
    }
    if (!config.action) {
        errors.push('Hook action is required');
    }
    else if (!config.action.type) {
        errors.push('Hook action type is required');
    }
    else if (config.action.type === 'script' && !config.action.script) {
        errors.push('Script content is required for script action');
    }
    else if (config.action.type === 'command' && !config.action.command) {
        errors.push('Command is required for command action');
    }
    if (config.timeout !== undefined && config.timeout < 0) {
        errors.push('Timeout must be a positive number');
    }
    return errors;
}
/**
 * Generate unique hook ID
 */
function generateHookId() {
    return `hook-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
}
/**
 * Generate execution entry ID
 */
function generateExecutionId() {
    return `exec-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
}
//# sourceMappingURL=types.js.map