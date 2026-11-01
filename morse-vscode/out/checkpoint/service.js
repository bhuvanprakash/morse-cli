"use strict";
/**
 * Morse VS Code Extension - Checkpoint Service
 * Main service for checkpoint/rollback functionality
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
exports.CheckpointService = void 0;
exports.createCheckpointService = createCheckpointService;
const vscode = __importStar(require("vscode"));
const snapshot_1 = require("./snapshot");
const types_1 = require("./types");
/**
 * Checkpoint service for managing checkpoints
 */
class CheckpointService {
    context;
    snapshotEngine;
    config;
    eventEmitter;
    constructor(context, config) {
        this.context = context;
        this.config = { ...types_1.DEFAULT_CHECKPOINT_CONFIG, ...config };
        this.snapshotEngine = new snapshot_1.SnapshotEngine(context, this.config);
        this.eventEmitter = new vscode.EventEmitter();
    }
    /**
     * Event fired when a checkpoint is created
     */
    get onCheckpointCreated() {
        return this.eventEmitter.event;
    }
    /**
     * Initialize the checkpoint service
     */
    async initialize() {
        // Clean up old checkpoints on startup
        await this.cleanup();
    }
    /**
     * Create a manual checkpoint
     */
    async createCheckpoint(message) {
        const checkpoint = await this.snapshotEngine.takeSnapshot(message, 'manual');
        // Update last snapshot hash
        const hash = await this.snapshotEngine.calculateStateHash();
        this.snapshotEngine.updateLastSnapshotHash(hash);
        // Emit event
        this.eventEmitter.fire(checkpoint);
        // Clean up old checkpoints
        await this.cleanup();
        return checkpoint;
    }
    /**
     * Create an automatic checkpoint before an operation
     */
    async createAutoCheckpoint(operationType, sessionID) {
        const message = `Auto checkpoint before ${operationType}`;
        const checkpoint = await this.snapshotEngine.takeSnapshot(message, operationType);
        // Set metadata
        checkpoint.autoCreated = true;
        checkpoint.sessionID = sessionID;
        // Update last snapshot hash
        const hash = await this.snapshotEngine.calculateStateHash();
        this.snapshotEngine.updateLastSnapshotHash(hash);
        // Emit event
        this.eventEmitter.fire(checkpoint);
        return checkpoint;
    }
    /**
     * List checkpoints with optional filters
     */
    async listCheckpoints(options) {
        let checkpoints = await this.snapshotEngine.listCheckpoints();
        // Apply filters
        if (options) {
            if (options.status) {
                checkpoints = checkpoints.filter(cp => cp.status === options.status);
            }
            if (options.level) {
                checkpoints = checkpoints.filter(cp => cp.level === options.level);
            }
            if (options.operation) {
                checkpoints = checkpoints.filter(cp => cp.operationType === options.operation);
            }
            if (options.since) {
                checkpoints = checkpoints.filter(cp => cp.timestamp >= options.since);
            }
            if (options.until) {
                checkpoints = checkpoints.filter(cp => cp.timestamp <= options.until);
            }
            if (options.limit && options.limit > 0) {
                checkpoints = checkpoints.slice(0, options.limit);
            }
        }
        return checkpoints;
    }
    /**
     * Get a specific checkpoint by ID
     */
    async getCheckpoint(checkpointId) {
        return this.snapshotEngine.loadCheckpointMetadata(checkpointId);
    }
    /**
     * Restore workspace to a checkpoint
     */
    async restoreCheckpoint(checkpointId, options) {
        const checkpoint = await this.snapshotEngine.loadCheckpointMetadata(checkpointId);
        if (!checkpoint) {
            throw new Error(`Checkpoint ${checkpointId} not found`);
        }
        const opts = options || { dryRun: false, backup: false };
        if (opts.dryRun) {
            // Just show what would be restored
            vscode.window.showInformationMessage(`Would restore ${checkpoint.files.length} files from checkpoint "${checkpoint.message}"`);
            return;
        }
        // Confirm restore
        const response = await vscode.window.showWarningMessage(`Restore to checkpoint "${checkpoint.message}"? This will overwrite uncommitted changes.`, { modal: true }, 'Restore', 'Cancel');
        if (response !== 'Restore') {
            return;
        }
        // Create backup if requested
        if (opts.backup) {
            await this.createCheckpoint('Backup before restore');
        }
        // Restore files
        await this.snapshotEngine.restoreFromCheckpoint(checkpointId, opts.files);
        vscode.window.showInformationMessage(`Restored to checkpoint "${checkpoint.message}"`);
    }
    /**
     * Delete a checkpoint (marks as deleted)
     */
    async deleteCheckpoint(checkpointId) {
        // Confirm delete
        const response = await vscode.window.showWarningMessage(`Delete checkpoint "${checkpointId}"? This cannot be undone.`, { modal: true }, 'Delete', 'Cancel');
        if (response !== 'Delete') {
            return;
        }
        await this.snapshotEngine.deleteCheckpoint(checkpointId);
    }
    /**
     * Compare two checkpoints
     */
    async compareCheckpoints(checkpointId1, checkpointId2) {
        const checkpoint1 = await this.snapshotEngine.loadCheckpointMetadata(checkpointId1);
        if (!checkpoint1) {
            throw new Error(`Checkpoint ${checkpointId1} not found`);
        }
        // If no second checkpoint, compare with current state
        if (!checkpointId2) {
            const diff = await this.snapshotEngine.compareWithCheckpoint(checkpoint1);
            return {
                fromCheckpoint: checkpoint1,
                files: diff.changed.map(f => ({
                    path: f.path,
                    changeType: f.changeType,
                    oldContent: undefined,
                    newContent: undefined,
                })).concat(diff.added.map(f => ({
                    path: f.path,
                    changeType: 'added',
                    oldContent: undefined,
                    newContent: undefined,
                })), diff.deleted.map(f => ({
                    path: f.path,
                    changeType: 'deleted',
                    oldContent: undefined,
                    newContent: undefined,
                }))),
            };
        }
        const checkpoint2 = await this.snapshotEngine.loadCheckpointMetadata(checkpointId2);
        if (!checkpoint2) {
            throw new Error(`Checkpoint ${checkpointId2} not found`);
        }
        // Get diff between two checkpoints
        const diff = await this.snapshotEngine.getCheckpointDiff(checkpointId1, checkpointId2);
        return {
            fromCheckpoint: checkpoint1,
            toCheckpoint: checkpoint2,
            files: diff.files,
        };
    }
    /**
     * Show diff between checkpoints using VS Code diff viewer
     */
    async showCheckpointDiff(checkpointId1, checkpointId2) {
        const diff = await this.compareCheckpoints(checkpointId1, checkpointId2);
        if (diff.files.length === 0) {
            vscode.window.showInformationMessage('No changes between checkpoints');
            return;
        }
        // Show diff in a new document
        const diffText = this.formatDiffAsText(diff.files);
        const doc = await vscode.workspace.openTextDocument({
            content: diffText,
            language: 'diff',
        });
        await vscode.window.showTextDocument(doc, {
            viewColumn: vscode.ViewColumn.One,
            preserveFocus: false,
        });
    }
    /**
     * Export checkpoint to a file
     */
    async exportCheckpoint(checkpointId, targetPath) {
        const checkpoint = await this.snapshotEngine.loadCheckpointMetadata(checkpointId);
        if (!checkpoint) {
            throw new Error(`Checkpoint ${checkpointId} not found`);
        }
        // Create export data
        const exportData = {
            version: 1,
            checkpoint,
            exportedAt: new Date().toISOString(),
        };
        // Write to file
        const fs = require('fs');
        await fs.promises.writeFile(targetPath, JSON.stringify(exportData, null, 2), 'utf-8');
        vscode.window.showInformationMessage(`Exported checkpoint to ${targetPath}`);
    }
    /**
     * Import checkpoint from a file
     */
    async importCheckpoint(sourcePath) {
        const fs = require('fs');
        const data = await fs.promises.readFile(sourcePath, 'utf-8');
        const importData = JSON.parse(data);
        if (!importData.checkpoint) {
            throw new Error('Invalid checkpoint file');
        }
        const checkpoint = importData.checkpoint;
        // Generate new ID
        checkpoint.id = `imported_${Date.now()}`;
        // Save to storage
        // Note: In a real implementation, we'd copy the files too
        return checkpoint;
    }
    /**
     * Get current config
     */
    getConfig() {
        return this.config;
    }
    /**
     * Update config
     */
    updateConfig(config) {
        this.config = { ...this.config, ...config };
    }
    /**
     * Check if there are significant changes since last snapshot
     */
    async hasSignificantChanges() {
        return this.snapshotEngine.hasSignificantChanges();
    }
    /**
     * Clean up old checkpoints
     */
    async cleanup() {
        await this.snapshotEngine.cleanupOldCheckpoints(this.config.maxCheckpoints);
    }
    /**
     * Format diff as text
     */
    formatDiffAsText(files) {
        let text = '--- Checkpoint Diff\n\n';
        for (const file of files) {
            text += `${this.getChangeSymbol(file.changeType)} ${file.path}\n`;
            if (file.oldContent !== undefined || file.newContent !== undefined) {
                text += '```\n';
                if (file.oldContent) {
                    text += `- ${file.oldContent.split('\n').join('\n- ')}\n`;
                }
                if (file.newContent) {
                    text += `+ ${file.newContent.split('\n').join('\n+ ')}\n`;
                }
                text += '```\n\n';
            }
        }
        return text;
    }
    /**
     * Get change symbol
     */
    getChangeSymbol(changeType) {
        switch (changeType) {
            case 'added': return '+';
            case 'deleted': return '-';
            case 'modified': return 'M';
            case 'renamed': return 'R';
            default: return '?';
        }
    }
    /**
     * Dispose of the service
     */
    dispose() {
        this.eventEmitter.dispose();
    }
}
exports.CheckpointService = CheckpointService;
/**
 * Create and initialize the checkpoint service
 */
async function createCheckpointService(context, config) {
    const service = new CheckpointService(context, config);
    await service.initialize();
    return service;
}
//# sourceMappingURL=service.js.map