"use strict";
/**
 * Audit Log Hook
 *
 * Built-in hook that logs all operations for auditing purposes.
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
exports.AuditLogHook = void 0;
exports.createAuditLogHook = createAuditLogHook;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * Audit Log Hook
 * Logs all operations for auditing
 */
class AuditLogHook {
    config;
    logFile = null;
    entries = [];
    constructor(config = {}) {
        this.config = {
            logFile: config.logFile,
            includeTimestamps: config.includeTimestamps ?? true,
            includeContext: config.includeContext ?? false,
            logLevels: config.logLevels || ['info', 'warn', 'error'],
        };
        if (config.logFile) {
            this.initLogFile(config.logFile);
        }
    }
    /**
     * Initialize log file
     */
    initLogFile(logFile) {
        try {
            const dir = path.dirname(logFile);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            if (!fs.existsSync(logFile)) {
                fs.writeFileSync(logFile, '', 'utf-8');
            }
            this.logFile = logFile;
        }
        catch (error) {
            console.error('[AuditLog] Failed to initialize log file:', error);
        }
    }
    /**
     * Execute the audit log hook
     */
    async execute(context) {
        const entry = {
            timestamp: new Date().toISOString(),
            event: context.event,
            source: context.source,
            sessionId: context.sessionId,
            success: true,
        };
        if (this.config.includeContext && context.data) {
            entry.data = context.data;
        }
        this.entries.push(entry);
        // Write to file if configured
        if (this.logFile) {
            try {
                const logLine = JSON.stringify(entry) + '\n';
                fs.appendFileSync(this.logFile, logLine, 'utf-8');
            }
            catch (error) {
                console.error('[AuditLog] Failed to write to log file:', error);
            }
        }
        const logEntry = {
            timestamp: Date.now(),
            level: 'info',
            message: `Audit: ${context.event} from ${context.source}`,
            data: entry,
        };
        return {
            success: true,
            continue: true,
            modified: false,
            logs: [logEntry],
        };
    }
    /**
     * Log an error
     */
    async logError(context, error) {
        const entry = {
            timestamp: new Date().toISOString(),
            event: context.event,
            source: context.source,
            sessionId: context.sessionId,
            success: false,
            error,
        };
        this.entries.push(entry);
        if (this.logFile) {
            try {
                const logLine = JSON.stringify(entry) + '\n';
                fs.appendFileSync(this.logFile, logLine, 'utf-8');
            }
            catch (err) {
                console.error('[AuditLog] Failed to write to log file:', err);
            }
        }
    }
    /**
     * Get all audit entries
     */
    getEntries() {
        return [...this.entries];
    }
    /**
     * Get entries for a specific session
     */
    getEntriesForSession(sessionId) {
        return this.entries.filter(e => e.sessionId === sessionId);
    }
    /**
     * Clear entries
     */
    clearEntries() {
        this.entries = [];
    }
    /**
     * Export entries to file
     */
    async exportToFile(filePath) {
        try {
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(filePath, JSON.stringify(this.entries, null, 2), 'utf-8');
            return true;
        }
        catch (error) {
            console.error('[AuditLog] Failed to export entries:', error);
            return false;
        }
    }
    /**
     * Show log file in VS Code
     */
    showLogFile() {
        if (this.logFile && fs.existsSync(this.logFile)) {
            vscode.window.showTextDocument(vscode.Uri.file(this.logFile));
        }
    }
    /**
     * Update configuration
     */
    updateConfig(config) {
        this.config = { ...this.config, ...config };
        if (config.logFile && config.logFile !== this.logFile) {
            this.initLogFile(config.logFile);
        }
    }
}
exports.AuditLogHook = AuditLogHook;
/**
 * Create a new audit log hook
 */
function createAuditLogHook(config) {
    return new AuditLogHook(config);
}
//# sourceMappingURL=auditLog.js.map