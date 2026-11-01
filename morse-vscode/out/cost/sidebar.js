"use strict";
/**
 * Cost sidebar panel for VS Code extension
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
exports.CostSidebarProvider = void 0;
exports.registerCostSidebar = registerCostSidebar;
const vscode = __importStar(require("vscode"));
const pricing_1 = require("./pricing");
class CostSidebarProvider {
    static viewType = 'morse.costView';
    view;
    context;
    tracker;
    disposables = [];
    constructor(context, tracker) {
        this.context = context;
        this.tracker = tracker;
    }
    /**
     * Resolve the webview
     */
    resolveWebviewView(webviewView, context, _token) {
        this.view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.context.extensionUri],
        };
        webviewView.webview.html = this.getHtml();
        // Listen for cost updates
        this.disposables.push(vscode.workspace.onDidChangeConfiguration(() => {
            this.refresh();
        }));
    }
    /**
     * Refresh the cost view
     */
    refresh() {
        if (this.view) {
            const breakdown = this.tracker.getCostBreakdown();
            const summary = this.tracker.getSummary(30);
            const budget = this.tracker.getDailyBudget();
            const projectedMonthly = this.tracker.getProjectedMonthlyCost();
            // Send update to webview
            this.view.webview.postMessage({
                type: 'costUpdate',
                payload: {
                    breakdown,
                    summary,
                    budget,
                    projectedMonthly,
                },
            });
        }
    }
    /**
     * Get HTML content for the sidebar
     */
    getHtml() {
        const breakdown = this.tracker.getCostBreakdown();
        const summary = this.tracker.getSummary(30);
        const budget = this.tracker.getDailyBudget();
        const projectedMonthly = this.tracker.getProjectedMonthlyCost();
        // Generate daily chart HTML
        const dailyChart = this.generateDailyChart(summary.dailyBreakdown.slice(0, 7));
        return `<!DOCTYPE html>
<html>
<head>
    <style>
        * {
            box-sizing: border-box;
        }
        body {
            padding: 16px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 13px;
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
        }
        h2 {
            margin: 0 0 16px 0;
            font-size: 16px;
            font-weight: 600;
        }
        .card {
            background: var(--vscode-editorWidget-background);
            border: 1px solid var(--vscode-editorWidget-border);
            border-radius: 6px;
            padding: 12px;
            margin-bottom: 12px;
        }
        .card-title {
            font-size: 11px;
            text-transform: uppercase;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 8px;
        }
        .stat {
            font-size: 24px;
            font-weight: 600;
            margin-bottom: 4px;
        }
        .stat-secondary {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }
        .section-title {
            font-size: 12px;
            font-weight: 600;
            margin: 16px 0 8px 0;
            color: var(--vscode-foreground);
        }
        .breakdown-item {
            display: flex;
            justify-content: space-between;
            padding: 6px 0;
            border-bottom: 1px solid var(--vscode-editorWidget-border);
        }
        .breakdown-item:last-child {
            border-bottom: none;
        }
        .progress-bar {
            width: 100%;
            height: 8px;
            background: var(--vscode-editorWidget-background);
            border-radius: 4px;
            overflow: hidden;
            margin-top: 8px;
        }
        .progress-fill {
            height: 100%;
            background: var(--vscode-progressBar-background);
            border-radius: 4px;
            transition: width 0.3s ease;
        }
        .chart-container {
            display: flex;
            align-items: flex-end;
            height: 60px;
            gap: 4px;
            padding: 8px 0;
        }
        .chart-bar {
            flex: 1;
            background: var(--vscode-progressBar-background);
            border-radius: 2px;
            min-width: 8px;
            transition: height 0.3s ease;
        }
        .chart-label {
            font-size: 9px;
            text-align: center;
            color: var(--vscode-descriptionForeground);
            margin-top: 4px;
        }
        .btn {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 6px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            margin-right: 8px;
        }
        .btn:hover {
            background: var(--vscode-button-hoverBackground);
        }
        .actions {
            display: flex;
            gap: 8px;
            margin-top: 16px;
        }
        .warning {
            color: var(--vscode-errorForeground);
        }
    </style>
</head>
<body>
    <h2>💰 Cost Tracking</h2>
    
    <!-- Today's Summary -->
    <div class="card">
        <div class="card-title">Today's Cost</div>
        <div class="stat">${(0, pricing_1.formatCostUSD)(breakdown.totalCost)}</div>
        <div class="stat-secondary">${breakdown.totalTokens.toLocaleString()} tokens</div>
        ${budget > 0 ? `
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${Math.min(100, (breakdown.totalCost / budget) * 100)}%"></div>
            </div>
            <div class="stat-secondary">${((breakdown.totalCost / budget) * 100).toFixed(1)}% of ${(0, pricing_1.formatCostUSD)(budget)} budget</div>
        ` : ''}
    </div>

    <!-- Projected Monthly -->
    <div class="card">
        <div class="card-title">Projected Monthly</div>
        <div class="stat">${(0, pricing_1.formatCostUSD)(projectedMonthly)}</div>
        <div class="stat-secondary">${(0, pricing_1.formatCostINR)(projectedMonthly)}</div>
    </div>

    <!-- Weekly Chart -->
    <div class="card">
        <div class="card-title">Last 7 Days</div>
        ${dailyChart}
    </div>

    <!-- By Provider -->
    <div class="section-title">By Provider</div>
    <div class="card">
        ${Object.keys(breakdown.byProvider).length === 0
            ? '<div class="stat-secondary">No data yet</div>'
            : Object.entries(breakdown.byProvider).map(([provider, cost]) => `
                <div class="breakdown-item">
                    <span>${provider}</span>
                    <span>${(0, pricing_1.formatCostUSD)(cost)}</span>
                </div>
            `).join('')}
    </div>

    <!-- By Model -->
    <div class="section-title">By Model (Today)</div>
    <div class="card">
        ${Object.keys(breakdown.byModel).length === 0
            ? '<div class="stat-secondary">No data yet</div>'
            : Object.entries(breakdown.byModel).map(([model, cost]) => `
                <div class="breakdown-item">
                    <span>${model.length > 20 ? model.substring(0, 20) + '...' : model}</span>
                    <span>${(0, pricing_1.formatCostUSD)(cost)}</span>
                </div>
            `).join('')}
    </div>

    <!-- Actions -->
    <div class="actions">
        <button class="btn" onclick="vscode.postMessage({ type: 'showHistory' })">History</button>
        <button class="btn" onclick="vscode.postMessage({ type: 'setBudget' })">Budget</button>
        <button class="btn" onclick="vscode.postMessage({ type: 'export' })">Export</button>
    </div>

    <script>
        const vscode = acquireVsCodeApi();

        // Listen for messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            if (message.type === 'costUpdate') {
                // Update UI with new data
                console.log('Cost update received:', message.payload);
            }
        });

        // Handle button clicks
        document.querySelectorAll('.btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.textContent.toLowerCase();
                if (action === 'history') {
                    vscode.postMessage({ type: 'command', command: 'morse.cost.history' });
                } else if (action === 'budget') {
                    vscode.postMessage({ type: 'command', command: 'morse.cost.budget' });
                } else if (action === 'export') {
                    vscode.postMessage({ type: 'command', command: 'morse.cost.export' });
                }
            });
        });
    </script>
</body>
</html>`;
    }
    /**
     * Generate daily chart HTML
     */
    generateDailyChart(daily) {
        if (daily.length === 0) {
            return '<div class="stat-secondary">No data yet</div>';
        }
        const maxCost = Math.max(...daily.map(d => d.costUSD), 0.01);
        const bars = daily.map(d => {
            const height = Math.max(4, (d.costUSD / maxCost) * 100);
            const dayName = new Date(d.date).toLocaleDateString('en-US', { weekday: 'short' });
            return `
                <div style="flex: 1; display: flex; flex-direction: column; align-items: center;">
                    <div class="chart-bar" style="height: ${height}%"></div>
                    <div class="chart-label">${dayName}</div>
                </div>
            `;
        }).join('');
        return `<div class="chart-container">${bars}</div>`;
    }
    /**
     * Dispose resources
     */
    dispose() {
        this.disposables.forEach(d => d.dispose());
    }
}
exports.CostSidebarProvider = CostSidebarProvider;
/**
 * Register the cost sidebar provider
 */
function registerCostSidebar(context, tracker) {
    const provider = new CostSidebarProvider(context, tracker);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(CostSidebarProvider.viewType, provider));
    return provider;
}
//# sourceMappingURL=sidebar.js.map