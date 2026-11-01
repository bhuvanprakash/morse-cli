"use strict";
/**
 * Hook Configuration
 *
 * Provides functions for loading, validating, and managing hook configurations.
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
exports.HookConfigManager = void 0;
exports.createHookConfigManager = createHookConfigManager;
const vscode = __importStar(require("vscode"));
const types_1 = require("./types");
/**
 * Hook configuration manager
 * Handles loading, validation, and hot-reloading of hooks
 */
class HookConfigManager {
    context = null;
    settings;
    disposables = [];
    onConfigChangeCallback = null;
    constructor() {
        this.settings = types_1.DEFAULT_HOOK_SETTINGS;
    }
    /**
     * Initialize the configuration manager
     */
    async initialize(context) {
        this.context = context;
        await this.loadSettings();
        this.setupConfigurationWatcher();
    }
    /**
     * Set callback for configuration changes
     */
    setOnConfigChangeCallback(callback) {
        this.onConfigChangeCallback = callback;
    }
    /**
     * Set up configuration change watcher for hot-reload
     */
    setupConfigurationWatcher() {
        if (!this.context)
            return;
        const watcher = vscode.workspace.onDidChangeConfiguration(async (event) => {
            if (event.affectsConfiguration('morse.hooks')) {
                console.log('[Hooks] Configuration changed, reloading...');
                await this.loadSettings();
                if (this.onConfigChangeCallback) {
                    this.onConfigChangeCallback();
                }
            }
        });
        this.disposables.push(watcher);
    }
    /**
     * Load settings from VS Code configuration
     */
    async loadSettings() {
        if (!this.context) {
            return types_1.DEFAULT_HOOK_SETTINGS;
        }
        const config = vscode.workspace.getConfiguration('morse');
        this.settings = {
            enabled: config.get('hooks.enabled') ?? types_1.DEFAULT_HOOK_SETTINGS.enabled,
            hooks: config.get('hooks.config') ?? types_1.DEFAULT_HOOK_SETTINGS.hooks,
            maxHistory: config.get('hooks.maxHistory') ?? types_1.DEFAULT_HOOK_SETTINGS.maxHistory,
            enableLogging: config.get('hooks.enableLogging') ?? types_1.DEFAULT_HOOK_SETTINGS.enableLogging,
            logLevel: config.get('hooks.logLevel') ?? types_1.DEFAULT_HOOK_SETTINGS.logLevel,
        };
        return this.settings;
    }
    /**
     * Get current settings
     */
    getSettings() {
        return { ...this.settings };
    }
    /**
     * Update settings
     */
    async updateSettings(newSettings) {
        if (!this.context)
            return;
        const config = vscode.workspace.getConfiguration('morse');
        if (newSettings.enabled !== undefined) {
            await config.update('hooks.enabled', newSettings.enabled, true);
        }
        if (newSettings.maxHistory !== undefined) {
            await config.update('hooks.maxHistory', newSettings.maxHistory, true);
        }
        if (newSettings.enableLogging !== undefined) {
            await config.update('hooks.enableLogging', newSettings.enableLogging, true);
        }
        if (newSettings.logLevel !== undefined) {
            await config.update('hooks.logLevel', newSettings.logLevel, true);
        }
        await this.loadSettings();
    }
    /**
     * Add a new hook
     */
    async addHook(hookConfig) {
        // Validate the hook
        const errors = (0, types_1.validateHookConfig)(hookConfig);
        if (errors.length > 0) {
            return { success: false, errors };
        }
        // Generate ID if not provided
        const id = hookConfig.id || (0, types_1.generateHookId)();
        // Create full config
        const fullConfig = {
            id,
            name: hookConfig.name,
            description: hookConfig.description,
            type: hookConfig.type,
            enabled: hookConfig.enabled ?? true,
            action: hookConfig.action,
            priority: hookConfig.priority ?? 100,
            executionMode: hookConfig.executionMode ?? 'sync',
            timeout: hookConfig.timeout,
            continueOnError: hookConfig.continueOnError ?? true,
        };
        // Add to settings
        const currentHooks = this.settings.hooks;
        currentHooks.push(fullConfig);
        // Update configuration
        if (this.context) {
            const config = vscode.workspace.getConfiguration('morse');
            await config.update('hooks.config', currentHooks, true);
        }
        await this.loadSettings();
        return { success: true, id };
    }
    /**
     * Update an existing hook
     */
    async updateHook(hookId, updates) {
        const currentHooks = this.settings.hooks;
        const index = currentHooks.findIndex(h => h.id === hookId);
        if (index === -1) {
            return { success: false, errors: ['Hook not found'] };
        }
        // Validate updated config
        const updatedConfig = { ...currentHooks[index], ...updates };
        const errors = (0, types_1.validateHookConfig)(updatedConfig);
        if (errors.length > 0) {
            return { success: false, errors };
        }
        // Update the hook
        currentHooks[index] = updatedConfig;
        // Save to configuration
        if (this.context) {
            const config = vscode.workspace.getConfiguration('morse');
            await config.update('hooks.config', currentHooks, true);
        }
        await this.loadSettings();
        return { success: true };
    }
    /**
     * Delete a hook
     */
    async deleteHook(hookId) {
        const currentHooks = this.settings.hooks;
        const filteredHooks = currentHooks.filter(h => h.id !== hookId);
        if (filteredHooks.length === currentHooks.length) {
            return false;
        }
        if (this.context) {
            const config = vscode.workspace.getConfiguration('morse');
            await config.update('hooks.config', filteredHooks, true);
        }
        await this.loadSettings();
        return true;
    }
    /**
     * Enable or disable a hook
     */
    async setHookEnabled(hookId, enabled) {
        const currentHooks = this.settings.hooks;
        const index = currentHooks.findIndex(h => h.id === hookId);
        if (index === -1) {
            return false;
        }
        currentHooks[index].enabled = enabled;
        if (this.context) {
            const config = vscode.workspace.getConfiguration('morse');
            await config.update('hooks.config', currentHooks, true);
        }
        await this.loadSettings();
        return true;
    }
    /**
     * Get a hook by ID
     */
    getHook(hookId) {
        return this.settings.hooks.find(h => h.id === hookId);
    }
    /**
     * Get all hooks
     */
    getHooks() {
        return [...this.settings.hooks];
    }
    /**
     * Get hooks by type
     */
    getHooksByType(type) {
        return this.settings.hooks.filter(h => h.type === type);
    }
    /**
     * Validate a hook script
     */
    async validateScript(script) {
        const errors = [];
        if (!script || script.trim() === '') {
            errors.push('Script cannot be empty');
            return { valid: false, errors };
        }
        // Check for potentially dangerous patterns
        const dangerousPatterns = [
            { pattern: /process\.exit/i, message: 'process.exit is not allowed' },
            { pattern: /require\s*\(\s*['"]child_process['"]\)/i, message: 'child_process is not allowed' },
            { pattern: /eval\s*\(/i, message: 'eval is not allowed' },
            { pattern: /Function\s*\(/i, message: 'Function constructor is not allowed' },
        ];
        for (const { pattern, message } of dangerousPatterns) {
            if (pattern.test(script)) {
                errors.push(message);
            }
        }
        return { valid: errors.length === 0, errors };
    }
    /**
     * Create a new hook configuration with defaults
     */
    createHookConfig(options) {
        return {
            id: (0, types_1.generateHookId)(),
            name: options.name,
            description: options.description,
            type: options.type,
            enabled: true,
            action: {
                type: options.actionType,
                script: options.actionType === 'script' ? options.actionValue : undefined,
                command: options.actionType === 'command' ? options.actionValue : undefined,
                function: options.actionType === 'function' ? options.actionValue : undefined,
            },
            priority: 100,
            executionMode: 'sync',
            continueOnError: true,
        };
    }
    /**
     * Export hooks to a JSON string
     */
    async exportHooks() {
        return JSON.stringify(this.settings.hooks, null, 2);
    }
    /**
     * Import hooks from JSON
     */
    async importHooks(json) {
        try {
            const importedHooks = JSON.parse(json);
            if (!Array.isArray(importedHooks)) {
                return { success: false, imported: 0, errors: ['Invalid format: expected array'] };
            }
            const errors = [];
            let imported = 0;
            for (const hook of importedHooks) {
                const validationErrors = (0, types_1.validateHookConfig)(hook);
                if (validationErrors.length > 0) {
                    errors.push(`Hook "${hook.name}": ${validationErrors.join(', ')}`);
                    continue;
                }
                // Generate new ID to avoid conflicts
                hook.id = (0, types_1.generateHookId)();
                this.settings.hooks.push(hook);
                imported++;
            }
            if (imported > 0 && this.context) {
                const config = vscode.workspace.getConfiguration('morse');
                await config.update('hooks.config', this.settings.hooks, true);
                await this.loadSettings();
            }
            return { success: imported > 0, imported, errors };
        }
        catch (error) {
            return {
                success: false,
                imported: 0,
                errors: [error instanceof Error ? error.message : 'Failed to parse JSON']
            };
        }
    }
    /**
     * Dispose the configuration manager
     */
    dispose() {
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
    }
}
exports.HookConfigManager = HookConfigManager;
/**
 * Create a new HookConfigManager instance
 */
function createHookConfigManager() {
    return new HookConfigManager();
}
//# sourceMappingURL=config.js.map