"use strict";
/**
 * Morse VS Code Extension - Checkpoint Types
 * Defines interfaces for checkpoint/rollback functionality
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
exports.DEFAULT_CHECKPOINT_CONFIG = exports.CheckpointFileTreeItem = exports.CheckpointTreeItem = void 0;
exports.changeTypeToString = changeTypeToString;
exports.stringToChangeType = stringToChangeType;
const vscode = __importStar(require("vscode"));
/**
 * Checkpoint tree item for tree view
 */
class CheckpointTreeItem extends vscode.TreeItem {
    checkpoint;
    children;
    constructor(checkpoint) {
        super(`${checkpoint.message} (${checkpoint.timestamp.toLocaleString()})`, vscode.TreeItemCollapsibleState.Collapsed);
        this.checkpoint = checkpoint;
        this.id = checkpoint.id;
        this.description = `${checkpoint.filesChanged} files`;
        // Set icon based on status
        switch (checkpoint.status) {
            case 'active':
                this.iconPath = new vscode.ThemeIcon('check');
                break;
            case 'archived':
                this.iconPath = new vscode.ThemeIcon('archive');
                break;
            case 'deleted':
                this.iconPath = new vscode.ThemeIcon('trash');
                break;
        }
        // Set context value for menu actions
        this.contextValue = `checkpoint.${checkpoint.status}`;
    }
}
exports.CheckpointTreeItem = CheckpointTreeItem;
/**
 * File tree item for checkpoint details
 */
class CheckpointFileTreeItem extends vscode.TreeItem {
    file;
    checkpointID;
    constructor(file, checkpointID) {
        super(file.path, vscode.TreeItemCollapsibleState.None);
        this.file = file;
        this.checkpointID = checkpointID;
        // Set icon based on change type
        switch (file.changeType) {
            case 'added':
                this.iconPath = new vscode.ThemeIcon('add');
                break;
            case 'deleted':
                this.iconPath = new vscode.ThemeIcon('trash');
                break;
            case 'modified':
                this.iconPath = new vscode.ThemeIcon('edit');
                break;
            case 'renamed':
                this.iconPath = new vscode.ThemeIcon('files');
                break;
            default:
                this.iconPath = new vscode.ThemeIcon('file');
        }
        this.contextValue = 'checkpointFile';
        this.description = file.changeType;
        if (file.size !== undefined) {
            this.description += ` (${(file.size / 1024).toFixed(1)} KB)`;
        }
    }
}
exports.CheckpointFileTreeItem = CheckpointFileTreeItem;
/**
 * Default checkpoint configuration
 */
exports.DEFAULT_CHECKPOINT_CONFIG = {
    maxCheckpoints: 50,
    autoSnapshotInterval: 30,
    autoSnapshotEnabled: true,
    compressionLevel: 6,
    ignorePatterns: [
        'node_modules/**',
        '.git/**',
        'dist/**',
        'build/**',
        '*.log',
        '.DS_Store',
        '*.tmp',
        '*.swp',
    ],
    maxFileSize: 10 * 1024 * 1024, // 10MB
    incrementalSnapshots: true,
    retentionDays: 0,
    triggerOnSignificantChanges: true,
    significantChangesThreshold: 10,
};
/**
 * Change type string to enum helper
 */
function changeTypeToString(type) {
    const map = {
        unmodified: 'unmodified',
        added: 'added',
        deleted: 'deleted',
        modified: 'modified',
        renamed: 'renamed',
        copied: 'copied',
    };
    return map[type] || 'unmodified';
}
/**
 * String to change type helper
 */
function stringToChangeType(str) {
    const map = {
        unmodified: 'unmodified',
        added: 'added',
        deleted: 'deleted',
        modified: 'modified',
        renamed: 'renamed',
        copied: 'copied',
    };
    return map[str] || 'unmodified';
}
//# sourceMappingURL=types.js.map