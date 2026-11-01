"use strict";
/**
 * Built-in Hooks
 *
 * Provides built-in hooks for common use cases:
 * - Command validator
 * - File change tracker
 * - Cost tracker
 * - Audit log
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
exports.registerBuiltInHooks = registerBuiltInHooks;
__exportStar(require("./commandValidator"), exports);
__exportStar(require("./fileTracker"), exports);
__exportStar(require("./costTracker"), exports);
__exportStar(require("./auditLog"), exports);
const commandValidator_1 = require("./commandValidator");
/**
 * Register built-in hooks
 */
function registerBuiltInHooks(manager, configs = {}) {
    // Command validator hook
    if (configs.commandValidator?.enabled !== false) {
        const cmdValidator = new commandValidator_1.CommandValidatorHook(configs.commandValidator || {});
        manager.registerHook({
            id: 'builtin:command-validator',
            name: 'Command Validator',
            description: 'Validates commands before execution',
            type: 'preExecute',
            enabled: true,
            action: { type: 'function', function: 'commandValidator' },
            priority: 200,
            executionMode: 'sync',
            continueOnError: false,
        });
    }
    // File tracker hook
    if (configs.fileTracker?.enabled !== false) {
        manager.registerHook({
            id: 'builtin:file-tracker',
            name: 'File Tracker',
            description: 'Tracks file changes during execution',
            type: 'postEdit',
            enabled: true,
            action: { type: 'function', function: 'fileTracker' },
            priority: 100,
            executionMode: 'sync',
            continueOnError: true,
        });
    }
    // Cost tracker hook
    if (configs.costTracker?.enabled !== false) {
        manager.registerHook({
            id: 'builtin:cost-tracker',
            name: 'Cost Tracker',
            description: 'Tracks API costs during execution',
            type: 'postExecute',
            enabled: true,
            action: { type: 'function', function: 'costTracker' },
            priority: 50,
            executionMode: 'sync',
            continueOnError: true,
        });
    }
    // Audit log hook
    if (configs.auditLog?.enabled !== false) {
        manager.registerHook({
            id: 'builtin:audit-log',
            name: 'Audit Log',
            description: 'Logs all operations for auditing',
            type: 'postExecute',
            enabled: true,
            action: { type: 'function', function: 'auditLog' },
            priority: 10,
            executionMode: 'async',
            continueOnError: true,
        });
    }
}
//# sourceMappingURL=index.js.map