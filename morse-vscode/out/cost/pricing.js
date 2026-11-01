"use strict";
/**
 * Cost pricing data for various AI providers and models
 * Based on current pricing from internal/cost/pricing.go
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PRICING_TABLE = void 0;
exports.calculateCost = calculateCost;
exports.formatCostUSD = formatCostUSD;
exports.formatCostINR = formatCostINR;
exports.getProviderPricing = getProviderPricing;
exports.PRICING_TABLE = [
    // Groq models
    { provider: 'groq', model: 'llama-3.1-8b-instant', inputCostPer1M: 0.05, outputCostPer1M: 0.08 },
    { provider: 'groq', model: 'llama-3.3-70b-versatile', inputCostPer1M: 0.59, outputCostPer1M: 0.79 },
    { provider: 'groq', model: 'mixtral-8x7b-32768', inputCostPer1M: 0.24, outputCostPer1M: 0.24 },
    // OpenAI models
    { provider: 'openai', model: 'gpt-4o', inputCostPer1M: 2.50, outputCostPer1M: 10.00 },
    { provider: 'openai', model: 'gpt-4o-mini', inputCostPer1M: 0.15, outputCostPer1M: 0.60 },
    { provider: 'openai', model: 'gpt-4-turbo', inputCostPer1M: 10.00, outputCostPer1M: 30.00 },
    { provider: 'openai', model: 'gpt-4', inputCostPer1M: 30.00, outputCostPer1M: 60.00 },
    // Anthropic models
    { provider: 'anthropic', model: 'claude-haiku-3-5', inputCostPer1M: 0.80, outputCostPer1M: 4.00 },
    { provider: 'anthropic', model: 'claude-sonnet-4', inputCostPer1M: 3.00, outputCostPer1M: 15.00 },
    { provider: 'anthropic', model: 'claude-opus-4-5', inputCostPer1M: 15.00, outputCostPer1M: 75.00 },
    { provider: 'anthropic', model: 'claude-3-opus', inputCostPer1M: 15.00, outputCostPer1M: 75.00 },
    { provider: 'anthropic', model: 'claude-3-sonnet', inputCostPer1M: 3.00, outputCostPer1M: 15.00 },
    { provider: 'anthropic', model: 'claude-3-haiku', inputCostPer1M: 0.25, outputCostPer1M: 1.25 },
    // Google Gemini models
    { provider: 'gemini', model: 'gemini-2.0-flash', inputCostPer1M: 0.10, outputCostPer1M: 0.40 },
    { provider: 'gemini', model: 'gemini-2.0-flash-lite', inputCostPer1M: 0.075, outputCostPer1M: 0.30 },
    { provider: 'gemini', model: 'gemini-1.5-pro', inputCostPer1M: 1.25, outputCostPer1M: 5.00 },
    { provider: 'gemini', model: 'gemini-1.5-flash', inputCostPer1M: 0.075, outputCostPer1M: 0.30 },
    // Together AI models
    { provider: 'together', model: 'meta-llama/Llama-3-70b', inputCostPer1M: 0.90, outputCostPer1M: 0.90 },
    { provider: 'together', model: 'meta-llama/Llama-3.1-70b', inputCostPer1M: 0.90, outputCostPer1M: 0.90 },
    // Mistral models
    { provider: 'mistral', model: 'mistral-large-latest', inputCostPer1M: 2.00, outputCostPer1M: 6.00 },
    { provider: 'mistral', model: 'codestral-latest', inputCostPer1M: 0.30, outputCostPer1M: 0.90 },
    // Cohere models
    { provider: 'cohere', model: 'command-r-plus', inputCostPer1M: 3.00, outputCostPer1M: 15.00 },
    { provider: 'cohere', model: 'command-r', inputCostPer1M: 0.50, outputCostPer1M: 1.50 },
    // Azure OpenAI (uses OpenAI pricing)
    { provider: 'azure', model: 'gpt-4o', inputCostPer1M: 2.50, outputCostPer1M: 10.00 },
    { provider: 'azure', model: 'gpt-4', inputCostPer1M: 30.00, outputCostPer1M: 60.00 },
    // Ollama (typically free/local, but include for completeness)
    { provider: 'ollama', model: 'llama2', inputCostPer1M: 0, outputCostPer1M: 0 },
    { provider: 'ollama', model: 'codellama', inputCostPer1M: 0, outputCostPer1M: 0 },
];
/**
 * Calculate the cost for a given model and token count
 */
function calculateCost(provider, model, inputTokens, outputTokens) {
    // Find matching pricing
    const pricing = exports.PRICING_TABLE.find(p => p.provider.toLowerCase() === provider.toLowerCase() &&
        p.model.toLowerCase() === model.toLowerCase());
    if (!pricing) {
        // Default to a conservative estimate if model not found
        console.warn(`[Cost] Unknown pricing for ${provider}/${model}, using default estimate`);
        return estimateCost(inputTokens + outputTokens);
    }
    const inputCost = (inputTokens / 1_000_000) * pricing.inputCostPer1M;
    const outputCost = (outputTokens / 1_000_000) * pricing.outputCostPer1M;
    return inputCost + outputCost;
}
/**
 * Estimate cost based on average token pricing
 * Default: $1 per 100K tokens (conservative estimate)
 */
function estimateCost(totalTokens) {
    return (totalTokens / 100_000) * 1.0;
}
/**
 * Format cost in USD
 */
function formatCostUSD(usd) {
    return `$${usd.toFixed(4)}`;
}
/**
 * Format cost in INR (assuming 84 INR per USD)
 */
function formatCostINR(usd) {
    const inr = usd * 84;
    return `₹${inr.toFixed(2)}`;
}
/**
 * Get pricing for a specific provider
 */
function getProviderPricing(provider) {
    return exports.PRICING_TABLE.filter(p => p.provider.toLowerCase() === provider.toLowerCase());
}
//# sourceMappingURL=pricing.js.map