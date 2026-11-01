"use strict";
/**
 * Cost Tracker Hook
 *
 * Built-in hook that tracks API costs during execution.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CostTrackerHook = void 0;
exports.createCostTrackerHook = createCostTrackerHook;
/**
 * Cost Tracker Hook
 * Tracks API costs during execution
 */
class CostTrackerHook {
    config;
    costs = [];
    totalCost = 0;
    constructor(config = {}) {
        this.config = {
            warningThreshold: config.warningThreshold ?? 10,
            maxCost: config.maxCost ?? 100,
            currency: config.currency ?? 'USD',
        };
    }
    /**
     * Execute the cost tracker hook
     */
    async execute(context) {
        const data = context.data;
        // Extract cost information from context
        const cost = typeof data.cost === 'number' ? data.cost : 0;
        const inputTokens = typeof data.inputTokens === 'number' ? data.inputTokens : 0;
        const outputTokens = typeof data.outputTokens === 'number' ? data.outputTokens : 0;
        if (cost <= 0 && inputTokens <= 0 && outputTokens <= 0) {
            return {
                success: true,
                continue: true,
                modified: false,
            };
        }
        // Create cost record
        const record = {
            timestamp: Date.now(),
            provider: typeof data.provider === 'string' ? data.provider : 'unknown',
            model: typeof data.model === 'string' ? data.model : undefined,
            inputTokens,
            outputTokens,
            cost,
            currency: this.config.currency || 'USD',
        };
        this.costs.push(record);
        this.totalCost += cost;
        const logs = [];
        // Add cost log
        logs.push({
            timestamp: Date.now(),
            level: 'info',
            message: `API Cost: $${cost.toFixed(4)} (Total: $${this.totalCost.toFixed(4)})`,
            data: record,
        });
        // Check warning threshold
        if (this.totalCost >= (this.config.warningThreshold || 10)) {
            logs.push({
                timestamp: Date.now(),
                level: 'warn',
                message: `Cost warning: Total cost $${this.totalCost.toFixed(4)} exceeds threshold $${this.config.warningThreshold}`,
            });
        }
        // Check max cost
        if (this.totalCost >= (this.config.maxCost || 100)) {
            return {
                success: false,
                continue: false,
                modified: false,
                error: `Maximum cost limit exceeded: $${this.totalCost.toFixed(4)}`,
                logs,
            };
        }
        return {
            success: true,
            continue: true,
            modified: false,
            data: {
                totalCost: this.totalCost,
                sessionCost: this.getSessionCost(),
            },
            logs,
        };
    }
    /**
     * Get all cost records
     */
    getCosts() {
        return [...this.costs];
    }
    /**
     * Get total cost
     */
    getTotalCost() {
        return this.totalCost;
    }
    /**
     * Get session cost (costs from last hour)
     */
    getSessionCost() {
        const oneHourAgo = Date.now() - 3600000;
        return this.costs
            .filter(c => c.timestamp > oneHourAgo)
            .reduce((sum, c) => sum + c.cost, 0);
    }
    /**
     * Clear costs
     */
    clearCosts() {
        this.costs = [];
        this.totalCost = 0;
    }
    /**
     * Update configuration
     */
    updateConfig(config) {
        this.config = { ...this.config, ...config };
    }
}
exports.CostTrackerHook = CostTrackerHook;
/**
 * Create a new cost tracker hook
 */
function createCostTrackerHook(config) {
    return new CostTrackerHook(config);
}
//# sourceMappingURL=costTracker.js.map