"use strict";
/**
 * Morse WebView View
 * Base class for Morse VS Code extension webview views
 * Provides dashboard and quick actions panels
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
exports.MorseWebviewView = void 0;
const vscode = __importStar(require("vscode"));
class MorseWebviewView {
    panel;
    client;
    extensionUri;
    state;
    constructor(client, extensionUri, viewType, title) {
        this.client = client;
        this.extensionUri = extensionUri;
        this.state = {
            activePanel: 'dashboard',
            recentSessions: [],
            quickActions: this.getDefaultQuickActions(),
            metrics: {
                totalTokens: 0,
                totalRequests: 0,
                avgResponseTime: 0,
                cacheHitRate: 0,
            },
        };
    }
    async show() {
        if (this.panel) {
            this.panel.reveal();
            await this.refreshData();
            return;
        }
        this.panel = vscode.window.createWebviewPanel('morse.webview', 'Morse', vscode.ViewColumn.One, {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [this.extensionUri],
        });
        this.panel.onDidDispose(() => {
            this.panel = undefined;
        });
        this.panel.webview.onDidReceiveMessage(async (message) => {
            await this.handleMessage(message);
        });
        await this.refreshData();
        await this.updateContent();
    }
    async refreshData() {
        try {
            // Refresh metrics
            const metrics = this.client.getMetrics();
            this.state.metrics = {
                totalTokens: metrics.tokensUsed || 0,
                totalRequests: metrics.requestsTotal || 0,
                avgResponseTime: metrics.avgLatency || 0,
                cacheHitRate: 0, // Not available in current Metrics type
            };
            // Refresh recent sessions
            const sessions = await this.client.getSessions();
            this.state.recentSessions = sessions.slice(0, 10).map((s) => ({
                id: s.id,
                name: s.title,
                lastActive: new Date(s.updatedAt),
                messageCount: s.messages?.length || 0,
            }));
        }
        catch (error) {
            console.error('Failed to refresh webview data:', error);
        }
    }
    async handleMessage(message) {
        switch (message.command) {
            case 'refresh':
                await this.refreshData();
                await this.updateContent();
                break;
            case 'executeQuickAction':
                await this.executeQuickAction(message.payload);
                break;
            case 'switchPanel':
                await this.switchPanel(message.payload);
                break;
            case 'openSession':
                await this.openSession(message.payload);
                break;
            case 'openSettings':
                await vscode.commands.executeCommand('workbench.action.openSettings', 'morse');
                break;
            default:
                console.log('Unknown webview message:', message.command);
        }
    }
    async executeQuickAction(payload) {
        try {
            await vscode.commands.executeCommand(payload.action.command);
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to execute action: ${error}`);
        }
    }
    async switchPanel(payload) {
        this.state.activePanel = payload.panel;
        await this.updateContent();
    }
    async openSession(payload) {
        try {
            await vscode.commands.executeCommand('morse.sessions.open', payload.sessionId);
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to open session: ${error}`);
        }
    }
    generateHtml(state) {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Morse</title>
    <style>
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            padding: 16px;
        }
        
        .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 20px;
            padding-bottom: 16px;
            border-bottom: 1px solid var(--vscode-editorLineHighlightBorder);
        }
        
        .header h1 {
            font-size: 20px;
            font-weight: 600;
        }
        
        .tabs {
            display: flex;
            gap: 8px;
            margin-bottom: 20px;
        }
        
        .tab {
            padding: 8px 16px;
            border: none;
            background: transparent;
            color: var(--vscode-editor-foreground);
            cursor: pointer;
            border-radius: 4px;
            font-size: 14px;
            transition: background-color 0.2s;
        }
        
        .tab:hover {
            background-color: var(--vscode-editor-lineHighlightBackground);
        }
        
        .tab.active {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        
        .dashboard-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 16px;
            margin-bottom: 24px;
        }
        
        .metric-card {
            background-color: var(--vscode-editor-lineHighlightBackground);
            padding: 16px;
            border-radius: 8px;
        }
        
        .metric-card .label {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 4px;
        }
        
        .metric-card .value {
            font-size: 24px;
            font-weight: 600;
        }
        
        .section {
            margin-bottom: 24px;
        }
        
        .section h2 {
            font-size: 16px;
            margin-bottom: 12px;
        }
        
        .quick-actions-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 12px;
        }
        
        .quick-action {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px;
            background-color: var(--vscode-editor-lineHighlightBackground);
            border: 1px solid transparent;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s;
            text-align: left;
            color: var(--vscode-editor-foreground);
        }
        
        .quick-action:hover {
            border-color: var(--vscode-focusBorder);
            background-color: var(--vscode-list-activeSelectionBackground);
        }
        
        .quick-action .icon {
            font-size: 20px;
        }
        
        .quick-action .content {
            flex: 1;
        }
        
        .quick-action .label {
            font-weight: 500;
            margin-bottom: 2px;
        }
        
        .quick-action .description {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }
        
        .sessions-list {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        
        .session-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px;
            background-color: var(--vscode-editor-lineHighlightBackground);
            border-radius: 8px;
            cursor: pointer;
        }
        
        .session-item:hover {
            background-color: var(--vscode-list-activeSelectionBackground);
        }
        
        .session-info {
            flex: 1;
        }
        
        .session-name {
            font-weight: 500;
            margin-bottom: 4px;
        }
        
        .session-meta {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }
        
        .refresh-btn {
            padding: 8px 16px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 4px;
            cursor: pointer;
        }
        
        .refresh-btn:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Morse</h1>
        <button class="refresh-btn" onclick="refresh()">Refresh</button>
    </div>
    
    <div class="tabs">
        <button class="tab ${state.activePanel === 'dashboard' ? 'active' : ''}" onclick="switchPanel('dashboard')">Dashboard</button>
        <button class="tab ${state.activePanel === 'quickactions' ? 'active' : ''}" onclick="switchPanel('quickactions')">Quick Actions</button>
    </div>
    
    ${state.activePanel === 'dashboard' ? this.generateDashboardHtml(state) : this.generateQuickActionsHtml(state)}
    
    <script>
        const vscode = acquireVsCodeApi();
        
        function refresh() {
            vscode.postMessage({ command: 'refresh' });
        }
        
        function switchPanel(panel) {
            vscode.postMessage({ command: 'switchPanel', payload: { panel } });
        }
        
        function executeQuickAction(action) {
            vscode.postMessage({ command: 'executeQuickAction', payload: { action } });
        }
        
        function openSession(sessionId) {
            vscode.postMessage({ command: 'openSession', payload: { sessionId } });
        }
        
        function openSettings() {
            vscode.postMessage({ command: 'openSettings' });
        }
    </script>
</body>
</html>`;
    }
    generateDashboardHtml(state) {
        return `
    <div class="dashboard-grid">
        <div class="metric-card">
            <div class="label">Total Tokens</div>
            <div class="value">${this.formatNumber(state.metrics.totalTokens)}</div>
        </div>
        <div class="metric-card">
            <div class="label">Total Requests</div>
            <div class="value">${this.formatNumber(state.metrics.totalRequests)}</div>
        </div>
        <div class="metric-card">
            <div class="label">Avg Response Time</div>
            <div class="value">${state.metrics.avgResponseTime.toFixed(0)}ms</div>
        </div>
        <div class="metric-card">
            <div class="label">Cache Hit Rate</div>
            <div class="value">${(state.metrics.cacheHitRate * 100).toFixed(1)}%</div>
        </div>
    </div>
    
    <div class="section">
        <h2>Recent Sessions</h2>
        <div class="sessions-list">
            ${state.recentSessions.length > 0
            ? state.recentSessions.slice(0, 5).map(session => `
                <div class="session-item" onclick="openSession('${session.id}')">
                    <div class="session-info">
                        <div class="session-name">${session.name}</div>
                        <div class="session-meta">${session.messageCount} messages • ${this.formatDate(session.lastActive)}</div>
                    </div>
                </div>
            `).join('')
            : '<p style="color: var(--vscode-descriptionForeground);">No recent sessions</p>'}
        </div>
    </div>
    
    <div class="section">
        <h2>Quick Links</h2>
        <div class="quick-actions-grid">
            <button class="quick-action" onclick="openSettings()">
                <span class="icon">⚙️</span>
                <div class="content">
                    <div class="label">Settings</div>
                    <div class="description">Configure Morse preferences</div>
                </div>
            </button>
        </div>
    </div>`;
    }
    generateQuickActionsHtml(state) {
        return `
    <div class="section">
        <h2>Quick Actions</h2>
        <div class="quick-actions-grid">
            ${state.quickActions.map(action => `
                <button class="quick-action" onclick="executeQuickAction(${JSON.stringify(action).replace(/"/g, '"')})">
                    <span class="icon">${action.icon}</span>
                    <div class="content">
                        <div class="label">${action.label}</div>
                        <div class="description">${action.description}</div>
                    </div>
                </button>
            `).join('')}
        </div>
    </div>`;
    }
    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        }
        if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }
    formatDate(date) {
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);
        if (minutes < 1)
            return 'Just now';
        if (minutes < 60)
            return `${minutes}m ago`;
        if (hours < 24)
            return `${hours}h ago`;
        if (days < 7)
            return `${days}d ago`;
        return date.toLocaleDateString();
    }
    dispose() {
        if (this.panel) {
            this.panel.dispose();
            this.panel = undefined;
        }
    }
}
exports.MorseWebviewView = MorseWebviewView;
//# sourceMappingURL=MorseWebviewView.js.map