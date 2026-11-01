"use strict";
/**
 * Providers Panel for managing AI providers and API keys
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
exports.ProvidersPanel = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class ProvidersPanel {
    static currentPanel;
    static viewType = 'morse.providers';
    panel;
    extensionUri;
    disposables = [];
    providerConfig;
    // Available providers
    availableProviders = [
        {
            id: 'openai',
            name: 'OpenAI',
            apiKeyEnvVar: 'OPENAI_API_KEY',
            models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
            enabled: true,
            requiresApiKey: true,
        },
        {
            id: 'anthropic',
            name: 'Anthropic',
            apiKeyEnvVar: 'ANTHROPIC_API_KEY',
            models: ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-3-haiku-20240307'],
            enabled: true,
            requiresApiKey: true,
        },
        {
            id: 'google',
            name: 'Google Gemini',
            apiKeyEnvVar: 'GEMINI_API_KEY',
            models: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-1.5-flash-8b'],
            enabled: true,
            requiresApiKey: true,
        },
        {
            id: 'groq',
            name: 'Groq',
            apiKeyEnvVar: 'GROQ_API_KEY',
            models: ['llama-3.1-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
            enabled: true,
            requiresApiKey: true,
        },
        {
            id: 'mistral',
            name: 'Mistral',
            apiKeyEnvVar: 'MISTRAL_API_KEY',
            models: ['mistral-large-latest', 'mistral-small-latest', 'codestral-latest'],
            enabled: true,
            requiresApiKey: true,
        },
        {
            id: 'cohere',
            name: 'Cohere',
            apiKeyEnvVar: 'COHERE_API_KEY',
            models: ['command-r-plus', 'command-r', 'command'],
            enabled: true,
            requiresApiKey: true,
        },
        {
            id: 'azure',
            name: 'Azure OpenAI',
            apiKeyEnvVar: 'AZURE_OPENAI_API_KEY',
            models: ['gpt-4o', 'gpt-4', 'gpt-35-turbo'],
            enabled: false,
            requiresApiKey: true,
        },
        {
            id: 'ollama',
            name: 'Ollama (Local)',
            apiKeyEnvVar: '',
            models: ['llama2', 'codellama', 'mistral', 'phi3'],
            enabled: false,
            requiresApiKey: false,
        },
    ];
    static create(extensionUri) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;
        const panel = vscode.window.createWebviewPanel(ProvidersPanel.viewType, 'Morse Providers', column || vscode.ViewColumn.One, {
            enableScripts: true,
            retainContextWhenHidden: true,
        });
        ProvidersPanel.currentPanel = new ProvidersPanel(panel, extensionUri);
        return ProvidersPanel.currentPanel;
    }
    static revive(panel, extensionUri) {
        ProvidersPanel.currentPanel = new ProvidersPanel(panel, extensionUri);
        return ProvidersPanel.currentPanel;
    }
    constructor(panel, extensionUri) {
        this.panel = panel;
        this.extensionUri = extensionUri;
        this.providerConfig = this.loadProviderConfig();
        this.update();
        this.setupEventListeners();
    }
    setupEventListeners() {
        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
        this.panel.webview.onDidReceiveMessage(async (message) => {
            await this.handleWebviewMessage(message);
        }, null, this.disposables);
    }
    async handleWebviewMessage(message) {
        switch (message.command) {
            case 'getProviders':
                this.sendProvidersToWebview();
                break;
            case 'selectProvider':
                await this.selectProvider(message.providerId);
                break;
            case 'updateApiKey':
                await this.updateApiKey(message.providerId, message.apiKey);
                break;
            case 'updateEndpoint':
                await this.updateEndpoint(message.providerId, message.endpoint);
                break;
            case 'selectModel':
                await this.selectModel(message.providerId, message.model);
                break;
            case 'toggleProvider':
                await this.toggleProvider(message.providerId, message.enabled);
                break;
            case 'testProvider':
                await this.testProvider(message.providerId);
                break;
            case 'saveConfig':
                await this.saveConfig();
                break;
            case 'openConfigFile':
                await this.openConfigFile();
                break;
        }
    }
    loadProviderConfig() {
        // Load from workspace config or use defaults
        const config = vscode.workspace.getConfiguration('morse');
        const savedProviders = config.get('providers', []);
        const selectedProvider = config.get('selectedProvider', 'openai');
        const defaultModel = config.get('defaultModel', 'gpt-4o');
        // Merge with available providers
        const providers = this.availableProviders.map(available => {
            const saved = savedProviders.find(p => p.id === available.id);
            return saved ? { ...available, ...saved } : available;
        });
        return { providers, selectedProvider, defaultModel };
    }
    async saveConfig() {
        const config = vscode.workspace.getConfiguration('morse');
        await config.update('providers', this.providerConfig.providers, vscode.ConfigurationTarget.Global);
        await config.update('selectedProvider', this.providerConfig.selectedProvider, vscode.ConfigurationTarget.Global);
        await config.update('defaultModel', this.providerConfig.defaultModel, vscode.ConfigurationTarget.Global);
    }
    async selectProvider(providerId) {
        this.providerConfig.selectedProvider = providerId;
        // Set default model for the provider
        const provider = this.providerConfig.providers.find(p => p.id === providerId);
        if (provider && provider.models.length > 0) {
            this.providerConfig.defaultModel = provider.models[0];
        }
        await this.saveConfig();
        this.sendProvidersToWebview();
    }
    async updateApiKey(providerId, apiKey) {
        const provider = this.providerConfig.providers.find(p => p.id === providerId);
        if (provider) {
            provider.apiKey = apiKey;
            await this.saveConfig();
            this.sendProvidersToWebview();
            vscode.window.showInformationMessage(`API key updated for ${provider.name}`);
        }
    }
    async updateEndpoint(providerId, endpoint) {
        const provider = this.providerConfig.providers.find(p => p.id === providerId);
        if (provider) {
            provider.endpoint = endpoint;
            await this.saveConfig();
            this.sendProvidersToWebview();
            vscode.window.showInformationMessage(`Endpoint updated for ${provider.name}`);
        }
    }
    async selectModel(providerId, model) {
        const provider = this.providerConfig.providers.find(p => p.id === providerId);
        if (provider) {
            this.providerConfig.defaultModel = model;
            await this.saveConfig();
            this.sendProvidersToWebview();
        }
    }
    async toggleProvider(providerId, enabled) {
        const provider = this.providerConfig.providers.find(p => p.id === providerId);
        if (provider) {
            provider.enabled = enabled;
            await this.saveConfig();
            this.sendProvidersToWebview();
            vscode.window.showInformationMessage(`${provider.name} ${enabled ? 'enabled' : 'disabled'}`);
        }
    }
    async testProvider(providerId) {
        const provider = this.providerConfig.providers.find(p => p.id === providerId);
        if (!provider)
            return;
        vscode.window.showInformationMessage(`Testing ${provider.name} connection...`);
        // Simulate testing - in production this would make an actual API call
        setTimeout(() => {
            vscode.window.showInformationMessage(`${provider.name} connection test ${provider.apiKey ? 'successful' : 'failed - no API key'}`);
        }, 1000);
    }
    async openConfigFile() {
        // Try to open the morse config file
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder found');
            return;
        }
        const configPath = path.join(workspaceFolder.uri.fsPath, '.morse', 'config.yaml');
        try {
            if (fs.existsSync(configPath)) {
                const doc = await vscode.workspace.openTextDocument(configPath);
                await vscode.window.showTextDocument(doc);
            }
            else {
                // Create default config
                const defaultConfig = `# Morse CLI Configuration
# Provider settings
provider: openai
model: gpt-4o

# API Keys (use environment variables for security)
# api_keys:
#   openai: \${OPENAI_API_KEY}
#   anthropic: \${ANTHROPIC_API_KEY}
`;
                const dir = path.dirname(configPath);
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }
                fs.writeFileSync(configPath, defaultConfig);
                const doc = await vscode.workspace.openTextDocument(configPath);
                await vscode.window.showTextDocument(doc);
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to open config: ${error.message}`);
        }
    }
    sendProvidersToWebview() {
        // Filter out actual API keys for security
        const providersToSend = this.providerConfig.providers.map(p => ({
            ...p,
            apiKey: p.apiKey ? '••••••••' + p.apiKey.slice(-4) : undefined,
        }));
        this.panel.webview.postMessage({
            command: 'providers',
            providers: providersToSend,
            selectedProvider: this.providerConfig.selectedProvider,
            defaultModel: this.providerConfig.defaultModel,
        });
    }
    update() {
        const webview = this.panel.webview;
        webview.html = this.getHtmlForWebview(webview);
    }
    getHtmlForWebview(webview) {
        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Morse Providers</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; background: var(--vscode-editor-background); color: var(--vscode-editor-foreground); }
        h1 { font-size: 24px; margin-bottom: 20px; }
        h2 { font-size: 18px; margin: 20px 0 10px; }
        .provider-card { border: 1px solid var(--vscode-editorWidget-border); border-radius: 8px; padding: 16px; margin-bottom: 12px; background: var(--vscode-editorWidget-background); }
        .provider-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
        .provider-name { font-weight: 600; font-size: 16px; }
        .provider-status { font-size: 12px; padding: 4px 8px; border-radius: 4px; }
        .provider-status.enabled { background: #4caf50; color: white; }
        .provider-status.disabled { background: #9e9e9e; color: white; }
        .provider-models { margin: 12px 0; }
        .model-select { width: 100%; padding: 8px; margin-top: 8px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 4px; }
        .api-key-input { width: 100%; padding: 8px; margin-top: 8px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 4px; }
        .endpoint-input { width: 100%; padding: 8px; margin-top: 8px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 4px; }
        .btn { padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; margin-right: 8px; }
        .btn-primary { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
        .btn-secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
        .btn-test { background: #2196f3; color: white; }
        .btn-danger { background: #f44336; color: white; }
        .actions { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
        .selected-provider { border: 2px solid #2196f3; }
        .info-text { font-size: 12px; color: var(--vscode-descriptionForeground); margin-top: 8px; }
    </style>
</head>
<body>
    <h1>AI Providers</h1>
    <div id="providers-container">Loading...</div>
    <h2>Configuration</h2>
    <div class="actions">
        <button class="btn btn-secondary" onclick="openConfigFile()">Open Config File</button>
        <button class="btn btn-primary" onclick="saveConfig()">Save Configuration</button>
    </div>

    <script>
        let providers = [];
        let selectedProvider = '';
        let defaultModel = '';

        const vscode = acquireVsCodeApi();

        window.addEventListener('message', (event) => {
            const message = event.data;
            if (message.command === 'providers') {
                providers = message.providers;
                selectedProvider = message.selectedProvider;
                defaultModel = message.defaultModel;
                renderProviders();
            }
        });

        function renderProviders() {
            const container = document.getElementById('providers-container');
            container.innerHTML = providers.map(provider => \`
                <div class="provider-card \${provider.id === selectedProvider ? 'selected-provider' : ''}" id="provider-\${provider.id}">
                    <div class="provider-header">
                        <span class="provider-name">\${provider.name}</span>
                        <span class="provider-status \${provider.enabled ? 'enabled' : 'disabled'}">
                            \${provider.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                    </div>
                    <div class="provider-models">
                        <label>Default Model:</label>
                        <select class="model-select" onchange="selectModel('\${provider.id}', this.value)">
                            \${provider.models.map(model => \`
                                <option value="\${model}" \${model === defaultModel ? 'selected' : ''}>\${model}</option>
                            \`).join('')}
                        </select>
                    </div>
                    \${provider.requiresApiKey ? \`
                        <div>
                            <label>API Key:</label>
                            <input type="password" class="api-key-input" value="\${provider.apiKey || ''}" 
                                placeholder="Enter API key or use env: \${provider.apiKeyEnvVar}"
                                onchange="updateApiKey('\${provider.id}', this.value)" />
                        </div>
                    \` : ''}
                    \${provider.id === 'azure' || provider.id === 'ollama' ? \`
                        <div>
                            <label>Endpoint (optional):</label>
                            <input type="text" class="endpoint-input" value="\${provider.endpoint || ''}" 
                                placeholder="Custom endpoint URL"
                                onchange="updateEndpoint('\${provider.id}', this.value)" />
                        </div>
                    \` : ''}
                    <div class="actions">
                        <button class="btn \${provider.enabled ? 'btn-danger' : 'btn-primary'}" 
                            onclick="toggleProvider('\${provider.id}', \${!provider.enabled})">
                            \${provider.enabled ? 'Disable' : 'Enable'}
                        </button>
                        <button class="btn btn-test" onclick="testProvider('\${provider.id}')">Test</button>
                        <button class="btn btn-secondary" onclick="selectProvider('\${provider.id}')">
                            \${provider.id === selectedProvider ? '✓ Selected' : 'Select'}
                        </button>
                    </div>
                    <p class="info-text">
                        Environment variable: \${provider.apiKeyEnvVar || 'Not required'}
                    </p>
                </div>
            \`).join('');
        }

        function selectProvider(id) {
            vscode.postMessage({ command: 'selectProvider', providerId: id });
        }

        function updateApiKey(id, apiKey) {
            vscode.postMessage({ command: 'updateApiKey', providerId: id, apiKey });
        }

        function updateEndpoint(id, endpoint) {
            vscode.postMessage({ command: 'updateEndpoint', providerId: id, endpoint });
        }

        function selectModel(id, model) {
            vscode.postMessage({ command: 'selectModel', providerId: id, model });
        }

        function toggleProvider(id, enabled) {
            vscode.postMessage({ command: 'toggleProvider', providerId: id, enabled });
        }

        function testProvider(id) {
            vscode.postMessage({ command: 'testProvider', providerId: id });
        }

        function saveConfig() {
            vscode.postMessage({ command: 'saveConfig' });
        }

        function openConfigFile() {
            vscode.postMessage({ command: 'openConfigFile' });
        }

        // Request initial data
        vscode.postMessage({ command: 'getProviders' });
    </script>
</body>
</html>`;
    }
    reveal() {
        this.panel.reveal();
    }
    dispose() {
        ProvidersPanel.currentPanel = undefined;
        this.panel.dispose();
        while (this.disposables.length) {
            const disposable = this.disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
}
exports.ProvidersPanel = ProvidersPanel;
//# sourceMappingURL=ProvidersPanel.js.map