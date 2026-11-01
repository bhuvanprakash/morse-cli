"use strict";
/**
 * Morse VS Code Extension - Checkpoint UI
 * Provides UI components for checkpoint functionality
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
exports.CheckpointUI = void 0;
exports.showCheckpointTimeline = showCheckpointTimeline;
exports.showCreateConfirmation = showCreateConfirmation;
const vscode = __importStar(require("vscode"));
/**
 * Checkpoint tree item for tree view
 */
class CheckpointItem extends vscode.TreeItem {
    label;
    description;
    checkpoint;
    filePath;
    checkpointId;
    constructor(label, description, checkpoint, filePath, checkpointId) {
        super(label, vscode.TreeItemCollapsibleState.Collapsed);
        this.label = label;
        this.description = description;
        this.checkpoint = checkpoint;
        this.filePath = filePath;
        this.checkpointId = checkpointId;
        this.description = description;
        // Ensure label is always a string
        this.label = label;
        if (checkpoint) {
            this.contextValue = `checkpoint.${checkpoint.status}`;
            this.iconPath = new vscode.ThemeIcon('check');
        }
        else if (filePath) {
            this.contextValue = 'checkpointFile';
            this.iconPath = new vscode.ThemeIcon('file');
        }
    }
}
/**
 * Checkpoint tree data provider for sidebar
 */
class CheckpointTreeDataProvider {
    service;
    _onDidChangeTreeData = new vscode.EventEmitter();
    constructor(service) {
        this.service = service;
        // Listen for checkpoint creation events
        this.service.onCheckpointCreated(() => {
            this.refresh();
        });
    }
    get onDidChangeTreeData() {
        return this._onDidChangeTreeData.event;
    }
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return element;
    }
    async getChildren(element) {
        if (!element) {
            // Root level - return list of checkpoints
            const options = {
                limit: 50,
                status: 'active',
            };
            const checkpoints = await this.service.listCheckpoints(options);
            return checkpoints.map(cp => new CheckpointItem(cp.message, `${cp.timestamp.toLocaleString()} - ${cp.filesChanged} files`, cp));
        }
        // Second level - return files in a checkpoint
        const checkpoint = element.checkpoint;
        if (checkpoint) {
            return checkpoint.files.map(file => new CheckpointItem(file.path, file.changeType, undefined, file.path, checkpoint.id));
        }
        return [];
    }
    getParent(_element) {
        return undefined;
    }
}
/**
 * Checkpoint UI manager
 */
