"use strict";
/**
 * Morse Provider Types
 *
 * Defines types for multi-provider AI support in the VS Code extension.
 * Supports 12+ providers from morse-cli including:
 * - Anthropic (Claude)
 * - OpenAI
 * - Google Gemini
 * - Azure OpenAI
 * - AWS Bedrock
 * - Groq
 * - Ollama
 * - Mistral
 * - Together AI
 * - OpenAI Compatible
 * - XAI
 * - Nvidia
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
exports.AVAILABLE_MODELS = exports.PROVIDER_DEFAULT_MODELS = void 0;
exports.getModelsForProvider = getModelsForProvider;
exports.getDefaultModel = getDefaultModel;
exports.getModelById = getModelById;
exports.getProviderInfo = getProviderInfo;
exports.validateProviderKey = validateProviderKey;
exports.estimateCost = estimateCost;
exports.loadProviderSettings = loadProviderSettings;
exports.getActiveProvider = getActiveProvider;
exports.getEnabledProviders = getEnabledProviders;
const vscode = __importStar(require("vscode"));
/**
 * Default models for each provider
 * Based on morse-cli internal/providers/* implementations
 */
exports.PROVIDER_DEFAULT_MODELS = {
    'anthropic': [
        'claude-opus-4-5-20250514',
        'claude-sonnet-4-20250514',
        'claude-haiku-3-5-20250514',
        'claude-3-5-sonnet-20241022',
        'claude-3-opus-20240229',
        'claude-3-haiku-20240307'
    ],
    'openai': [
        'gpt-4o',
        'gpt-4o-mini',
        'gpt-4-turbo',
        'gpt-4',
        'o1',
        'o1-mini',
        'o1-preview'
    ],
    'google': [
        'gemini-2.0-flash',
        'gemini-2.0-flash-lite',
        'gemini-1.5-pro',
        'gemini-1.5-flash'
    ],
    'azure': [
        'gpt-4o',
        'gpt-4o-mini',
        'gpt-4-turbo',
        'gpt-35-turbo'
    ],
    'bedrock': [
        'anthropic.claude-3-sonnet-20240229-v1:0',
        'anthropic.claude-3-haiku-20240307-v1:0',
        'anthropic.claude-3-opus-20240229-v1:0',
        'meta.llama3-1-70b-instruct-v1:0',
        'meta.llama3-1-8b-instruct-v1:0',
        'mistral.mixtral-8x7b-instruct-v0:1'
    ],
    'groq': [
        'llama-3.3-70b-versatile',
        'llama-3.1-70b-versatile',
        'llama-3.1-8b-instant',
        'mixtral-8x7b-32768',
        'gemma2-9b-it'
    ],
    'ollama': [
    // Dynamically fetched from Ollama server
    // Common models: llama2, codellama, mistral, etc.
    ],
    'mistral': [
        'mistral-large-latest',
        'mistral-small-latest',
        'codestral-latest',
        'open-mistral-7b'
    ],
    'together': [
        'meta-llama/Llama-3.3-70B-Instruct-Turbo',
        'meta-llama/Llama-3.1-70B-Instruct',
        'meta-llama/Llama-3.1-8B-Instruct',
        'mistralai/Mixtral-8x7B-Instruct-v0.1',
        'codellama/CodeLlama-70b-Instruct'
    ],
    'openai-compatible': [
    // User-defined models
    ],
    'xai': [
        'grok-beta'
    ],
    'nvidia': [
        'nvidia/llama-3.1-nemotron-70b-instruct',
        'nvidia/llama-3.1-nemotron-8b-instruct'
    ]
};
/**
 * All available models with metadata
 * Comprehensive list based on morse-cli provider implementations
 */
