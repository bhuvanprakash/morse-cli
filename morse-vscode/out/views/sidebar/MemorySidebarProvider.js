"use strict";
/**
 * Memory Sidebar Provider for Morse VS Code Extension
 * Tree view showing memory entries with add/edit/delete functionality
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
exports.MemorySidebarProvider = void 0;
exports.getMemorySidebarProvider = getMemorySidebarProvider;
exports.registerMemorySidebar = registerMemorySidebar;
const vscode = __importStar(require("vscode"));
const client_1 = require("../../memory/client");
class MemorySidebarProvider {
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    memoryClient;
    memoryState = null;
    syncStatus = null;
    constructor() {
        this.memoryClient = (0, client_1.getMemoryClient)();
        this.refresh();
    }
    /**
     * Refresh the memory tree view
     */
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    /**
     * Load memory state from storage
     */
    async loadMemory() {
        try {
            this.memoryState = await this.memoryClient.show();
            this.syncStatus = await this.memoryClient.getSyncStatus();
            this.refresh();
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to load memory: ${error}`);
        }
    }
    /**
     * Get tree item for element
     */
    getTreeItem(element) {
        return element;
    }
    /**
     * Get children of element
     */
    getChildren(element) {
        if (!element) {
            return this.getRootItems();
        }
        // Return children for sections
        if (element.contextValue === 'section-entries' && this.memoryState) {
            return Promise.resolve(this.getEntryItems());
        }
        return Promise.resolve([]);
    }
    /**
     * Get root tree items
     */
    async getRootItems() {
        // Ensure memory is loaded
        if (!this.memoryState) {
            await this.loadMemory();
        }
        const items = [];
        // Sync status indicator
        if (this.syncStatus) {
            const statusIcon = this.syncStatus.cliAvailable
                ? (this.syncStatus.synced ? '$(sync)' : '$(warning)')
                : '$(error)';
            const statusText = this.syncStatus.cliAvailable
                ? (this.syncStatus.synced ? 'Synced with CLI' : 'Local only')
                : 'CLI not found';
            items.push(new MemoryTreeItem(`${statusIcon} ${statusText}`, vscode.TreeItemCollapsibleState.None, 'sync-status', { command: 'morse.memory.sync', title: 'Sync Memory' }));
        }
        // Memory mode (project vs global)
        const modeIcon = this.memoryState?.isGlobal ? '$(globe)' : '$(file-submodule)';
        const modeText = this.memoryState?.isGlobal ? 'Global Memory' : 'Project Memory';
        items.push(new MemoryTreeItem(`${modeIcon} ${modeText}`, vscode.TreeItemCollapsibleState.None, 'memory-mode', { command: 'morse.memory.toggleGlobal', title: 'Toggle Memory Mode' }));
        // Token usage
        if (this.memoryState) {
            const tokenPercent = Math.min(100, Math.round((this.memoryState.tokenCount / 4000) * 100));
            items.push(new MemoryTreeItem(`$(brain) ${this.memoryState.tokenCount.toLocaleString()} / 4,000 tokens (${tokenPercent}%)`, vscode.TreeItemCollapsibleState.None, 'token-usage'));
        }
        // Actions section
        items.push(new MemoryTreeItem('Actions', vscode.TreeItemCollapsibleState.Expanded, 'section'));
        items.push(new MemoryTreeItem('$(plus) Add Note', vscode.TreeItemCollapsibleState.None, 'action-add', { command: 'morse.memory.append', title: 'Add Note' }));
        items.push(new MemoryTreeItem('$(edit) Edit Memory', vscode.TreeItemCollapsibleState.None, 'action-edit', { command: 'morse.memory.edit', title: 'Edit Memory' }));
        items.push(new MemoryTreeItem('$(search) Search', vscode.TreeItemCollapsibleState.None, 'action-search', { command: 'morse.memory.search', title: 'Search Memory' }));
        items.push(new MemoryTreeItem('$(window) Open in Editor', vscode.TreeItemCollapsibleState.None, 'action-open', { command: 'morse.memory.openEditor', title: 'Open in Editor' }));
        items.push(new MemoryTreeItem('$(sync) Sync', vscode.TreeItemCollapsibleState.None, 'action-sync', { command: 'morse.memory.sync', title: 'Sync with CLI' }));
        // Entries section
        if (this.memoryState && this.memoryState.entries.length > 0) {
            items.push(new MemoryTreeItem(`$(clipboard) Entries (${this.memoryState.entries.length})`, vscode.TreeItemCollapsibleState.Expanded, 'section-entries'));
        }
        else {
            items.push(new MemoryTreeItem('$(info) No entries yet', vscode.TreeItemCollapsibleState.None, 'empty'));
        }
        // Clear option
        if (this.memoryState && this.memoryState.content.trim()) {
            items.push(new MemoryTreeItem('$(trash) Clear All', vscode.TreeItemCollapsibleState.None, 'action-clear', { command: 'morse.memory.clear', title: 'Clear Memory' }));
        }
        return Promise.resolve(items);
    }
    /**
     * Get memory entry items
     */
    getEntryItems() {
        if (!this.memoryState) {
            return [];
        }
        const items = [];
        // Show recent entries
        for (const entry of this.memoryState.entries.slice(0, 20)) {
            const label = entry.content.substring(0, 60) + (entry.content.length > 60 ? '...' : '');
            const date = new Date(entry.timestamp).toLocaleDateString();
            const item = new MemoryTreeItem(`$(note) ${label}`, vscode.TreeItemCollapsibleState.Collapsed, 'entry', { command: 'morse.memory.show', title: 'View Entry' });
            item.entryData = entry;
            item.description = date;
            items.push(item);
        }
        if (this.memoryState.entries.length > 20) {
            items.push(new MemoryTreeItem(`... and ${this.memoryState.entries.length - 20} more`, vscode.TreeItemCollapsibleState.None, 'more'));
        }
        return items;
    }
    /**
     * Get current memory state
     */
    getMemoryState() {
        return this.memoryState;
    }
    /**
     * Get sync status
     */
    getSyncStatus() {
        return this.syncStatus;
    }
    /**
     * Add a new memory entry
     */
    async addEntry() {
        await vscode.commands.executeCommand('morse.memory.append');
        await this.loadMemory();
    }
    /**
     * Edit memory
     */
    async editMemory() {
        await vscode.commands.executeCommand('morse.memory.edit');
        await this.loadMemory();
    }
    /**
     * Clear all memory
     */
    async clearMemory() {
        await vscode.commands.executeCommand('morse.memory.clear');
        await this.loadMemory();
    }
    /**
     * Search memory
     */
    async searchMemory() {
        await vscode.commands.executeCommand('morse.memory.search');
    }
    /**
     * Toggle between global and project memory
     */
    toggleGlobal() {
        this.memoryClient.setGlobalMemory(!this.memoryClient.getIsGlobal());
        this.loadMemory();
    }
    /**
     * Sync with CLI
     */
    async syncWithCLI() {
        await vscode.commands.executeCommand('morse.memory.sync');
        await this.loadMemory();
    }
}
exports.MemorySidebarProvider = MemorySidebarProvider;
/**
 * Tree item for memory sidebar
 */
class MemoryTreeItem extends vscode.TreeItem {
    label;
    collapsibleState;
    contextValue;
    command;
    entryData;
    constructor(label, collapsibleState, contextValue, command) {
        super(label, collapsibleState);
        this.label = label;
        this.collapsibleState = collapsibleState;
        this.contextValue = contextValue;
        this.command = command;
        this.tooltip = this.label;
        // Set icon based on type
        switch (contextValue) {
            case 'section':
                this.iconPath = new vscode.ThemeIcon('folder');
                break;
            case 'section-entries':
                this.iconPath = new vscode.ThemeIcon('clippy');
                break;
            case 'action-add':
                this.iconPath = new vscode.ThemeIcon('add');
                break;
            case 'action-edit':
                this.iconPath = new vscode.ThemeIcon('edit');
                break;
            case 'action-search':
                this.iconPath = new vscode.ThemeIcon('search');
                break;
            case 'action-open':
                this.iconPath = new vscode.ThemeIcon('window');
                break;
            case 'action-sync':
                this.iconPath = new vscode.ThemeIcon('sync');
                break;
            case 'action-clear':
                this.iconPath = new vscode.ThemeIcon('trash');
                break;
            case 'entry':
                this.iconPath = new vscode.ThemeIcon('note');
                break;
            case 'sync-status':
                this.iconPath = new vscode.ThemeIcon('sync');
                break;
            case 'memory-mode':
                this.iconPath = new vscode.ThemeIcon('file-submodule');
                break;
            case 'token-usage':
                this.iconPath = new vscode.ThemeIcon('brain');
                break;
            case 'empty':
                this.iconPath = new vscode.ThemeIcon('info');
                break;
            case 'more':
                this.iconPath = new vscode.ThemeIcon('ellipsis');
                break;
        }
    }
}
/**
 * Global singleton instance
 */
let memorySidebarProvider;
/**
 * Get the memory sidebar provider
 */
function getMemorySidebarProvider() {
    if (!memorySidebarProvider) {
        memorySidebarProvider = new MemorySidebarProvider();
    }
    return memorySidebarProvider;
}
/**
 * Register the memory sidebar view
 */
function registerMemorySidebar(context) {
    // Create the sidebar provider
    const provider = getMemorySidebarProvider();
    // Register tree data provider
    vscode.window.registerTreeDataProvider('morse.memory', provider);
    // Register additional commands
    context.subscriptions.push(vscode.commands.registerCommand('morse.memory.refresh', async () => {
        await provider.loadMemory();
    }), vscode.commands.registerCommand('morse.memory.add', async () => {
        await provider.addEntry();
    }), vscode.commands.registerCommand('morse.memory.delete', async (entryId) => {
        // For now, just refresh - full delete would require editing the memory file
        await provider.loadMemory();
    }), vscode.commands.registerCommand('morse.memory.setFocus', async () => {
        await vscode.commands.executeCommand('morse.memory.setFocus');
        await provider.loadMemory();
    }));
    // Initial load
    provider.loadMemory();
}
//# sourceMappingURL=MemorySidebarProvider.js.map