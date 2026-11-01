"use strict";
/**
 * Morse VS Code Extension - Auto Snapshot
 * Handles automatic checkpoint creation
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
exports.AutoSnapshotManager = void 0;
exports.createAutoSnapshotManager = createAutoSnapshotManager;
const vscode = __importStar(require("vscode"));
/**
 * Auto-snapshot manager for periodic and event-based checkpoint creation
 */
class AutoSnapshotManager {
    service;
    config;
    intervalTimer = null;
    fileWatcher = null;
    eventEmitter;
    lastSignificantChangeCheck = 0;
    pendingChanges = new Set();
    constructor(service, config) {
        this.service = service;
        this.config = config;
        this.eventEmitter = new vscode.EventEmitter();
    }
    /**
     * Event fired when an auto-snapshot is created
     */
    get onSnapshot() {
        return this.eventEmitter.event;
    }
    /**
     * Start the auto-snapshot manager
     */
    start() {
        if (this.config.autoSnapshotEnabled) {
            // Start interval-based snapshots
            if (this.config.autoSnapshotInterval > 0) {
                this.startIntervalSnapshots();
            }
            // Start file change monitoring
            if (this.config.triggerOnSignificantChanges) {
                this.startFileWatcher();
            }
        }
    }
    /**
     * Stop the auto-snapshot manager
     */
    stop() {
        this.stopIntervalSnapshots();
        this.stopFileWatcher();
    }
    /**
     * Create a snapshot before an operation
     */
    async snapshotBeforeOperation(operationType, sessionID) {
        if (!this.config.autoSnapshotEnabled) {
            return;
        }
        try {
            await this.service.createAutoCheckpoint(operationType, sessionID);
            this.eventEmitter.fire({
                trigger: 'before_operation',
                timestamp: new Date(),
                description: `Snapshot before ${operationType}`,
            });
        }
        catch (error) {
            console.error('Failed to create auto snapshot:', error);
        }
    }
    /**
     * Manually trigger a snapshot
     */
    async triggerManualSnapshot(message) {
        try {
            const checkpoint = await this.service.createCheckpoint(message || 'Manual snapshot');
            this.eventEmitter.fire({
                trigger: 'manual',
                timestamp: new Date(),
                checkpointID: checkpoint.id,
                description: message || 'Manual snapshot',
            });
        }
        catch (error) {
            console.error('Failed to create manual snapshot:', error);
            vscode.window.showErrorMessage('Failed to create snapshot');
        }
    }
    /**
     * Check if significant changes have occurred
     */
    async checkForSignificantChanges() {
        // Throttle checks
        const now = Date.now();
        if (now - this.lastSignificantChangeCheck < 5000) {
            return false;
        }
        this.lastSignificantChangeCheck = now;
        return this.service.hasSignificantChanges();
    }
    /**
     * Start interval-based snapshots
     */
    startIntervalSnapshots() {
        const intervalMs = this.config.autoSnapshotInterval * 60 * 1000;
        this.intervalTimer = setInterval(async () => {
            try {
                const hasChanges = await this.checkForSignificantChanges();
                if (hasChanges) {
                    const checkpoint = await this.service.createCheckpoint(`Auto snapshot at ${new Date().toLocaleTimeString()}`);
                    this.eventEmitter.fire({
                        trigger: 'interval',
                        timestamp: new Date(),
                        checkpointID: checkpoint.id,
                        description: 'Periodic auto snapshot',
                    });
                    vscode.window.setStatusBarMessage(`Morse: Auto checkpoint created (${checkpoint.filesChanged} files)`, 3000);
                }
            }
            catch (error) {
                console.error('Interval snapshot failed:', error);
            }
        }, intervalMs);
    }
    /**
     * Stop interval-based snapshots
     */
    stopIntervalSnapshots() {
        if (this.intervalTimer) {
            clearInterval(this.intervalTimer);
            this.intervalTimer = null;
        }
    }
    /**
     * Start file change watcher
     */
    startFileWatcher() {
        const workspace = vscode.workspace.workspaceFolders?.[0];
        if (!workspace) {
            return;
        }
        // Watch for file changes
        this.fileWatcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(workspace, '**/*'));
        // Handle file changes
        this.fileWatcher.onDidChange((uri) => {
            this.handleFileChange(uri.fsPath);
        });
        this.fileWatcher.onDidCreate((uri) => {
            this.handleFileChange(uri.fsPath);
        });
        this.fileWatcher.onDidDelete((uri) => {
            this.handleFileChange(uri.fsPath);
        });
    }
    /**
     * Stop file change watcher
     */
    stopFileWatcher() {
        if (this.fileWatcher) {
            this.fileWatcher.dispose();
            this.fileWatcher = null;
        }
    }
    /**
     * Handle file change
     */
    handleFileChange(filePath) {
        // Ignore changes in .morse directory
        if (filePath.includes('.morse') || filePath.includes('node_modules')) {
            return;
        }
        this.pendingChanges.add(filePath);
        // Debounce and check for significant changes
        setTimeout(async () => {
            if (this.pendingChanges.size >= this.config.significantChangesThreshold) {
                const hasChanges = await this.checkForSignificantChanges();
                if (hasChanges) {
                    try {
                        const checkpoint = await this.service.createCheckpoint(`Auto snapshot (${this.pendingChanges.size} files changed)`);
                        this.eventEmitter.fire({
                            trigger: 'significant_change',
                            timestamp: new Date(),
                            checkpointID: checkpoint.id,
                            filesChanged: this.pendingChanges.size,
                            description: `Significant changes detected (${this.pendingChanges.size} files)`,
                        });
                        vscode.window.setStatusBarMessage(`Morse: Auto checkpoint created (${this.pendingChanges.size} files)`, 3000);
                    }
                    catch (error) {
                        console.error('Significant change snapshot failed:', error);
                    }
                }
                this.pendingChanges.clear();
            }
        }, 2000); // Wait 2 seconds for changes to accumulate
    }
    /**
     * Update configuration
     */
    updateConfig(config) {
        const wasEnabled = this.config.autoSnapshotEnabled;
        this.config = { ...this.config, ...config };
        // Handle enabled/disabled state changes
        if (wasEnabled && !this.config.autoSnapshotEnabled) {
            this.stop();
        }
        else if (!wasEnabled && this.config.autoSnapshotEnabled) {
            this.start();
        }
        else if (this.config.autoSnapshotEnabled) {
            // Restart with new config
            this.stop();
            this.start();
        }
    }
    /**
     * Get pending changes count
     */
    getPendingChangesCount() {
        return this.pendingChanges.size;
    }
    /**
     * Dispose of the manager
     */
    dispose() {
        this.stop();
        this.eventEmitter.dispose();
    }
}
exports.AutoSnapshotManager = AutoSnapshotManager;
/**
 * Create and start the auto-snapshot manager
 */
function createAutoSnapshotManager(service, config) {
    const manager = new AutoSnapshotManager(service, config);
    manager.start();
    return manager;
}
//# sourceMappingURL=auto.js.map