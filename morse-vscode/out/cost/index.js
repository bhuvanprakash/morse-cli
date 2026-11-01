"use strict";
/**
 * Cost tracking module for Morse VS Code extension
 *
 * This module provides cost tracking functionality similar to `morse cost` in the CLI.
 * It tracks token usage, calculates costs based on provider pricing, and provides
 * UI components for displaying cost information.
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
exports.CostSidebarProvider = exports.PRICING_TABLE = exports.formatCostINR = exports.formatCostUSD = exports.calculateCost = exports.CostTracker = void 0;
exports.initializeCostTracking = initializeCostTracking;
exports.getCostTracker = getCostTracker;
exports.refreshCostSidebar = refreshCostSidebar;
exports.logUsage = logUsage;
exports.getSessionCost = getSessionCost;
exports.resetCostTracking = resetCostTracking;
const vscode = __importStar(require("vscode"));
const tracker_1 = require("./tracker");
Object.defineProperty(exports, "CostTracker", { enumerable: true, get: function () { return tracker_1.CostTracker; } });
const pricing_1 = require("./pricing");
Object.defineProperty(exports, "calculateCost", { enumerable: true, get: function () { return pricing_1.calculateCost; } });
Object.defineProperty(exports, "formatCostUSD", { enumerable: true, get: function () { return pricing_1.formatCostUSD; } });
Object.defineProperty(exports, "formatCostINR", { enumerable: true, get: function () { return pricing_1.formatCostINR; } });
Object.defineProperty(exports, "PRICING_TABLE", { enumerable: true, get: function () { return pricing_1.PRICING_TABLE; } });
const commands_1 = require("./commands");
const sidebar_1 = require("./sidebar");
Object.defineProperty(exports, "CostSidebarProvider", { enumerable: true, get: function () { return sidebar_1.CostSidebarProvider; } });
let trackerInstance = null;
let sidebarProvider = null;
/**
 * Initialize the cost tracking system
 * Call this from the extension's activate function
 */
function initializeCostTracking(context) {
    console.log('[Cost] Initializing cost tracking...');
    // Create or get tracker instance
    if (!trackerInstance) {
        trackerInstance = new tracker_1.CostTracker(context);
    }
    // Register cost commands
    (0, commands_1.registerCostCommands)(context, trackerInstance);
    // Register sidebar provider
    sidebarProvider = (0, sidebar_1.registerCostSidebar)(context, trackerInstance);
    // Set up status bar integration
    setupStatusBar(context, trackerInstance);
    console.log('[Cost] Cost tracking initialized');
    return trackerInstance;
}
/**
 * Set up status bar integration for cost display
 */
function setupStatusBar(context, tracker) {
    // Create status bar item for cost display
    const costStatusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 103);
    costStatusBar.command = 'morse.cost.show';
    costStatusBar.tooltip = 'Click to view cost details';
    // Update cost display
    const updateCostDisplay = () => {
        const breakdown = tracker.getCostBreakdown();
        costStatusBar.text = `$(credit-card) ${(0, pricing_1.formatCostUSD)(breakdown.totalCost)}`;
        // Show warning if over budget
        const budgetRatio = tracker.getBudgetRatio();
        if (budgetRatio >= 1) {
            costStatusBar.text = `$(warning) ${(0, pricing_1.formatCostUSD)(breakdown.totalCost)}`;
            costStatusBar.color = '#f14c4c';
        }
        else if (budgetRatio >= 0.8) {
            costStatusBar.color = '#cca700';
        }
        else {
            costStatusBar.color = undefined;
        }
    };
    // Initial update
    updateCostDisplay();
    // Update periodically
    const interval = setInterval(updateCostDisplay, 30000);
    // Listen for configuration changes
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(() => {
        updateCostDisplay();
    }));
    // Add to context subscriptions
    context.subscriptions.push(costStatusBar);
    context.subscriptions.push({
        dispose: () => clearInterval(interval)
    });
    costStatusBar.show();
}
/**
 * Get the cost tracker instance
 */
function getCostTracker(context) {
    if (context && !trackerInstance) {
        trackerInstance = new tracker_1.CostTracker(context);
    }
    return trackerInstance;
}
/**
 * Refresh the cost sidebar
 */
function refreshCostSidebar() {
    if (sidebarProvider) {
        sidebarProvider.refresh();
    }
}
/**
 * Log a usage event (call this when making API requests)
 *
 * @param provider The provider name (e.g., 'openai', 'anthropic')
 * @param model The model name (e.g., 'gpt-4o')
 * @param command The command type (e.g., 'chat', 'edit')
 * @param inputTokens Number of input tokens
 * @param outputTokens Number of output tokens
 */
function logUsage(provider, model, command, inputTokens, outputTokens) {
    if (trackerInstance) {
        trackerInstance.log({
            provider,
            model,
            command,
            inputTokens,
            outputTokens,
        });
        // Refresh sidebar after logging
        refreshCostSidebar();
    }
}
/**
 * Get cost breakdown for the current session
 */
function getSessionCost() {
    return trackerInstance?.getCostBreakdown() ?? null;
}
/**
 * Reset cost tracking
 */
function resetCostTracking() {
    trackerInstance?.reset();
    refreshCostSidebar();
}
//# sourceMappingURL=index.js.map