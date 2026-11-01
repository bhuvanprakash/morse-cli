"use strict";
/**
 * Settings Panel for Morse VS Code Extension
 * Provides a comprehensive settings interface for model/provider/cache configuration
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
exports.SettingsPanel = void 0;
exports.registerSettingsCommands = registerSettingsCommands;
const vscode = __importStar(require("vscode"));
class SettingsPanel {
    panel;
    client;
    constructor(client) {
        this.client = client;
    }
    async show() {
        if (this.panel) {
            this.panel.reveal();
            return;
        }
        this.panel = vscode.window.createWebviewPanel('morse.settings', 'Morse Settings', vscode.ViewColumn.One, {
            enableScripts: true,
            retainContextWhenHidden: true,
        });
        this.panel.onDidDispose(() => {
            this.panel = undefined;
        });
        await this.updatePanelContent();
    }
    async updatePanelContent() {
        if (!this.panel)
            return;
        const config = vscode.workspace.getConfiguration('morse');
        const connectionState = this.client.getConnectionState();
        const metrics = this.client.getMetrics();
        const rateLimitStatus = this.client.getRateLimitStatus();
        // Get current model and provider
        const currentModel = this.client.getCurrentModel();
        const currentProvider = this.client.getCurrentProvider();
        // Get available models and providers
        const models = await this.client.getAvailableModels();
        const providers = await this.client.getProviders();
        // Get tool status and cache status
        const toolStatus = await this.client.getToolStatus();
        const cacheStatus = await this.client.getCacheStatus();
        this.panel.webview.html = this.generateSettingsHtml({
            config,
            connectionState,
            metrics,
            rateLimitStatus,
            currentModel,
            currentProvider,
            models,
            providers,
            toolStatus,
            cacheStatus,
        });
        // Set up message handler
        this.panel.webview.onDidReceiveMessage(async (message) => {
            await this.handleMessage(message);
        });
    }
    async handleMessage(message) {
        switch (message.command) {
            case 'setModel':
                await this.client.setModel(message.value);
                await this.updatePanelContent();
                vscode.window.showInformationMessage(`Model changed to ${message.value}`);
                break;
            case 'setProvider':
                await this.client.setProvider(message.value);
                await this.updatePanelContent();
                vscode.window.showInformationMessage(`Provider changed to ${message.value}`);
                break;
            case 'setConfig':
                const config = vscode.workspace.getConfiguration('morse');
                await config.update(message.value.key, message.value.value, true);
                await this.updatePanelContent();
                break;
            case 'clearCache':
                try {
                    await this.client.clearCache();
                    vscode.window.showInformationMessage('Cache cleared');
                    await this.updatePanelContent();
                }
                catch (error) {
                    vscode.window.showErrorMessage(`Failed to clear cache: ${error}`);
                }
                break;
            case 'testConnection':
                try {
                    const connected = await this.client.checkConnection();
                    if (connected) {
                        vscode.window.showInformationMessage('Connection successful');
                    }
                    else {
                        vscode.window.showWarningMessage('Connection failed - check your endpoint');
                    }
                }
                catch (error) {
                    vscode.window.showErrorMessage(`Connection test failed: ${error}`);
                }
                break;
            case 'openSettings':
                vscode.commands.executeCommand('workbench.action.openSettings', 'morse');
                break;
        }
    }
    generateSettingsHtml(data) {
        const { config, connectionState, metrics, rateLimitStatus, currentModel, currentProvider, models, providers, toolStatus, cacheStatus } = data;
        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        * { box-sizing: border-box; }
        body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            color: var(--vscode-foreground);
            background: var(--vscode-editor-background);
        }
        h1 { font-size: 1.5em; margin-bottom: 20px; }
        h2 { font-size: 1.2em; margin-top: 20px; margin-bottom: 10px; }
        .section {
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-focusBorder);
            border-radius: 5px;
            padding: 15px;
            margin-bottom: 15px;
        }
        .row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 0;
            border-bottom: 1px solid var(--vscode-editorLineNumber-foreground);
        }
        .row:last-child { border-bottom: none; }
        .label { font-weight: bold; }
        .value { color: var(--vscode-foreground); }
        .status-connected { color: #4caf50; }
        .status-disconnected { color: #f44336; }
        .status-connecting { color: #ff9800; }
        select, input {
            padding: 5px 10px;
            border-radius: 3px;
            border: 1px solid var(--vscode-focusBorder);
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
        }
        button {
            padding: 8px 16px;
            border-radius: 3px;
            border: none;
            cursor: pointer;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        button:hover { opacity: 0.9; }
        button.secondary {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
        }
        .card {
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-focusBorder);
            border-radius: 5px;
            padding: 15px;
        }
        .card-title { font-weight: bold; margin-bottom: 10px; }
        .badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 10px;
            font-size: 0.8em;
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
        }
        .badge-enabled { background: #4caf50; color: white; }
        .badge-disabled { background: #9e9e9e; color: white; }
    </style>
</head>
<body>
    <h1>Morse Settings</h1>

    <!-- Connection Status -->
    <div class="section">
        <h2>Connection Status</h2>
        <div class="row">
            <span class="label">Status:</span>
            <span class="value status-${connectionState.status}">
                ${connectionState.status === 'connected' ? '🟢 Connected' :
            connectionState.status === 'connecting' ? '🟡 Connecting...' :
                connectionState.status === 'error' ? '🔴 Error' : '⚪ Disconnected'}
            </span>
        </div>
        <div class="row">
            <span class="label">Latency:</span>
            <span class="value">${connectionState.latency ? `${connectionState.latency}ms` : 'N/A'}</span>
        </div>
        <div class="row">
            <span class="label">Endpoint:</span>
            <span class="value">${config.get('endpoint')}</span>
        </div>
        <div class="row">
            <button class="secondary" onclick="testConnection()">Test Connection</button>
        </div>
    </div>

    <!-- Model & Provider -->
    <div class="section">
        <h2>Model & Provider</h2>
        <div class="row">
            <span class="label">Provider:</span>
            <select id="providerSelect" onchange="setProvider(this.value)">
                ${providers.map(p => `<option value="${p.name}" ${p.name === currentProvider ? 'selected' : ''}>
                        ${p.name} ${!p.enabled ? '(disabled)' : ''}
                    </option>`).join('')}
            </select>
        </div>
        <div class="row">
            <span class="label">Model:</span>
            <select id="modelSelect" onchange="setModel(this.value)">
                ${models.map(m => `<option value="${m.id}" ${m.id === currentModel ? 'selected' : ''}>
                        ${m.name} (${m.contextLength.toLocaleString()} tokens)
                    </option>`).join('')}
            </select>
        </div>
        <div class="row">
            <button onclick="openSettings()">Open VS Code Settings</button>
        </div>
    </div>

    <!-- Rate Limiting -->
    <div class="section">
        <h2>Rate Limiting</h2>
        <div class="grid">
            <div class="card">
                <div class="card-title">Requests</div>
                <div>Current: ${rateLimitStatus.currentRequests} / ${rateLimitStatus.maxRequestsPerMinute}</div>
            </div>
            <div class="card">
                <div class="card-title">Tokens</div>
                <div>Current: ${rateLimitStatus.currentTokens.toLocaleString()} / ${rateLimitStatus.maxTokensPerMinute.toLocaleString()}</div>
            </div>
        </div>
    </div>

    <!-- Metrics -->
    <div class="section">
        <h2>Usage Metrics</h2>
        <div class="grid">
            <div class="card">
                <div class="card-title">Total Requests</div>
                <div>${metrics.requestsTotal.toLocaleString()}</div>
            </div>
            <div class="card">
                <div class="card-title">Successful</div>
                <div>${metrics.requestsSuccess.toLocaleString()}</div>
            </div>
            <div class="card">
                <div class="card-title">Failed</div>
                <div>${metrics.requestsFailed.toLocaleString()}</div>
            </div>
            <div class="card">
                <div class="card-title">Tokens Used</div>
                <div>${metrics.tokensUsed.toLocaleString()}</div>
            </div>
            <div class="card">
                <div class="card-title">Total Cost</div>
                <div>$${metrics.costUSD.toFixed(4)}</div>
            </div>
            <div class="card">
                <div class="card-title">Avg Latency</div>
                <div>${metrics.avgLatency.toFixed(0)}ms</div>
            </div>
        </div>
    </div>

    <!-- Tool Status -->
    <div class="section">
        <h2>Available Tools</h2>
        ${toolStatus.length > 0 ? `
            <table style="width:100%; border-collapse: collapse;">
                <tr style="border-bottom: 1px solid var(--vscode-editorLineNumber-foreground);">
                    <th style="text-align:left; padding: 5px;">Tool</th>
                    <th style="text-align:left; padding: 5px;">Status</th>
                    <th style="text-align:left; padding: 5px;">Cached</th>
                    <th style="text-align:left; padding: 5px;">Uses</th>
                </tr>
                ${toolStatus.map(t => `
                    <tr>
                        <td style="padding: 5px;">${t.name}</td>
                        <td style="padding: 5px;">
                            <span class="badge ${t.enabled ? 'badge-enabled' : 'badge-disabled'}">
                                ${t.enabled ? 'Enabled' : 'Disabled'}
                            </span>
                        </td>
                        <td style="padding: 5px;">${t.cached ? '✓' : '—'}</td>
                        <td style="padding: 5px;">${t.executionCount || 0}</td>
                    </tr>
                `).join('')}
            </table>
        ` : '<p>No tools available</p>'}
    </div>

    <!-- Cache Status -->
    <div class="section">
        <h2>Cache</h2>
        <div class="row">
            <span class="label">Status:</span>
            <span class="badge ${cacheStatus.enabled ? 'badge-enabled' : 'badge-disabled'}">
                ${cacheStatus.enabled ? 'Enabled' : 'Disabled'}
            </span>
        </div>
        <div class="row">
            <span class="label">Size:</span>
            <span class="value">${(cacheStatus.size / 1024 / 1024).toFixed(2)} MB / ${(cacheStatus.maxSize / 1024 / 1024).toFixed(0)} MB</span>
        </div>
        <div class="row">
            <span class="label">Entries:</span>
            <span class="value">${cacheStatus.entries.toLocaleString()}</span>
        </div>
        <div class="row">
            <span class="label">Hit Rate:</span>
            <span class="value">${(cacheStatus.hitRate * 100).toFixed(1)}%</span>
        </div>
        <div class="row">
            <button class="secondary" onclick="clearCache()">Clear Cache</button>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();

        function setModel(value) {
            vscode.postMessage({ command: 'setModel', value });
        }

        function setProvider(value) {
            vscode.postMessage({ command: 'setProvider', value });
        }

        function setConfig(key, value) {
            vscode.postMessage({ command: 'setConfig', value: { key, value } });
        }

        function clearCache() {
            if (confirm('Are you sure you want to clear the cache?')) {
                vscode.postMessage({ command: 'clearCache' });
            }
        }

        function testConnection() {
            vscode.postMessage({ command: 'testConnection' });
        }

        function openSettings() {
            vscode.postMessage({ command: 'openSettings' });
        }
    </script>
</body>
</html>`;
    }
}
exports.SettingsPanel = SettingsPanel;
/**
 * Register settings commands
 */
function registerSettingsCommands(context, client) {
    const settingsPanel = new SettingsPanel(client);
    context.subscriptions.push(vscode.commands.registerCommand('morse.settings', async () => {
        await settingsPanel.show();
    }), vscode.commands.registerCommand('morse.selectModel', async () => {
        const models = await client.getAvailableModels();
        const items = models.map(m => ({
            label: m.name,
            description: `${m.provider} - ${m.contextLength.toLocaleString()} tokens`,
            model: m.id,
        }));
        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select a model',
        });
        if (selected) {
            await client.setModel(selected.model);
            vscode.window.showInformationMessage(`Model changed to ${selected.label}`);
        }
    }), vscode.commands.registerCommand('morse.selectProvider', async () => {
        const providers = await client.getProviders();
        const items = providers.map(p => ({
            label: p.name,
            description: `${p.models.length} models - ${p.enabled ? 'enabled' : 'disabled'}`,
            provider: p.name,
        }));
        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select a provider',
        });
        if (selected) {
            await client.setProvider(selected.provider);
            vscode.window.showInformationMessage(`Provider changed to ${selected.label}`);
        }
    }));
}
//# sourceMappingURL=SettingsPanel.js.map