exports.AVAILABLE_MODELS = [
    // Anthropic
    { id: 'claude-opus-4-5-20250514', name: 'Claude 4 Opus', provider: 'anthropic', contextWindow: 200000, supportsVision: true, supportsStreaming: true, supportsFunctionCalling: true, tier: 'premium', estimatedCostPer1MInput: 15, estimatedCostPer1MOutput: 75 },
    { id: 'claude-sonnet-4-20250514', name: 'Claude 4 Sonnet', provider: 'anthropic', contextWindow: 200000, supportsVision: true, supportsStreaming: true, supportsFunctionCalling: true, tier: 'balanced', estimatedCostPer1MInput: 3, estimatedCostPer1MOutput: 15 },
    { id: 'claude-haiku-3-5-20250514', name: 'Claude 3.5 Haiku', provider: 'anthropic', contextWindow: 200000, supportsVision: true, supportsStreaming: true, supportsFunctionCalling: true, tier: 'budget', estimatedCostPer1MInput: 0.8, estimatedCostPer1MOutput: 4 },
    // OpenAI
    { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', contextWindow: 128000, supportsVision: true, supportsStreaming: true, supportsFunctionCalling: true, tier: 'balanced', estimatedCostPer1MInput: 2.5, estimatedCostPer1MOutput: 10 },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai', contextWindow: 128000, supportsVision: true, supportsStreaming: true, supportsFunctionCalling: true, tier: 'budget', estimatedCostPer1MInput: 0.15, estimatedCostPer1MOutput: 0.6 },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'openai', contextWindow: 128000, supportsVision: false, supportsStreaming: true, supportsFunctionCalling: true, tier: 'balanced', estimatedCostPer1MInput: 10, estimatedCostPer1MOutput: 30 },
    { id: 'o1', name: 'OpenAI o1', provider: 'openai', contextWindow: 128000, supportsVision: false, supportsStreaming: false, supportsFunctionCalling: false, tier: 'premium', estimatedCostPer1MInput: 15, estimatedCostPer1MOutput: 60 },
    { id: 'o1-mini', name: 'OpenAI o1-mini', provider: 'openai', contextWindow: 128000, supportsVision: false, supportsStreaming: false, supportsFunctionCalling: false, tier: 'balanced', estimatedCostPer1MInput: 3, estimatedCostPer1MOutput: 12 },
    // Google Gemini
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'google', contextWindow: 1000000, supportsVision: true, supportsStreaming: true, supportsFunctionCalling: true, tier: 'balanced', estimatedCostPer1MInput: 0, estimatedCostPer1MOutput: 0 },
    { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite', provider: 'google', contextWindow: 1000000, supportsVision: true, supportsStreaming: true, supportsFunctionCalling: true, tier: 'budget', estimatedCostPer1MInput: 0, estimatedCostPer1MOutput: 0 },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'google', contextWindow: 2000000, supportsVision: true, supportsStreaming: true, supportsFunctionCalling: true, tier: 'premium', estimatedCostPer1MInput: 1.25, estimatedCostPer1MOutput: 5 },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', provider: 'google', contextWindow: 1000000, supportsVision: true, supportsStreaming: true, supportsFunctionCalling: true, tier: 'budget', estimatedCostPer1MInput: 0.075, estimatedCostPer1MOutput: 0.3 },
    // Azure (uses OpenAI models)
    { id: 'gpt-4o', name: 'Azure GPT-4o', provider: 'azure', contextWindow: 128000, supportsVision: true, supportsStreaming: true, supportsFunctionCalling: true, tier: 'balanced' },
    { id: 'gpt-4o-mini', name: 'Azure GPT-4o Mini', provider: 'azure', contextWindow: 128000, supportsVision: true, supportsStreaming: true, supportsFunctionCalling: true, tier: 'budget' },
    // AWS Bedrock
    { id: 'anthropic.claude-3-sonnet-20240229-v1:0', name: 'Claude 3 Sonnet (Bedrock)', provider: 'bedrock', contextWindow: 200000, supportsVision: true, supportsStreaming: true, supportsFunctionCalling: true, tier: 'balanced' },
    { id: 'anthropic.claude-3-haiku-20240307-v1:0', name: 'Claude 3 Haiku (Bedrock)', provider: 'bedrock', contextWindow: 200000, supportsVision: true, supportsStreaming: true, supportsFunctionCalling: true, tier: 'budget' },
    { id: 'meta.llama3-1-70b-instruct-v1:0', name: 'Llama 3.1 70B (Bedrock)', provider: 'bedrock', contextWindow: 128000, supportsVision: false, supportsStreaming: true, supportsFunctionCalling: false, tier: 'balanced' },
    // Groq
    { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', provider: 'groq', contextWindow: 128000, supportsVision: false, supportsStreaming: true, supportsFunctionCalling: true, tier: 'balanced', estimatedCostPer1MInput: 0.59, estimatedCostPer1MOutput: 0.79 },
    { id: 'llama-3.1-70b-versatile', name: 'Llama 3.1 70B', provider: 'groq', contextWindow: 128000, supportsVision: false, supportsStreaming: true, supportsFunctionCalling: true, tier: 'balanced', estimatedCostPer1MInput: 0.65, estimatedCostPer1MOutput: 2.75 },
    { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B', provider: 'groq', contextWindow: 128000, supportsVision: false, supportsStreaming: true, supportsFunctionCalling: true, tier: 'budget', estimatedCostPer1MInput: 0.05, estimatedCostPer1MOutput: 0.08 },
    { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', provider: 'groq', contextWindow: 32000, supportsVision: false, supportsStreaming: true, supportsFunctionCalling: true, tier: 'budget', estimatedCostPer1MInput: 0.24, estimatedCostPer1MOutput: 0.24 },
    // Mistral
    { id: 'mistral-large-latest', name: 'Mistral Large', provider: 'mistral', contextWindow: 128000, supportsVision: false, supportsStreaming: true, supportsFunctionCalling: true, tier: 'premium', estimatedCostPer1MInput: 2, estimatedCostPer1MOutput: 6 },
    { id: 'mistral-small-latest', name: 'Mistral Small', provider: 'mistral', contextWindow: 128000, supportsVision: false, supportsStreaming: true, supportsFunctionCalling: true, tier: 'budget', estimatedCostPer1MInput: 0.2, estimatedCostPer1MOutput: 0.6 },
    { id: 'codestral-latest', name: 'Codestral', provider: 'mistral', contextWindow: 128000, supportsVision: false, supportsStreaming: true, supportsFunctionCalling: true, tier: 'budget', estimatedCostPer1MInput: 0.2, estimatedCostPer1MOutput: 0.6 },
    // Together AI
    { id: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', name: 'Llama 3.3 70B', provider: 'together', contextWindow: 128000, supportsVision: false, supportsStreaming: true, supportsFunctionCalling: true, tier: 'balanced' },
    { id: 'meta-llama/Llama-3.1-70B-Instruct', name: 'Llama 3.1 70B', provider: 'together', contextWindow: 128000, supportsVision: false, supportsStreaming: true, supportsFunctionCalling: true, tier: 'balanced' },
    { id: 'mistralai/Mixtral-8x7B-Instruct-v0.1', name: 'Mixtral 8x7B', provider: 'together', contextWindow: 32000, supportsVision: false, supportsStreaming: true, supportsFunctionCalling: true, tier: 'budget' },
    // XAI
    { id: 'grok-beta', name: 'Grok Beta', provider: 'xai', contextWindow: 131072, supportsVision: false, supportsStreaming: true, supportsFunctionCalling: false, tier: 'balanced' },
    // Nvidia
    { id: 'nvidia/llama-3.1-nemotron-70b-instruct', name: 'Nemotron 70B', provider: 'nvidia', contextWindow: 128000, supportsVision: false, supportsStreaming: true, supportsFunctionCalling: true, tier: 'balanced' },
    { id: 'nvidia/llama-3.1-nemotron-8b-instruct', name: 'Nemotron 8B', provider: 'nvidia', contextWindow: 128000, supportsVision: false, supportsStreaming: true, supportsFunctionCalling: true, tier: 'budget' },
];
/**
 * Get models for a specific provider
 */
function getModelsForProvider(provider) {
    return exports.AVAILABLE_MODELS.filter(m => m.provider === provider);
}
/**
 * Get default model for a provider
 */
function getDefaultModel(provider) {
    const models = exports.PROVIDER_DEFAULT_MODELS[provider];
    return models && models.length > 0 ? models[0] : '';
}
/**
 * Get model info by ID
 */
function getModelById(modelId) {
    return exports.AVAILABLE_MODELS.find(m => m.id === modelId);
}
/**
 * Get provider info by type
 */
function getProviderInfo(type) {
    const info = {
        'anthropic': { name: 'Anthropic Claude', description: 'Claude models by Anthropic', icon: '$(cloud)' },
        'openai': { name: 'OpenAI', description: 'GPT models by OpenAI', icon: '$(lightbulb)' },
        'google': { name: 'Google Gemini', description: 'Gemini models by Google', icon: '$(globe)' },
        'azure': { name: 'Azure OpenAI', description: 'OpenAI via Microsoft Azure', icon: '$(azure)' },
        'bedrock': { name: 'AWS Bedrock', description: 'Models via AWS Bedrock', icon: '$(cloud)' },
        'groq': { name: 'Groq', description: 'Fast inference with Groq', icon: '$(zap)' },
        'ollama': { name: 'Ollama', description: 'Local LLM inference', icon: '$(device-desktop)' },
        'mistral': { name: 'Mistral AI', description: 'Mistral models', icon: '$(wind)' },
        'together': { name: 'Together AI', description: 'Open models via Together', icon: '$(聚集)' },
        'openai-compatible': { name: 'OpenAI Compatible', description: 'Any OpenAI-compatible API', icon: '$(plug)' },
        'xai': { name: 'xAI', description: 'Grok models by xAI', icon: '$(rocket)' },
        'nvidia': { name: 'NVIDIA', description: 'Models via NVIDIA API', icon: '$(gpu)' },
    };
    return info[type];
}
/**
 * Validate API key for a provider
 */
async function validateProviderKey(provider, apiKey, options) {
    const startTime = Date.now();
    try {
        switch (provider) {
            case 'anthropic': {
                const response = await fetch('https://api.anthropic.com/v1/messages', {
                    method: 'POST',
                    headers: {
                        'x-api-key': apiKey,
                        'anthropic-version': '2023-06-01',
                        'content-type': 'application/json',
                    },
                    body: JSON.stringify({
                        model: 'claude-3-haiku-20240307',
                        max_tokens: 1,
                        messages: [{ role: 'user', content: 'Hi' }],
                    }),
                });
                if (!response.ok) {
                    return { valid: false, provider, error: `API error: ${response.status}`, latency: Date.now() - startTime };
                }
                break;
            }
            case 'openai': {
                const response = await fetch('https://api.openai.com/v1/models', {
                    headers: { 'Authorization': `Bearer ${apiKey}` },
                });
                if (!response.ok) {
                    return { valid: false, provider, error: `API error: ${response.status}`, latency: Date.now() - startTime };
                }
                break;
            }
            case 'google': {
                const response = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`, {
                    method: 'GET',
                });
                if (!response.ok) {
                    return { valid: false, provider, error: `API error: ${response.status}`, latency: Date.now() - startTime };
                }
                break;
            }
            case 'groq': {
                const response = await fetch('https://api.groq.com/openai/v1/models', {
                    headers: { 'Authorization': `Bearer ${apiKey}` },
                });
                if (!response.ok) {
                    return { valid: false, provider, error: `API error: ${response.status}`, latency: Date.now() - startTime };
                }
                break;
            }
            case 'mistral': {
                const response = await fetch('https://api.mistral.ai/v1/models', {
                    headers: { 'Authorization': `Bearer ${apiKey}` },
                });
                if (!response.ok) {
                    return { valid: false, provider, error: `API error: ${response.status}`, latency: Date.now() - startTime };
                }
                break;
            }
            case 'ollama': {
                const endpoint = options?.endpoint || 'http://localhost:11434';
                const response = await fetch(`${endpoint}/api/tags`);
                if (!response.ok) {
                    return { valid: false, provider, error: `Ollama not available: ${response.status}`, latency: Date.now() - startTime };
                }
                break;
            }
            case 'together': {
                const response = await fetch('https://api.together.ai/v1/models', {
                    headers: { 'Authorization': `Bearer ${apiKey}` },
                });
                if (!response.ok) {
                    return { valid: false, provider, error: `API error: ${response.status}`, latency: Date.now() - startTime };
                }
                break;
            }
            case 'xai': {
                const response = await fetch('https://api.x.ai/v1/models', {
                    headers: { 'Authorization': `Bearer ${apiKey}` },
                });
                if (!response.ok) {
                    return { valid: false, provider, error: `API error: ${response.status}`, latency: Date.now() - startTime };
                }
                break;
            }
            default:
                return { valid: false, provider, error: 'Validation not implemented for this provider' };
        }
        return { valid: true, provider, latency: Date.now() - startTime };
    }
    catch (error) {
        return {
            valid: false,
            provider,
            error: error instanceof Error ? error.message : 'Unknown error',
            latency: Date.now() - startTime
        };
    }
}
// ==================== Cost Estimation ====================
/**
 * Estimate cost for a request
 */
function estimateCost(provider, modelId, inputTokens, outputTokens) {
    const model = getModelById(modelId);
    if (!model || !model.estimatedCostPer1MInput || !model.estimatedCostPer1MOutput) {
        return 0;
    }
    return (inputTokens / 1_000_000) * model.estimatedCostPer1MInput +
        (outputTokens / 1_000_000) * model.estimatedCostPer1MOutput;
}
// ==================== Configuration Helpers ====================
/**
 * Load provider settings from VS Code configuration
 */
function loadProviderSettings() {
    const config = vscode.workspace.getConfiguration('morse');
    const providers = config.get('providers', []);
    const routing = config.get('routing', {
        strategy: 'failover',
        fallbackEnabled: true,
        maxRetries: 3,
    });
    const costTracking = config.get('costTracking', {
        enabled: true,
        budgetLimit: 100,
        warnThreshold: 80,
    });
    return {
        provider: config.get('provider', 'anthropic'),
        model: config.get('model', 'claude-sonnet-4-20250514'),
        providers,
        routing,
        costTracking,
    };
}
/**
 * Get active provider configuration
 */
function getActiveProvider(settings) {
    const provider = settings.providers.find(p => p.type === settings.provider && p.enabled);
    return provider;
}
/**
 * Get enabled providers sorted by priority
 */
function getEnabledProviders(settings) {
    return settings.providers
        .filter(p => p.enabled)
        .sort((a, b) => a.priority - b.priority);
}
//# sourceMappingURL=types.js.map