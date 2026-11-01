"use strict";
/**
 * Morse Provider Service
 *
 * Manages AI provider configuration, validation, and selection
 * for the VS Code extension. Supports 12+ providers from morse-cli.
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
exports.ProviderService = exports.ProviderServiceEvents = void 0;
exports.getProviderService = getProviderService;
const vscode = __importStar(require("vscode"));
const types_1 = require("./types");
/**
 * Provider Service Events
 */
exports.ProviderServiceEvents = {
    providerChanged: 'providerChanged',
    providerValidated: 'providerValidated',
    modelChanged: 'modelChanged',
    costThreshold: 'costThreshold',
};
/**
 * Provider Service for managing AI providers
 */
class ProviderService {
    static instance;
    settings;
    eventEmitter;
    costTracking;
    constructor() {
        this.settings = (0, types_1.loadProviderSettings)();
        this.eventEmitter = new vscode.EventEmitter();
        this.costTracking = {
            totalCost: 0,
            sessionCosts: new Map(),
        };
        // Listen for configuration changes
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('morse')) {
                this.reloadSettings();
            }
        });
    }
    /**
     * Get singleton instance
     */
    static getInstance() {
        if (!ProviderService.instance) {
            ProviderService.instance = new ProviderService();
        }
        return ProviderService.instance;
    }
    /**
     * Reload settings from configuration
     */
    reloadSettings() {
        const newSettings = (0, types_1.loadProviderSettings)();
        // Check if provider changed
        if (this.settings.provider !== newSettings.provider) {
            this.eventEmitter.fire(exports.ProviderServiceEvents.providerChanged);
        }
        // Check if model changed
        if (this.settings.model !== newSettings.model) {
            this.eventEmitter.fire(exports.ProviderServiceEvents.modelChanged);
        }
        this.settings = newSettings;
    }
    /**
     * Get current settings
     */
    getSettings() {
        return this.settings;
    }
    /**
     * Get current provider type
     */
    getCurrentProvider() {
        return this.settings.provider;
    }
    /**
     * Get current model
     */
    getCurrentModel() {
        return this.settings.model;
    }
    /**
     * Get current model info
     */
    getCurrentModelInfo() {
        return (0, types_1.getModelById)(this.settings.model);
    }
    /**
     * Get all available models for current provider
     */
    getAvailableModels() {
        return (0, types_1.getModelsForProvider)(this.settings.provider);
    }
    /**
     * Get all available models across all enabled providers
     */
    getAllAvailableModels() {
        const enabledProviders = (0, types_1.getEnabledProviders)(this.settings);
        const modelIds = new Set();
        const models = [];
        for (const provider of enabledProviders) {
            const providerModels = (0, types_1.getModelsForProvider)(provider.type);
            for (const model of providerModels) {
                if (!modelIds.has(model.id)) {
                    modelIds.add(model.id);
                    models.push(model);
                }
            }
        }
        return models;
    }
    /**
     * Get provider configuration by type
     */
    getProviderConfig(type) {
        return this.settings.providers.find(p => p.type === type);
    }
    /**
     * Get enabled providers
     */
    getEnabledProviders() {
        return (0, types_1.getEnabledProviders)(this.settings);
    }
    /**
     * Get provider info
     */
    getProviderInfo(type) {
        return (0, types_1.getProviderInfo)(type);
    }
    /**
     * Set active provider
     */
    async setProvider(provider) {
        const config = vscode.workspace.getConfiguration('morse');
        await config.update('morse.provider', provider, vscode.ConfigurationTarget.Global);
        // Set default model for provider
        const defaultModel = this.getDefaultModelForProvider(provider);
        if (defaultModel) {
            await config.update('morse.model', defaultModel, vscode.ConfigurationTarget.Global);
        }
        this.reloadSettings();
    }
    /**
     * Set active model
     */
    async setModel(model) {
        const config = vscode.workspace.getConfiguration('morse');
        await config.update('morse.model', model, vscode.ConfigurationTarget.Global);
        this.reloadSettings();
    }
    /**
     * Get default model for a provider
     */
    getDefaultModelForProvider(provider) {
        const models = (0, types_1.getModelsForProvider)(provider);
        if (models.length > 0) {
            // Return the best balanced model
            const balanced = models.find(m => m.tier === 'balanced');
            return balanced?.id || models[0].id;
        }
        return undefined;
    }
    /**
     * Validate a provider configuration
     */
    async validateProvider(provider, apiKey) {
        const config = this.getProviderConfig(provider);
        const key = apiKey || config?.apiKey || this.getApiKeyFromEnv(provider);
        if (!key) {
            return {
                valid: false,
                provider,
                error: 'No API key configured. Set apiKey or apiKeyEnvVar in settings.',
            };
        }
        const result = await (0, types_1.validateProviderKey)(provider, key, {
            endpoint: config?.endpoint,
            region: config?.region,
        });
        this.eventEmitter.fire(exports.ProviderServiceEvents.providerValidated);
        return result;
    }
    /**
     * Get API key from environment variable
     */
    getApiKeyFromEnv(provider) {
        const envVars = {
            'anthropic': process.env.ANTHROPIC_API_KEY,
            'openai': process.env.OPENAI_API_KEY,
            'google': process.env.GEMINI_API_KEY,
            'azure': process.env.AZURE_OPENAI_API_KEY,
            'bedrock': process.env.AWS_ACCESS_KEY_ID,
            'groq': process.env.GROQ_API_KEY,
            'ollama': undefined,
            'mistral': process.env.MISTRAL_API_KEY,
            'together': process.env.TOGETHER_API_KEY,
            'openai-compatible': process.env.OPENAI_API_KEY,
            'xai': process.env.XAI_API_KEY,
            'nvidia': process.env.NVIDIA_API_KEY,
        };
        return envVars[provider];
    }
    /**
     * Get API key for current provider
     */
    getApiKey() {
        const config = this.getProviderConfig(this.settings.provider);
        if (config?.apiKey) {
            return config.apiKey;
        }
        if (config?.apiKeyEnvVar) {
            return process.env[config.apiKeyEnvVar];
        }
        return this.getApiKeyFromEnv(this.settings.provider);
    }
    /**
     * Update provider configuration
     */
    async updateProviderConfig(type, updates) {
        const providers = [...this.settings.providers];
        const index = providers.findIndex(p => p.type === type);
        if (index >= 0) {
            providers[index] = { ...providers[index], ...updates };
        }
        else {
            providers.push({ type, ...updates });
        }
        const config = vscode.workspace.getConfiguration('morse');
        await config.update('morse.providers', providers, vscode.ConfigurationTarget.Global);
        this.reloadSettings();
    }
    /**
     * Enable/disable a provider
     */
    async setProviderEnabled(type, enabled) {
        await this.updateProviderConfig(type, { enabled });
    }
    /**
     * Add cost to tracking
     */
    addCost(cost, sessionId) {
        if (!this.settings.costTracking.enabled) {
            return;
        }
        this.costTracking.totalCost += cost;
        if (sessionId) {
            const sessionCost = this.costTracking.sessionCosts.get(sessionId) || 0;
            this.costTracking.sessionCosts.set(sessionId, sessionCost + cost);
        }
        // Check if threshold exceeded
        const threshold = this.settings.costTracking.budgetLimit *
            (this.settings.costTracking.warnThreshold / 100);
        if (this.costTracking.totalCost >= threshold) {
            this.eventEmitter.fire(exports.ProviderServiceEvents.costThreshold);
        }
    }
    /**
     * Get total cost
     */
    getTotalCost() {
        return this.costTracking.totalCost;
    }
    /**
     * Get session cost
     */
    getSessionCost(sessionId) {
        return this.costTracking.sessionCosts.get(sessionId) || 0;
    }
    /**
     * Reset cost tracking
     */
    resetCostTracking() {
        this.costTracking.totalCost = 0;
        this.costTracking.sessionCosts.clear();
    }
    /**
     * Get remaining budget
     */
    getRemainingBudget() {
        return this.settings.costTracking.budgetLimit - this.costTracking.totalCost;
    }
    /**
     * Check if over budget
     */
    isOverBudget() {
        return this.costTracking.totalCost >= this.settings.costTracking.budgetLimit;
    }
    /**
     * Get provider display name
     */
    getProviderDisplayName(type) {
        const info = (0, types_1.getProviderInfo)(type);
        return info.name;
    }
    /**
     * Get model display name
     */
    getModelDisplayName(modelId) {
        const model = (0, types_1.getModelById)(modelId);
        return model?.name || modelId;
    }
    /**
     * Event: Provider changed
     */
    get onProviderChanged() {
        return this.eventEmitter.event;
    }
    /**
     * Event: Provider validated
     */
    get onProviderValidated() {
        return this.eventEmitter.event;
    }
    /**
     * Event: Model changed
     */
    get onModelChanged() {
        return this.eventEmitter.event;
    }
    /**
     * Event: Cost threshold reached
     */
    get onCostThreshold() {
        return this.eventEmitter.event;
    }
    /**
     * Dispose
     */
    dispose() {
        this.eventEmitter.dispose();
    }
}
exports.ProviderService = ProviderService;
/**
 * Get the provider service instance
 */
function getProviderService() {
    return ProviderService.getInstance();
}
//# sourceMappingURL=service.js.map