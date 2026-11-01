"use strict";
/**
 * Hook System
 *
 * A comprehensive hook system for Morse VS Code extension that provides:
 * - Pre/post execution hooks
 * - Error handling hooks
 * - Message and tool call hooks
 * - Configurable hook actions (script, command, function)
 * - Hook execution history and logging
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
exports.initializeHooks = initializeHooks;
exports.createHookSystem = createHookSystem;
__exportStar(require("./types"), exports);
__exportStar(require("./manager"), exports);
__exportStar(require("./config"), exports);
__exportStar(require("./ui"), exports);
const manager_1 = require("./manager");
const config_1 = require("./config");
const ui_1 = require("./ui");
/**
 * Initialize the hook system
 */
async function initializeHooks(context, options) {
    const manager = (0, manager_1.createHookManager)();
    const config = (0, config_1.createHookConfigManager)();
    const ui = (0, ui_1.createHookUI)();
    // Initialize components
    await manager.initialize(context);
    await config.initialize(context);
    ui.initialize(context);
    // Set up config change callback to reload hooks
    config.setOnConfigChangeCallback(async () => {
        await manager.reloadHooks();
        const settings = config.getSettings();
        manager.setEnabled(settings.enabled);
        ui.updateStatusBar(settings.enabled, settings.hooks.length);
    });
    // Register built-in hooks if enabled
    if (options?.enableBuiltInHooks !== false) {
        // Built-in hooks will be registered separately
    }
    // Update status bar
    const settings = config.getSettings();
    ui.updateStatusBar(settings.enabled, settings.hooks.length);
    // Set status bar visibility
    if (options?.showStatusBar !== undefined) {
        ui.setStatusBarVisible(options.showStatusBar);
    }
    console.log('[Hooks] System initialized');
    return { manager, config, ui };
}
/**
 * Create a default hook system instance
 */
function createHookSystem() {
    return {
        manager: (0, manager_1.createHookManager)(),
        config: (0, config_1.createHookConfigManager)(),
        ui: (0, ui_1.createHookUI)(),
    };
}
//# sourceMappingURL=index.js.map