class CheckpointUI {
    service;
    autoManager;
    treeDataProvider;
    treeView;
    context;
    constructor(context, service, autoManager) {
        this.context = context;
        this.service = service;
        this.autoManager = autoManager;
        this.treeDataProvider = new CheckpointTreeDataProvider(service);
        // Create tree view
        this.treeView = vscode.window.createTreeView('morse.checkpoints', {
            treeDataProvider: this.treeDataProvider,
            showCollapseAll: true,
        });
        // Register commands
        this.registerCommands();
    }
    /**
     * Register checkpoint commands
     */
    registerCommands() {
        // Create checkpoint
        this.context.subscriptions.push(vscode.commands.registerCommand('morse.checkpoint.create', async () => {
            await this.showCreateDialog();
        }));
        // Restore checkpoint
        this.context.subscriptions.push(vscode.commands.registerCommand('morse.checkpoint.restore', async (item) => {
            if (item.checkpoint) {
                await this.service.restoreCheckpoint(item.checkpoint.id);
                this.refresh();
            }
        }));
        // Delete checkpoint
        this.context.subscriptions.push(vscode.commands.registerCommand('morse.checkpoint.delete', async (item) => {
            if (item.checkpoint) {
                await this.service.deleteCheckpoint(item.checkpoint.id);
                this.refresh();
            }
        }));
        // Show checkpoint details
        this.context.subscriptions.push(vscode.commands.registerCommand('morse.checkpoint.show', async (item) => {
            if (item.checkpoint) {
                await this.showCheckpointDetails(item.checkpoint);
            }
        }));
        // Compare checkpoint with current
        this.context.subscriptions.push(vscode.commands.registerCommand('morse.checkpoint.diff', async (item) => {
            if (item.checkpoint) {
                await this.service.showCheckpointDiff(item.checkpoint.id);
            }
        }));
        // Compare two checkpoints
        this.context.subscriptions.push(vscode.commands.registerCommand('morse.checkpoint.diffWith', async (item) => {
            if (item.checkpoint) {
                const checkpoints = await this.service.listCheckpoints({ limit: 20 });
                const otherCheckpoints = checkpoints.filter(cp => cp.id !== item.checkpoint.id);
                const selected = await vscode.window.showQuickPick(otherCheckpoints.map(cp => ({
                    label: cp.message,
                    description: cp.timestamp.toLocaleString(),
                    checkpoint: cp,
                })), { placeHolder: 'Select checkpoint to compare' });
                if (selected) {
                    await this.service.showCheckpointDiff(item.checkpoint.id, selected.checkpoint.id);
                }
            }
        }));
        // View file in checkpoint
        this.context.subscriptions.push(vscode.commands.registerCommand('morse.checkpoint.viewFile', async (item) => {
            if (item.filePath && item.checkpointId) {
                await this.viewFileInCheckpoint(item.checkpointId, item.filePath);
            }
        }));
        // Restore file from checkpoint
        this.context.subscriptions.push(vscode.commands.registerCommand('morse.checkpoint.restoreFile', async (item) => {
            if (item.filePath && item.checkpointId) {
                await this.service.restoreCheckpoint(item.checkpointId, { files: [item.filePath] });
            }
        }));
        // Trigger manual snapshot
        this.context.subscriptions.push(vscode.commands.registerCommand('morse.checkpoint.snapshot', async () => {
            await this.autoManager.triggerManualSnapshot();
            this.refresh();
        }));
        // Refresh tree view
        this.context.subscriptions.push(vscode.commands.registerCommand('morse.checkpoint.refresh', async () => {
            this.refresh();
        }));
    }
    /**
     * Show create checkpoint dialog
     */
    async showCreateDialog() {
        const message = await vscode.window.showInputBox({
            prompt: 'Enter a description for this checkpoint',
            placeHolder: 'What changes does this checkpoint capture?',
            validateInput: (value) => {
                if (!value || value.trim().length === 0) {
                    return 'Please enter a description';
                }
                return undefined;
            },
        });
        if (message) {
            try {
                const checkpoint = await this.service.createCheckpoint(message);
                vscode.window.showInformationMessage(`Created checkpoint: ${checkpoint.id}`);
                this.refresh();
            }
            catch (error) {
                vscode.window.showErrorMessage(`Failed to create checkpoint: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    }
    /**
     * Show checkpoint details
     */
    async showCheckpointDetails(checkpoint) {
        const items = [
            { label: `Message: ${checkpoint.message}`, kind: vscode.QuickPickItemKind.Default },
            { label: `Created: ${checkpoint.timestamp.toLocaleString()}`, kind: vscode.QuickPickItemKind.Default },
            { label: `Files: ${checkpoint.filesChanged}`, kind: vscode.QuickPickItemKind.Default },
            { label: `Auto-created: ${checkpoint.autoCreated ? 'Yes' : 'No'}`, kind: vscode.QuickPickItemKind.Default },
            { label: `Level: ${checkpoint.level}`, kind: vscode.QuickPickItemKind.Default },
        ];
        if (checkpoint.operationType) {
            items.push({ label: `Operation: ${checkpoint.operationType}`, kind: vscode.QuickPickItemKind.Default });
        }
        if (checkpoint.sessionID) {
            items.push({ label: `Session: ${checkpoint.sessionID}`, kind: vscode.QuickPickItemKind.Default });
        }
        await vscode.window.showQuickPick(items, {
            title: `Checkpoint: ${checkpoint.id}`,
            matchOnDescription: true,
        });
    }
    /**
     * View a file from a checkpoint
     */
    async viewFileInCheckpoint(checkpointId, filePath) {
        const checkpoint = await this.service.getCheckpoint(checkpointId);
        if (!checkpoint) {
            vscode.window.showErrorMessage('Checkpoint not found');
            return;
        }
        // Show file path information
        vscode.window.showInformationMessage(`Viewing ${filePath} from checkpoint ${checkpointId}`);
    }
    /**
     * Refresh the tree view
     */
    refresh() {
        this.treeDataProvider.refresh();
    }
    /**
     * Dispose of the UI
     */
    dispose() {
        this.treeView.dispose();
    }
}
exports.CheckpointUI = CheckpointUI;
/**
 * Show checkpoint timeline
 */
async function showCheckpointTimeline(service) {
    const checkpoints = await service.listCheckpoints({ limit: 20, status: 'active' });
    if (checkpoints.length === 0) {
        vscode.window.showInformationMessage('No checkpoints found');
        return;
    }
    const items = checkpoints.map(cp => ({
        label: cp.message,
        description: `${cp.timestamp.toLocaleString()} - ${cp.filesChanged} files`,
        checkpoint: cp,
    }));
    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select a checkpoint',
        matchOnDescription: true,
    });
    if (selected) {
        // Show actions for selected checkpoint
        const action = await vscode.window.showQuickPick([
            { label: 'Restore', description: 'Restore to this checkpoint' },
            { label: 'View Details', description: 'View checkpoint details' },
            { label: 'Compare with Current', description: 'Compare with current workspace' },
            { label: 'Delete', description: 'Delete this checkpoint' },
        ], {
            placeHolder: `What to do with "${selected.label}"?`,
        });
        if (action) {
            switch (action.label) {
                case 'Restore':
                    await service.restoreCheckpoint(selected.checkpoint.id);
                    break;
                case 'View Details':
                    vscode.window.showInformationMessage(`ID: ${selected.checkpoint.id}\n` +
                        `Message: ${selected.checkpoint.message}\n` +
                        `Time: ${selected.checkpoint.timestamp.toLocaleString()}\n` +
                        `Files: ${selected.checkpoint.filesChanged}\n` +
                        `Auto: ${selected.checkpoint.autoCreated ? 'Yes' : 'No'}`);
                    break;
                case 'Compare with Current':
                    await service.showCheckpointDiff(selected.checkpoint.id);
                    break;
                case 'Delete':
                    await service.deleteCheckpoint(selected.checkpoint.id);
                    break;
            }
        }
    }
}
/**
 * Show checkpoint creation confirmation
 */
async function showCreateConfirmation() {
    return vscode.window.showInputBox({
        prompt: 'Enter checkpoint description',
        placeHolder: 'e.g., Before refactoring authentication',
        validateInput: (value) => {
            if (!value || value.trim().length === 0) {
                return 'Please enter a description';
            }
            return undefined;
        },
    });
}
//# sourceMappingURL=ui.js.map