"use strict";
/**
 * Morse Provider Commands
 *
 * VS Code commands for managing AI providers.
 * Supports 12+ providers from morse-cli.
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
exports.registerProviderCommands = registerProviderCommands;
const vscode = __importStar(require("vscode"));
const service_1 = require("./service");
const types_1 = require("./types");
function registerProviderCommands(context) {
    const providerService = (0, service_1.getProviderService)();
    // Command: Select Provider
    context.subscriptions.push(vscode.commands.registerCommand('morse.selectProvider', async () => {
        const items = [];
        const providers = [
            'anthropic', 'openai', 'google', 'azure', 'bedrock',
            'groq', 'ollama', 'mistral', 'together', 'openai-compatible', 'xai', 'nvidia'
        ];
        for (const provider of providers) {
            const info = (0, types_1.getProviderInfo)(provider);
            const config = providerService.getProviderConfig(provider);
            const isActive = providerService.getCurrentProvider() === provider;
            items.push({
                label: `${isActive ? '$(check) ' : ''}${info.name}`,
                description: info.description,
                detail: config?.enabled ? `Enabled • Priority: ${config.priority}` : 'Disabled',
            });
        }
        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select an AI provider',
            matchOnDescription: true,
        });
        if (selected) {
            // Extract provider from label
            const providerLabel = selected.label.replace('$(check) ', '');
            const selectedProvider = providers.find(p => (0, types_1.getProviderInfo)(p).name === providerLabel);
            if (selectedProvider) {
                await providerService.setProvider(selectedProvider);
                vscode.window.showInformationMessage(`Provider changed to ${(0, types_1.getProviderInfo)(selectedProvider).name}`);
            }
        }
    }));
    // Command: Validate Provider
    context.subscriptions.push(vscode.commands.registerCommand('morse.validateProvider', async () => {
        const currentProvider = providerService.getCurrentProvider();
        const info = (0, types_1.getProviderInfo)(currentProvider);
        const result = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Validating ${info.name}`,
            cancellable: false,
        }, async () => {
            return await providerService.validateProvider(currentProvider);
        });
        if (result.valid) {
            vscode.window.showInformationMessage(`${info.name} is valid! (Latency: ${result.latency}ms)`, 'OK');
        }
        else {
            vscode.window.showErrorMessage(`Provider validation failed: ${result.error}`, 'OK');
        }
    }));
    // Command: Show Available Providers
    context.subscriptions.push(vscode.commands.registerCommand('morse.showProviders', async () => {
        const panel = vscode.window.createWebviewPanel('morseProviders', 'Morse AI Providers', vscode.ViewColumn.One, { enableScripts: true });
        const enabledProviders = providerService.getEnabledProviders();
        const currentProvider = providerService.getCurrentProvider();
        const currentModel = providerService.getCurrentModel();
        let html = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; }
            h1 { color: #333; }
            .provider { border: 1px solid #ddd; border-radius: 8px; padding: 16px; margin: 8px 0; }
            .provider.active { border-color: #007acc; background: #f0f7ff; }
            .provider h3 { margin: 0 0 8px 0; }
            .provider p { margin: 4px 0; color: #666; }
            .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; }
            .badge.enabled { background: #d4edda; color: #155724; }
            .badge.current { background: #007acc; color: white; }
          </style>
        </head>
        <body>
          <h1>Morse AI Providers</h1>
          <p>Current: <strong>${(0, types_1.getProviderInfo)(currentProvider).name}</strong> • Model: ${currentModel}</p>
      `;
        for (const provider of enabledProviders) {
            const info = (0, types_1.getProviderInfo)(provider.type);
            const isActive = provider.type === currentProvider;
            const models = (0, types_1.getModelsForProvider)(provider.type);
            html += `
          <div class="provider ${isActive ? 'active' : ''}">
            <h3>${info.icon} ${info.name}</h3>
            <p>${info.description}</p>
            <p><strong>Models:</strong> ${models.slice(0, 3).map(m => m.name).join(', ')}${models.length > 3 ? '...' : ''}</p>
            <span class="badge enabled">Enabled</span>
            ${isActive ? '<span class="badge current">Current</span>' : ''}
          </div>
        `;
        }
        html += `
        <h2>Configuration</h2>
        <p>Configure providers in VS Code Settings (Ctrl+,):</p>
        <ul>
          <li><code>morse.provider</code> - Select active provider</li>
          <li><code>morse.model</code> - Select model</li>
          <li><code>morse.providers</code> - Configure all providers</li>
          <li><code>morse.routing</code> - Set routing strategy</li>
        </ul>
        </body>
        </html>
      `;
        panel.webview.html = html;
    }));
    // Command: Configure Provider
    context.subscriptions.push(vscode.commands.registerCommand('morse.configureProvider', async () => {
        // Open VS Code settings
        await vscode.commands.executeCommand('workbench.action.openSettings', 'morse.provider');
    }));
    // Status bar item for current provider
    const statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    const updateStatusBar = () => {
        const provider = providerService.getCurrentProvider();
        const info = (0, types_1.getProviderInfo)(provider);
        statusItem.text = `${info.icon} ${info.name}`;
        statusItem.tooltip = `Current Provider: ${info.name}\nClick to change`;
        statusItem.command = 'morse.selectProvider';
    };
    updateStatusBar();
    context.subscriptions.push(statusItem);
    context.subscriptions.push(providerService.onProviderChanged(() => updateStatusBar()));
    statusItem.show();
}
//# sourceMappingURL=commands.js.map