"use strict";
/**
 * Cost commands for VS Code extension
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
exports.registerCostCommands = registerCostCommands;
exports.formatCostBreakdown = formatCostBreakdown;
const vscode = __importStar(require("vscode"));
const pricing_1 = require("./pricing");
/**
 * Register cost-related commands
 */
function registerCostCommands(context, tracker) {
    // Register cost.show command
    registerCostShowCommand(context, tracker);
    // Register cost.history command
    registerCostHistoryCommand(context, tracker);
    // Register cost.reset command
    registerCostResetCommand(context, tracker);
    // Register cost.export command
    registerCostExportCommand(context, tracker);
    // Register cost.budget command
    registerCostBudgetCommand(context, tracker);
}
/**
 * Register morse.cost.show command - Display current session costs
 */
function registerCostShowCommand(context, tracker) {
    context.subscriptions.push(vscode.commands.registerCommand('morse.cost.show', async () => {
        try {
            const breakdown = tracker.getCostBreakdown();
            const today = tracker.getToday();
            const summary = tracker.getSummary(1);
            // Calculate totals
            let totalInputTokens = 0;
            let totalOutputTokens = 0;
            let model = '-';
            let provider = '-';
            today.forEach(r => {
                totalInputTokens += r.inputTokens;
                totalOutputTokens += r.outputTokens;
                provider = r.provider;
                model = r.model;
            });
            const totalTokens = totalInputTokens + totalOutputTokens;
            const inRatio = totalTokens > 0 ? totalInputTokens / totalTokens : 0;
            const outRatio = totalTokens > 0 ? totalOutputTokens / totalTokens : 0;
            const inputCost = breakdown.totalCost * inRatio;
            const outputCost = breakdown.totalCost * outRatio;
            const budget = tracker.getDailyBudget();
            const budgetRatio = budget > 0 ? breakdown.totalCost / budget : 0;
            // Format message
            const message = [
                `**Session Cost**`,
                ``,
                `Provider: ${provider} | Model: ${model}`,
                `Duration: Today | Queries: ${today.length}`,
                ``,
                `Input tokens:  ${totalInputTokens.toLocaleString()}  ${(0, pricing_1.formatCostUSD)(inputCost)}`,
                `Output tokens: ${totalOutputTokens.toLocaleString()}  ${(0, pricing_1.formatCostUSD)(outputCost)}`,
                `Total: ${(0, pricing_1.formatCostUSD)(breakdown.totalCost)} (~${(0, pricing_1.formatCostINR)(breakdown.totalCost)})`,
                ``,
                budget > 0
                    ? `Budget: ${(0, pricing_1.formatCostUSD)(breakdown.totalCost)} of ${(0, pricing_1.formatCostUSD)(budget)} daily (${(budgetRatio * 100).toFixed(1)}%)`
                    : `No daily budget set. Use morse.cost.budget to set one.`,
            ];
            const selection = await vscode.window.showInformationMessage(message.join('\n'), { modal: true }, 'View History', 'Set Budget', 'Close');
            if (selection === 'View History') {
                await vscode.commands.executeCommand('morse.cost.history');
            }
            else if (selection === 'Set Budget') {
                await vscode.commands.executeCommand('morse.cost.budget');
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to show cost: ${error}`);
        }
    }));
}
/**
 * Register morse.cost.history command - Show cost history
 */
function registerCostHistoryCommand(context, tracker) {
    context.subscriptions.push(vscode.commands.registerCommand('morse.cost.history', async () => {
        try {
            const summary = tracker.getSummary(30);
            // Build history message
            const lines = [
                `**Cost History (Last 30 Days)**`,
                ``,
                `Total Cost: ${(0, pricing_1.formatCostUSD)(summary.totalCostUSD)}`,
                `Total Tokens: ${summary.totalTokens.toLocaleString()}`,
                ``,
                `**Daily Breakdown**`,
            ];
            // Add daily breakdown (last 7 days)
            const last7Days = summary.dailyBreakdown.slice(0, 7);
            for (const day of last7Days) {
                const date = new Date(day.date).toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                });
                lines.push(`${date}: ${(0, pricing_1.formatCostUSD)(day.costUSD)} (${day.tokenCount.toLocaleString()} tokens)`);
            }
            lines.push(``);
            lines.push(`**By Model**`);
            const sortedModels = Object.entries(summary.byModel)
                .sort((a, b) => b[1] - a[1]);
            for (const [model, cost] of sortedModels.slice(0, 5)) {
                lines.push(`${model}: ${(0, pricing_1.formatCostUSD)(cost)}`);
            }
            const selection = await vscode.window.showInformationMessage(lines.join('\n'), { modal: true }, 'Export Data', 'Reset', 'Close');
            if (selection === 'Export Data') {
                await vscode.commands.executeCommand('morse.cost.export');
            }
            else if (selection === 'Reset') {
                await vscode.commands.executeCommand('morse.cost.reset');
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to show history: ${error}`);
        }
    }));
}
/**
 * Register morse.cost.reset command - Reset cost tracking
 */
