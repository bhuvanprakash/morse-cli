"use strict";
/**
 * File Tracker Hook
 *
 * Built-in hook that tracks file changes during execution.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileTrackerHook = void 0;
exports.createFileTrackerHook = createFileTrackerHook;
/**
 * File Tracker Hook
 * Tracks file changes during execution
 */
class FileTrackerHook {
    config;
    changes = [];
    ignorePatterns;
    constructor(config = {}) {
        this.config = config;
        this.ignorePatterns = (config.ignorePatterns || []).map(p => new RegExp(p));
    }
    /**
     * Execute the file tracker hook
     */
    async execute(context) {
        const data = context.data;
        // Extract file information from context
        const filePath = typeof data.path === 'string' ? data.path :
            typeof data.filePath === 'string' ? data.filePath : '';
        const operation = typeof data.operation === 'string' ? data.operation : 'modify';
        if (!filePath) {
            return {
                success: true,
                continue: true,
                modified: false,
            };
        }
        // Check ignore patterns
        for (const pattern of this.ignorePatterns) {
            if (pattern.test(filePath)) {
                return {
                    success: true,
                    continue: true,
                    modified: false,
                };
            }
        }
        // Record the change
        const record = {
            path: filePath,
            operation: operation,
            timestamp: Date.now(),
            size: typeof data.size === 'number' ? data.size : undefined,
        };
        this.changes.push(record);
        // Add log entry
        const logEntry = {
            timestamp: Date.now(),
            level: 'info',
            message: `File ${record.operation}: ${record.path}`,
            data: record,
        };
        return {
            success: true,
            continue: true,
            modified: false,
            logs: [logEntry],
        };
    }
    /**
     * Get all tracked changes
     */
    getChanges() {
        return [...this.changes];
    }
    /**
     * Clear tracked changes
     */
    clearChanges() {
        this.changes = [];
    }
    /**
     * Get changes for a specific file
     */
    getChangesForFile(filePath) {
        return this.changes.filter(c => c.path === filePath);
    }
    /**
     * Update configuration
     */
    updateConfig(config) {
        this.config = { ...this.config, ...config };
        if (config.ignorePatterns) {
            this.ignorePatterns = config.ignorePatterns.map(p => new RegExp(p));
        }
    }
}
exports.FileTrackerHook = FileTrackerHook;
/**
 * Create a new file tracker hook
 */
function createFileTrackerHook(config) {
    return new FileTrackerHook(config);
}
//# sourceMappingURL=fileTracker.js.map