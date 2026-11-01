"use strict";
/**
 * Hook Manager
 *
 * Core manager for registering and executing hooks in the morse-vscode extension.
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
exports.HookManager = void 0;
exports.createHookManager = createHookManager;
const vscode = __importStar(require("vscode"));
const types_1 = require("./types");
/**
 * Default console logger
 */
class DefaultHookLogger {
    log(level, message, data) {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
        if (data) {
            console.log(logMessage, data);
        }
        else {
            console.log(logMessage);
        }
    }
}
/**
 * Hook Manager
 * Manages hook registration, execution, and lifecycle
 */
class HookManager {
    hooks = new Map();
    executionHistory = [];
    settings;
    logger;
    context = null;
    enabled = true;
    constructor(logger) {
        this.settings = types_1.DEFAULT_HOOK_SETTINGS;
        this.logger = logger || new DefaultHookLogger();
        // Initialize hook maps for each type
        const hookTypes = [
            'preExecute',
            'postExecute',
            'preEdit',
            'postEdit',
            'onError',
            'onMessage',
            'onToolCall',
        ];
        hookTypes.forEach(type => this.hooks.set(type, new Map()));
    }
    /**
     * Initialize the hook manager with VS Code extension context
     */
    async initialize(context) {
        this.context = context;
        await this.loadSettings();
        // Register commands
        this.registerCommands(context);
        this.logger.log('info', 'HookManager initialized');
    }
    /**
     * Register VS Code commands
     */
    registerCommands(context) {
        context.subscriptions.push(vscode.commands.registerCommand('morse.hooks.list', async () => {
            await this.showHookList();
        }));
        context.subscriptions.push(vscode.commands.registerCommand('morse.hooks.executeHistory', async () => {
            await this.showExecutionHistory();
        }));
        context.subscriptions.push(vscode.commands.registerCommand('morse.hooks.reload', async () => {
            await this.reloadHooks();
        }));
    }
    /**
     * Load settings from VS Code configuration
     */
    async loadSettings() {
        if (!this.context)
            return;
        const config = vscode.workspace.getConfiguration('morse');
        this.settings = {
            enabled: config.get('hooks.enabled') ?? types_1.DEFAULT_HOOK_SETTINGS.enabled,
            hooks: config.get('hooks.config') ?? types_1.DEFAULT_HOOK_SETTINGS.hooks,
            maxHistory: config.get('hooks.maxHistory') ?? types_1.DEFAULT_HOOK_SETTINGS.maxHistory,
            enableLogging: config.get('hooks.enableLogging') ?? types_1.DEFAULT_HOOK_SETTINGS.enableLogging,
            logLevel: config.get('hooks.logLevel') ?? types_1.DEFAULT_HOOK_SETTINGS.logLevel,
        };
        this.enabled = this.settings.enabled;
        // Register hooks from settings
        for (const hookConfig of this.settings.hooks) {
            if (hookConfig.enabled) {
                await this.registerHook(hookConfig);
            }
        }
        this.logger.log('info', 'Hook settings loaded', {
            hookCount: this.settings.hooks.length,
            enabled: this.enabled
        });
    }
    /**
     * Reload hooks from configuration
     */
    async reloadHooks() {
        // Clear all hooks
        this.hooks.forEach(hookMap => hookMap.clear());
        // Reload settings
        await this.loadSettings();
        vscode.window.showInformationMessage('Hooks reloaded successfully');
    }
    /**
     * Register a new hook
     */
    async registerHook(config) {
        const hookId = config.id || (0, types_1.generateHookId)();
        const registration = {
            id: hookId,
            config: {
                ...config,
                id: hookId,
            },
            registeredAt: Date.now(),
            executionCount: 0,
        };
        const hookMap = this.hooks.get(config.type);
        if (!hookMap) {
            throw new Error(`Invalid hook type: ${config.type}`);
        }
        hookMap.set(hookId, registration);
        // Sort by priority
        this.sortHooks(config.type);
        this.logger.log('info', 'Hook registered', {
            hookId,
            name: config.name,
            type: config.type,
        });
        return hookId;
    }
    /**
     * Unregister a hook
     */
    async unregisterHook(hookId) {
        for (const [type, hookMap] of this.hooks) {
            if (hookMap.has(hookId)) {
                hookMap.delete(hookId);
                this.logger.log('info', 'Hook unregistered', { hookId, type });
                return true;
            }
        }
        return false;
    }
    /**
     * Enable or disable a hook
     */
    setHookEnabled(hookId, enabled) {
        for (const hookMap of this.hooks.values()) {
            const registration = hookMap.get(hookId);
            if (registration) {
                registration.config.enabled = enabled;
                this.logger.log('info', `Hook ${enabled ? 'enabled' : 'disabled'}`, { hookId });
                return true;
            }
        }
        return false;
    }
    /**
     * Execute hooks for a given type
     */
    async execute(type, context) {
        if (!this.enabled) {
            return { success: true, continue: true, modified: false };
        }
        const hookMap = this.hooks.get(type);
        if (!hookMap) {
            return { success: true, continue: true, modified: false };
        }
        const enabledHooks = Array.from(hookMap.values())
            .filter(reg => reg.config.enabled)
            .sort((a, b) => b.config.priority - a.config.priority);
        let currentData = context.data;
        let shouldContinue = true;
        let hasModified = false;
        for (const registration of enabledHooks) {
            const executionEntry = await this.executeHook(registration, context, currentData);
            this.addExecutionEntry(executionEntry);
            if (!executionEntry.success) {
                this.logger.log('error', 'Hook execution failed', {
                    hookId: registration.id,
                    error: executionEntry.error,
                });
                if (!registration.config.continueOnError) {
                    return {
                        success: false,
                        continue: false,
                        modified: hasModified,
                        error: executionEntry.error,
                    };
                }
            }
            if (executionEntry.result) {
                if (executionEntry.result.modified && executionEntry.result.data) {
                    currentData = executionEntry.result.data;
                    hasModified = true;
                }
                if (!executionEntry.result.continue) {
                    shouldContinue = false;
                    break;
                }
            }
            // Update execution count
            registration.executionCount++;
            registration.lastExecuted = Date.now();
        }
        return {
            success: true,
            continue: shouldContinue,
            modified: hasModified,
            data: hasModified ? currentData : undefined,
        };
    }
    /**
     * Execute a single hook
     */
    async executeHook(registration, context, data) {
        const entry = {
            id: (0, types_1.generateExecutionId)(),
            hookId: registration.id,
            hookName: registration.config.name,
            hookType: registration.config.type,
            startTime: Date.now(),
            success: false,
        };
        const timeout = registration.config.timeout || 30000;
        try {
            const result = await Promise.race([
                this.executeHookAction(registration.config, context, data),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Hook execution timeout')), timeout)),
            ]);
            entry.endTime = Date.now();
            entry.duration = entry.endTime - entry.startTime;
            entry.success = result.success;
            entry.result = result;
            this.logger.log('debug', 'Hook executed', {
                hookId: registration.id,
                duration: entry.duration,
                success: result.success,
            });
        }
        catch (error) {
            entry.endTime = Date.now();
            entry.duration = entry.endTime - entry.startTime;
            entry.success = false;
            entry.error = error instanceof Error ? error.message : String(error);
            entry.result = {
                success: false,
                continue: registration.config.continueOnError,
                modified: false,
                error: entry.error,
            };
        }
        return entry;
    }
    /**
     * Execute hook action based on type
     */
    async executeHookAction(config, context, data) {
        const { action } = config;
        switch (action.type) {
            case 'script':
                return this.executeScript(action.script || '', context, data);
            case 'command':
                return this.executeCommand(action.command || '', context, data);
            case 'function':
                return this.executeFunction(action.function || '', context, data);
            default:
                return {
                    success: false,
                    continue: false,
                    modified: false,
                    error: `Unknown action type: ${action.type}`,
                };
        }
    }
    /**
     * Execute a script hook
     */
    async executeScript(script, context, data) {
        // Note: In a real implementation, this would execute the script safely
        // For now, we'll log and return success
        this.logger.log('debug', 'Executing script hook', { script: script.substring(0, 100) });
        return {
            success: true,
            continue: true,
            modified: false,
        };
    }
    /**
     * Execute a command hook
     */
    async executeCommand(command, context, data) {
        try {
            const result = await vscode.commands.executeCommand(command, { context, data });
            return {
                success: true,
                continue: true,
                modified: false,
                data: { result },
            };
        }
        catch (error) {
            return {
                success: false,
                continue: false,
                modified: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }
    /**
     * Execute a function hook
     */
    async executeFunction(functionName, context, data) {
        // Function hooks would be registered callbacks
        // This is a placeholder for the future implementation
        return {
            success: true,
            continue: true,
            modified: false,
        };
    }
    /**
     * Add execution entry to history
     */
    addExecutionEntry(entry) {
        this.executionHistory.unshift(entry);
        // Trim history to max size
        if (this.executionHistory.length > this.settings.maxHistory) {
            this.executionHistory = this.executionHistory.slice(0, this.settings.maxHistory);
        }
    }
    /**
     * Sort hooks by priority
     */
    sortHooks(type) {
        const hookMap = this.hooks.get(type);
        if (!hookMap)
            return;
        const sorted = Array.from(hookMap.values())
            .sort((a, b) => b.config.priority - a.config.priority);
        hookMap.clear();
        sorted.forEach(reg => hookMap.set(reg.id, reg));
    }
    /**
     * Get all registered hooks
     */
    getHooks() {
        const allHooks = [];
        for (const hookMap of this.hooks.values()) {
            allHooks.push(...hookMap.values());
        }
        return allHooks;
    }
    /**
     * Get hooks by type
     */
    getHooksByType(type) {
        const hookMap = this.hooks.get(type);
        return hookMap ? Array.from(hookMap.values()) : [];
    }
    /**
     * Get execution history
     */
    getExecutionHistory() {
        return [...this.executionHistory];
    }
    /**
     * Get execution history for a specific hook
     */
    getHookExecutionHistory(hookId) {
        return this.executionHistory.filter(entry => entry.hookId === hookId);
    }
    /**
     * Show hook list in quick pick
     */
    async showHookList() {
        const hooks = this.getHooks();
        if (hooks.length === 0) {
            vscode.window.showInformationMessage('No hooks registered');
            return;
        }
        const items = hooks.map(hook => ({
            label: `${hook.config.enabled ? '$(check)' : '$(x)'} ${hook.config.name}`,
            description: `${hook.config.type} | Priority: ${hook.config.priority}`,
            detail: hook.config.description || `${hook.executionCount} executions`,
            hook,
        }));
        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select a hook to view details',
            canPickMany: false,
        });
        if (selected) {
            const actions = [];
            if (selected.hook.config.enabled) {
                actions.push('Disable Hook');
            }
            else {
                actions.push('Enable Hook');
            }
            actions.push('View Execution History');
            actions.push('Delete Hook');
            const action = await vscode.window.showQuickPick(actions, {
                placeHolder: `Actions for ${selected.hook.config.name}`,
            });
            if (action === 'Disable Hook' || action === 'Enable Hook') {
                this.setHookEnabled(selected.hook.id, action === 'Enable Hook');
            }
            else if (action === 'View Execution History') {
                await this.showHookExecutionHistory(selected.hook.id);
            }
            else if (action === 'Delete Hook') {
                await this.unregisterHook(selected.hook.id);
            }
        }
    }
    /**
     * Show execution history in quick pick
     */
    async showExecutionHistory() {
        const history = this.getExecutionHistory();
        if (history.length === 0) {
            vscode.window.showInformationMessage('No execution history');
            return;
        }
        const items = history.slice(0, 50).map(entry => ({
            label: `${entry.success ? '$(check)' : '$(x)'} ${entry.hookName}`,
            description: `${entry.hookType} | ${entry.duration}ms`,
            detail: new Date(entry.startTime).toLocaleString(),
            entry,
        }));
        await vscode.window.showQuickPick(items, {
            placeHolder: 'Execution History (last 50)',
            canPickMany: false,
        });
    }
    /**
     * Show execution history for a specific hook
     */
    async showHookExecutionHistory(hookId) {
        const history = this.getHookExecutionHistory(hookId);
        if (history.length === 0) {
            vscode.window.showInformationMessage('No execution history for this hook');
            return;
        }
        const items = history.slice(0, 20).map(entry => ({
            label: `${entry.success ? '$(check)' : '$(x)'} ${new Date(entry.startTime).toLocaleString()}`,
            description: `${entry.duration}ms`,
            detail: entry.error || 'Success',
            entry,
        }));
        await vscode.window.showQuickPick(items, {
            placeHolder: `Execution History (last 20)`,
            canPickMany: false,
        });
    }
    /**
     * Set enabled state
     */
    setEnabled(enabled) {
        this.enabled = enabled;
        this.logger.log('info', `Hook system ${enabled ? 'enabled' : 'disabled'}`);
    }
    /**
     * Check if hook system is enabled
     */
    isEnabled() {
        return this.enabled;
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
    updateSettings(settings) {
        this.settings = { ...this.settings, ...settings };
        this.enabled = this.settings.enabled;
    }
    /**
     * Dispose the hook manager
     */
    dispose() {
        this.hooks.clear();
        this.executionHistory = [];
        this.logger.log('info', 'HookManager disposed');
    }
}
exports.HookManager = HookManager;
/**
 * Create a new HookManager instance
 */
function createHookManager(logger) {
    return new HookManager(logger);
}
//# sourceMappingURL=manager.js.map