function registerCostResetCommand(context, tracker) {
    context.subscriptions.push(vscode.commands.registerCommand('morse.cost.reset', async () => {
        const selection = await vscode.window.showWarningMessage('Are you sure you want to reset all cost tracking data? This cannot be undone.', { modal: true }, 'Reset', 'Cancel');
        if (selection === 'Reset') {
            tracker.reset();
            vscode.window.showInformationMessage('Cost tracking has been reset');
        }
    }));
}
/**
 * Register morse.cost.export command - Export cost data
 */
function registerCostExportCommand(context, tracker) {
    context.subscriptions.push(vscode.commands.registerCommand('morse.cost.export', async () => {
        try {
            const data = tracker.exportData();
            // Create a temporary file
            const uri = await vscode.window.showSaveDialog({
                defaultUri: vscode.Uri.file(`morse-cost-export-${new Date().toISOString().split('T')[0]}.json`),
                filters: {
                    'JSON': ['json'],
                },
            });
            if (uri) {
                const encoder = new TextEncoder();
                await vscode.workspace.fs.writeFile(uri, encoder.encode(data));
                vscode.window.showInformationMessage(`Cost data exported to ${uri.fsPath}`);
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to export cost data: ${error}`);
        }
    }));
}
/**
 * Register morse.cost.budget command - Set daily budget
 */
function registerCostBudgetCommand(context, tracker) {
    context.subscriptions.push(vscode.commands.registerCommand('morse.cost.budget', async () => {
        const currentBudget = tracker.getDailyBudget();
        const input = await vscode.window.showInputBox({
            prompt: 'Enter daily budget in USD',
            value: currentBudget > 0 ? currentBudget.toString() : '5',
            validateInput: (value) => {
                const num = parseFloat(value);
                if (isNaN(num) || num < 0) {
                    return 'Please enter a valid positive number';
                }
                return null;
            },
        });
        if (input !== undefined) {
            const budget = parseFloat(input);
            tracker.setDailyBudget(budget);
            vscode.window.showInformationMessage(`Daily budget set to ${(0, pricing_1.formatCostUSD)(budget)}`);
        }
    }));
}
/**
 * Format a cost breakdown for display
 */
function formatCostBreakdown(breakdown) {
    const lines = [
        `**Cost Breakdown**`,
        ``,
        `Total: ${(0, pricing_1.formatCostUSD)(breakdown.totalCost)}`,
        `Tokens: ${breakdown.totalTokens.toLocaleString()}`,
        ``,
    ];
    if (Object.keys(breakdown.byProvider).length > 0) {
        lines.push(`**By Provider**`);
        for (const [provider, cost] of Object.entries(breakdown.byProvider)) {
            lines.push(`- ${provider}: ${(0, pricing_1.formatCostUSD)(cost)}`);
        }
        lines.push(``);
    }
    if (Object.keys(breakdown.byModel).length > 0) {
        lines.push(`**By Model**`);
        for (const [model, cost] of Object.entries(breakdown.byModel)) {
            lines.push(`- ${model}: ${(0, pricing_1.formatCostUSD)(cost)}`);
        }
    }
    return lines.join('\n');
}
//# sourceMappingURL=commands.js.map