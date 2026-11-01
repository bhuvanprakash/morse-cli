"use strict";
/**
 * Approval History
 *
 * Manages the history of approval decisions for audit and compliance.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApprovalHistory = void 0;
exports.createApprovalHistory = createApprovalHistory;
/**
 * Approval History Manager
 * Stores and retrieves approval history entries
 */
class ApprovalHistory {
    entries = [];
    maxEntries = 1000;
    context = null;
    constructor(context) {
        this.context = context || null;
    }
    /**
     * Set the maximum number of entries to store
     */
    setMaxEntries(max) {
        this.maxEntries = max;
    }
    /**
     * Add an entry to history
     */
    async addEntry(entry) {
        this.entries.unshift(entry);
        // Trim to max entries
        if (this.entries.length > this.maxEntries) {
            this.entries = this.entries.slice(0, this.maxEntries);
        }
        // Save to persistent storage
        await this.save();
    }
    /**
     * Get all history entries
     */
    async getEntries(sessionId) {
        await this.load();
        if (sessionId) {
            return this.entries.filter(e => e.sessionId === sessionId);
        }
        return [...this.entries];
    }
    /**
     * Get entries by status
     */
    async getEntriesByStatus(status) {
        await this.load();
        return this.entries.filter(e => e.status === status);
    }
    /**
     * Get entries within a time range
     */
    async getEntriesInRange(start, end) {
        await this.load();
        return this.entries.filter(e => e.timestamp >= start && e.timestamp <= end);
    }
    /**
     * Get recent entries
     */
    async getRecentEntries(count = 10) {
        await this.load();
        return this.entries.slice(0, count);
    }
    /**
     * Get entries for a specific tool
     */
    async getEntriesForTool(toolName) {
        await this.load();
        return this.entries.filter(e => e.action.toolName === toolName);
    }
    /**
     * Clear history
     */
    async clear() {
        this.entries = [];
        await this.save();
    }
    /**
     * Clear history for a specific session
     */
    async clearSession(sessionId) {
        this.entries = this.entries.filter(e => e.sessionId !== sessionId);
        await this.save();
    }
    /**
     * Get statistics
     */
    async getStatistics() {
        await this.load();
        return {
            total: this.entries.length,
            approved: this.entries.filter(e => e.status === 'approved').length,
            denied: this.entries.filter(e => e.status === 'denied').length,
            autoApproved: this.entries.filter(e => e.status === 'auto_approved').length,
            autoDenied: this.entries.filter(e => e.status === 'auto_denied').length,
            pending: this.entries.filter(e => e.status === 'pending').length,
        };
    }
    /**
     * Export history to JSON
     */
    async exportToJson() {
        await this.load();
        return JSON.stringify(this.entries, null, 2);
    }
    /**
     * Import history from JSON
     */
    async importFromJson(json) {
        try {
            const imported = JSON.parse(json);
            this.entries = [...imported, ...this.entries];
            // Trim to max entries
            if (this.entries.length > this.maxEntries) {
                this.entries = this.entries.slice(0, this.maxEntries);
            }
            await this.save();
        }
        catch (error) {
            throw new Error(`Failed to import history: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Save history to persistent storage
     */
    async save() {
        if (!this.context)
            return;
        try {
            await this.context.globalState.update('morse.approvalHistory', this.entries);
        }
        catch (error) {
            console.error('[ApprovalHistory] Failed to save:', error);
        }
    }
    /**
     * Load history from persistent storage
     */
    async load() {
        if (!this.context)
            return;
        try {
            const stored = this.context.globalState.get('morse.approvalHistory');
            if (stored) {
                // Convert date strings back to Date objects
                this.entries = stored.map(entry => ({
                    ...entry,
                    timestamp: new Date(entry.timestamp),
                    action: {
                        ...entry.action,
                        timestamp: new Date(entry.action.timestamp),
                    },
                }));
            }
        }
        catch (error) {
            console.error('[ApprovalHistory] Failed to load:', error);
        }
    }
    /**
     * Set the extension context
     */
    setContext(context) {
        this.context = context;
    }
}
exports.ApprovalHistory = ApprovalHistory;
/**
 * Create a new ApprovalHistory instance
 */
function createApprovalHistory(context) {
    return new ApprovalHistory(context);
}
//# sourceMappingURL=history.js.map