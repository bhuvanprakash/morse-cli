"use strict";
/**
 * RAG Sidebar Provider for Morse VS Code Extension
 * Tree view showing RAG knowledge bases, indexed files, and quick search
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
exports.RAGSidebarProvider = exports.RAGTreeItem = void 0;
exports.getRAGSidebarProvider = getRAGSidebarProvider;
const vscode = __importStar(require("vscode"));
const client_1 = require("../../rag/client");
/**
 * Tree item for RAG sidebar
 */
class RAGTreeItem extends vscode.TreeItem {
    label;
    collapsibleState;
    contextValue;
    command;
    iconPath;
    constructor(label, collapsibleState, contextValue, command, iconPath) {
        super(label, collapsibleState);
        this.label = label;
        this.collapsibleState = collapsibleState;
        this.contextValue = contextValue;
        this.command = command;
        this.iconPath = iconPath;
        this.contextValue = contextValue;
        if (command) {
            this.command = command;
        }
        if (iconPath) {
            this.iconPath = iconPath;
        }
    }
}
exports.RAGTreeItem = RAGTreeItem;
/**
 * Sidebar provider for RAG tree view
 */
class RAGSidebarProvider {
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    ragClient;
    ragStatus = null;
    indexedFiles = [];
    isLoading = false;
    searchQuery = '';
    constructor() {
        this.ragClient = (0, client_1.getRAGClient)();
        this.refresh();
    }
    /**
     * Refresh the RAG tree view
     */
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    /**
     * Load RAG status and files
     */
    async loadRAG() {
        if (this.isLoading) {
            return;
        }
        this.isLoading = true;
        try {
            this.ragStatus = await this.ragClient.status();
            this.indexedFiles = await this.ragClient.files();
            this.refresh();
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to load RAG: ${error}`);
        }
        finally {
            this.isLoading = false;
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
        if (element.contextValue === 'status') {
            return this.getStatusItems();
        }
        if (element.contextValue === 'files') {
            return this.getFileItems();
        }
        if (element.contextValue === 'actions') {
            return this.getActionItems();
        }
        return [];
    }
    /**
     * Get root tree items
     */
    async getRootItems() {
        // Ensure RAG status is loaded
        if (!this.ragStatus) {
            await this.loadRAG();
        }
        const items = [];
        // Status section
        const statusIcon = this.getStatusIcon();
        items.push(new RAGTreeItem(`Status: ${this.ragStatus?.status || 'loading...'}`, vscode.TreeItemCollapsibleState.Expanded, 'status', undefined, statusIcon));
        // Files section
        const fileCount = this.indexedFiles.length;
        items.push(new RAGTreeItem(`Indexed Files (${fileCount})`, fileCount > 0 ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None, 'files'));
        // Actions section
        items.push(new RAGTreeItem('Actions', vscode.TreeItemCollapsibleState.Expanded, 'actions'));
        return items;
    }
    /**
     * Get status detail items
     */
    getStatusItems() {
        if (!this.ragStatus) {
            return [];
        }
        const items = [];
        items.push(new RAGTreeItem(`Files: ${this.ragStatus.fileCount}`, vscode.TreeItemCollapsibleState.None, 'status-detail'));
        items.push(new RAGTreeItem(`Chunks: ${this.ragStatus.chunkCount}`, vscode.TreeItemCollapsibleState.None, 'status-detail'));
        items.push(new RAGTreeItem(`Size: ${this.ragStatus.indexSize}`, vscode.TreeItemCollapsibleState.None, 'status-detail'));
        items.push(new RAGTreeItem(`Last Updated: ${this.ragStatus.lastUpdated}`, vscode.TreeItemCollapsibleState.None, 'status-detail'));
        items.push(new RAGTreeItem(`Embedder: ${this.ragStatus.embedder}`, vscode.TreeItemCollapsibleState.None, 'status-detail'));
        return items;
    }
    /**
     * Get file items
     */
    getFileItems() {
        return this.indexedFiles.map(file => {
            return new RAGTreeItem(file.path, vscode.TreeItemCollapsibleState.None, 'file', {
                command: 'vscode.open',
                title: 'Open File',
                arguments: [vscode.Uri.file(file.path)]
            }, new vscode.ThemeIcon('file-text'));
        });
    }
    /**
     * Get action items
     */
    getActionItems() {
        const items = [];
        items.push(new RAGTreeItem('Initialize RAG', vscode.TreeItemCollapsibleState.None, 'action-init', {
            command: 'morse.rag.init',
            title: 'Initialize RAG'
        }, new vscode.ThemeIcon('play')));
        items.push(new RAGTreeItem('Refresh Index', vscode.TreeItemCollapsibleState.None, 'action-refresh', {
            command: 'morse.rag.refresh',
            title: 'Refresh RAG Index'
        }, new vscode.ThemeIcon('refresh')));
        items.push(new RAGTreeItem('Search', vscode.TreeItemCollapsibleState.None, 'action-search', {
            command: 'morse.rag.search',
            title: 'Search RAG'
        }, new vscode.ThemeIcon('search')));
        items.push(new RAGTreeItem('View Files', vscode.TreeItemCollapsibleState.None, 'action-files', {
            command: 'morse.rag.files',
            title: 'View Indexed Files'
        }, new vscode.ThemeIcon('list-flat')));
        items.push(new RAGTreeItem('Clear Index', vscode.TreeItemCollapsibleState.None, 'action-clear', {
            command: 'morse.rag.clear',
            title: 'Clear RAG Index'
        }, new vscode.ThemeIcon('trash')));
        return items;
    }
    /**
     * Get status icon based on RAG status
     */
    getStatusIcon() {
        if (!this.ragStatus) {
            return new vscode.ThemeIcon('loading~spin');
        }
        switch (this.ragStatus.status) {
            case 'active':
                return new vscode.ThemeIcon('check');
            case 'stale':
                return new vscode.ThemeIcon('warning');
            default:
                return new vscode.ThemeIcon('circle-slash');
        }
    }
    /**
     * Initialize RAG index
     */
    async init() {
        try {
            await vscode.commands.executeCommand('morse.rag.init');
            await this.loadRAG();
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to initialize RAG: ${error}`);
        }
    }
    /**
     * Refresh RAG index
     */
    async refreshIndex() {
        try {
            await vscode.commands.executeCommand('morse.rag.refresh');
            await this.loadRAG();
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to refresh RAG: ${error}`);
        }
    }
    /**
     * Search RAG index
     */
    async search(query) {
        const searchQuery = query || await vscode.window.showInputBox({
            prompt: 'Search RAG index',
            placeHolder: 'Enter search query...',
        });
        if (!searchQuery || !searchQuery.trim()) {
            return;
        }
        this.searchQuery = searchQuery;
        try {
            await vscode.commands.executeCommand('morse.rag.search');
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to search: ${error}`);
        }
    }
    /**
     * Show RAG panel
     */
    async showPanel() {
        try {
            await vscode.commands.executeCommand('morse.rag.show');
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to show RAG panel: ${error}`);
        }
    }
    /**
     * Get current search query
     */
    getSearchQuery() {
        return this.searchQuery;
    }
}
exports.RAGSidebarProvider = RAGSidebarProvider;
// Singleton instance
let ragSidebarProviderInstance = null;
/**
 * Get the RAG sidebar provider singleton
 */
function getRAGSidebarProvider() {
    if (!ragSidebarProviderInstance) {
        ragSidebarProviderInstance = new RAGSidebarProvider();
    }
    return ragSidebarProviderInstance;
}
//# sourceMappingURL=RAGSidebarProvider.js.map