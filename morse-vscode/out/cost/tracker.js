"use strict";
/**
 * Cost tracker for VS Code extension
 * Uses VS Code workspace state for local storage
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
exports.CostTracker = void 0;
exports.getCostTracker = getCostTracker;
exports.initializeCostTracker = initializeCostTracker;
exports.resetCostTracker = resetCostTracker;
const vscode = __importStar(require("vscode"));
const pricing_1 = require("./pricing");
const COST_STORAGE_KEY = 'morse.cost.records';
const COST_BUDGET_KEY = 'morse.cost.budget';
const SESSION_START_KEY = 'morse.cost.sessionStart';
class CostTracker {
    context;
    records = [];
    sessionStartCost = 0;
    sessionStartTokens = 0;
    constructor(context) {
        this.context = context;
        this.loadRecords();
        this.initSession();
    }
    /**
     * Initialize session tracking
     */
    initSession() {
        const sessionStart = this.context.workspaceState.get(SESSION_START_KEY);
        const now = Date.now();
        // If no session start or it's been more than 24 hours, reset session
        if (!sessionStart || now - sessionStart > 24 * 60 * 60 * 1000) {
            this.sessionStartCost = 0;
            this.sessionStartTokens = 0;
            this.context.workspaceState.update(SESSION_START_KEY, now);
        }
        else {
            // Calculate session cost from today's records
            const today = this.getTodayDate();
            const todayRecords = this.records.filter(r => r.timestamp.startsWith(today));
            this.sessionStartCost = todayRecords.reduce((sum, r) => sum + r.costUSD, 0);
            this.sessionStartTokens = todayRecords.reduce((sum, r) => sum + r.inputTokens + r.outputTokens, 0);
        }
    }
    /**
     * Load records from workspace state
     */
    loadRecords() {
        const stored = this.context.workspaceState.get(COST_STORAGE_KEY);
        if (stored && Array.isArray(stored)) {
            this.records = stored;
        }
    }
    /**
     * Save records to workspace state
     */
    saveRecords() {
        // Keep only last 90 days of records
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 90);
        const cutoffStr = cutoff.toISOString().split('T')[0];
        this.records = this.records.filter(r => r.timestamp >= cutoffStr);
        this.context.workspaceState.update(COST_STORAGE_KEY, this.records);
    }
    /**
     * Get today's date string
     */
    getTodayDate() {
        return new Date().toISOString().split('T')[0];
    }
    /**
     * Log a usage record
     */
    log(record) {
        const costUSD = (0, pricing_1.calculateCost)(record.provider, record.model, record.inputTokens, record.outputTokens);
        const newRecord = {
            ...record,
            timestamp: new Date().toISOString(),
            costUSD,
        };
        this.records.push(newRecord);
        this.saveRecords();
        // Emit event for UI updates
        this.emitCostUpdate();
    }
    /**
     * Get all records for today
     */
    getToday() {
        const today = this.getTodayDate();
        return this.records.filter(r => r.timestamp.startsWith(today));
    }
    /**
     * Get today's total cost
     */
    getTodayTotal() {
        return this.getToday().reduce((sum, r) => sum + r.costUSD, 0);
    }
    /**
     * Get today's total tokens
     */
    getTodayTokens() {
        return this.getToday().reduce((sum, r) => sum + r.inputTokens + r.outputTokens, 0);
    }
    /**
     * Get session cost (since session start)
     */
    getSessionCost() {
        const today = this.getTodayDate();
        const todayTotal = this.getToday().reduce((sum, r) => sum + r.costUSD, 0);
        return todayTotal - this.sessionStartCost;
    }
    /**
     * Get session tokens
     */
    getSessionTokens() {
        const today = this.getTodayDate();
        const todayTokens = this.getToday().reduce((sum, r) => sum + r.inputTokens + r.outputTokens, 0);
        return todayTokens - this.sessionStartTokens;
    }
    /**
     * Get usage summary for a given number of days
     */
    getSummary(days) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        const cutoffStr = cutoff.toISOString().split('T')[0];
        const filtered = this.records.filter(r => r.timestamp >= cutoffStr);
        // Group by model
        const byModel = {};
        filtered.forEach(r => {
            const key = r.model || `${r.provider}/unknown`;
            byModel[key] = (byModel[key] || 0) + r.costUSD;
        });
        // Group by day
        const dailyMap = {};
        filtered.forEach(r => {
            const date = r.timestamp.split('T')[0];
            if (!dailyMap[date]) {
                dailyMap[date] = { date, costUSD: 0, tokenCount: 0 };
            }
            dailyMap[date].costUSD += r.costUSD;
            dailyMap[date].tokenCount += r.inputTokens + r.outputTokens;
        });
        const dailyBreakdown = Object.values(dailyMap).sort((a, b) => b.date.localeCompare(a.date));
        return {
            byModel,
            dailyBreakdown,
            totalCostUSD: filtered.reduce((sum, r) => sum + r.costUSD, 0),
            totalTokens: filtered.reduce((sum, r) => sum + r.inputTokens + r.outputTokens, 0),
        };
    }
    /**
     * Get detailed cost breakdown
     */
    getCostBreakdown() {
        const today = this.getToday();
        const byProvider = {};
        const byModel = {};
        today.forEach(r => {
            byProvider[r.provider] = (byProvider[r.provider] || 0) + r.costUSD;
            byModel[r.model] = (byModel[r.model] || 0) + r.costUSD;
        });
        // Get daily breakdown for last 7 days
        const summary = this.getSummary(7);
        return {
            byProvider,
            byModel,
            daily: summary.dailyBreakdown,
            totalCost: summary.totalCostUSD,
            totalTokens: summary.totalTokens,
        };
    }
    /**
     * Get cost history
     */
    getHistory(days = 30) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        const cutoffStr = cutoff.toISOString().split('T')[0];
        return this.records
            .filter(r => r.timestamp >= cutoffStr)
            .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    }
    /**
     * Reset cost tracking
     */
    reset() {
        this.records = [];
        this.sessionStartCost = 0;
        this.sessionStartTokens = 0;
        this.context.workspaceState.update(COST_STORAGE_KEY, []);
        this.context.workspaceState.update(SESSION_START_KEY, Date.now());
        this.emitCostUpdate();
    }
    /**
     * Get daily budget
     */
    getDailyBudget() {
        return this.context.workspaceState.get(COST_BUDGET_KEY) || 0;
    }
    /**
     * Set daily budget
     */
    setDailyBudget(budget) {
        this.context.workspaceState.update(COST_BUDGET_KEY, budget);
    }
    /**
     * Get budget ratio (today's cost / daily budget)
     */
    getBudgetRatio() {
        const budget = this.getDailyBudget();
        if (budget <= 0)
            return 0;
        return this.getTodayTotal() / budget;
    }
    /**
     * Export cost data as JSON
     */
    exportData() {
        return JSON.stringify({
            records: this.records,
            exportedAt: new Date().toISOString(),
            summary: this.getSummary(30),
        }, null, 2);
    }
    /**
     * Project monthly cost based on current usage
     */
    getProjectedMonthlyCost() {
        const today = new Date();
        const dayOfMonth = today.getDate();
        const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
        const todayCost = this.getTodayTotal();
        const avgDailyCost = todayCost / Math.max(1, dayOfMonth);
        return avgDailyCost * daysInMonth;
    }
    /**
     * Emit cost update event
     */
    emitCostUpdate() {
        const event = new vscode.EventEmitter();
        try {
            event.fire(this.getCostBreakdown());
        }
        catch (error) {
            console.error('[Cost] Error emitting cost update:', error);
        }
    }
    /**
     * Get cost update event
     */
    get onDidChangeCost() {
        const emitter = new vscode.EventEmitter();
        // Set up listener for storage changes
        const listener = vscode.workspace.onDidChangeConfiguration(() => {
            // Reload and emit
            this.loadRecords();
            emitter.fire(this.getCostBreakdown());
        });
        // Return event that cleans up listener
        return emitter.event;
    }
}
exports.CostTracker = CostTracker;
// Singleton instance
let trackerInstance = null;
/**
 * Get the cost tracker instance
 */
function getCostTracker(context) {
    if (!trackerInstance && context) {
        trackerInstance = new CostTracker(context);
    }
    return trackerInstance;
}
/**
 * Initialize the cost tracker
 */
function initializeCostTracker(context) {
    trackerInstance = new CostTracker(context);
    return trackerInstance;
}
/**
 * Reset the cost tracker (for testing)
 */
function resetCostTracker() {
    trackerInstance = null;
}
//# sourceMappingURL=tracker.js.map