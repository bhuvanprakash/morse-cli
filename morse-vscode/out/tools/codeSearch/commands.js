"use strict";
/**
 * Code Search Commands
 * VS Code commands for search operations
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
exports.SearchCommands = void 0;
exports.createSearchCommands = createSearchCommands;
exports.registerSearchCommands = registerSearchCommands;
const vscode = __importStar(require("vscode"));
const service_1 = require("./service");
const panel_1 = require("./panel");
/**
 * Search command handlers
 */
class SearchCommands {
    context;
    client;
    searchService;
    searchPanel = null;
    searchConfig;
    constructor(context, client, config) {
        this.context = context;
        this.client = client;
        this.searchConfig = {
            maxResults: 10,
            fileTypes: ['.ts', '.tsx', '.js', '.jsx', '.go', '.py', '.java', '.rs'],
            languages: [],
            algorithm: 'bm25',
            includeExternal: false,
            includeTests: true,
            excludePatterns: ['node_modules', '.git', 'dist', 'build', 'coverage'],
            caseSensitive: false,
            useRegex: false,
            ...config,
        };
        this.searchService = (0, service_1.createSearchService)(client, this.searchConfig);
    }
    /**
     * Initialize search commands
     */
    async initialize() {
        await this.searchService.initialize();
    }
    /**
     * Register all search commands
     */
    register() {
        // Open search panel
        this.context.subscriptions.push(vscode.commands.registerCommand('morse.search.open', async () => {
            await this.openSearchPanel();
        }));
        // Quick search from command palette
        this.context.subscriptions.push(vscode.commands.registerCommand('morse.search.quick', async () => {
            await this.quickSearch();
        }));
        // Search with query
        this.context.subscriptions.push(vscode.commands.registerCommand('morse.search.execute', async (query) => {
            await this.executeSearch(query);
        }));
        // Build search index
        this.context.subscriptions.push(vscode.commands.registerCommand('morse.search.buildIndex', async () => {
            await this.buildIndex();
        }));
        // Search in selection
        this.context.subscriptions.push(vscode.commands.registerCommand('morse.search.inSelection', async () => {
            await this.searchInSelection();
        }));
        // Search from clipboard
        this.context.subscriptions.push(vscode.commands.registerCommand('morse.search.fromClipboard', async () => {
            await this.searchFromClipboard();
        }));
        // Get search history
        this.context.subscriptions.push(vscode.commands.registerCommand('morse.search.history', async () => {
            await this.showHistory();
        }));
        // Clear search history
        this.context.subscriptions.push(vscode.commands.registerCommand('morse.search.clearHistory', async () => {
            await this.clearHistory();
        }));
        // Get index status
        this.context.subscriptions.push(vscode.commands.registerCommand('morse.search.indexStatus', async () => {
            await this.showIndexStatus();
        }));
    }
    /**
     * Open search panel
     */
    async openSearchPanel() {
        if (!this.searchPanel) {
            this.searchPanel = (0, panel_1.createSearchPanel)(this.context.extensionUri, this.searchService);
        }
        this.searchPanel.show();
    }
    /**
     * Quick search with input box
     */
    async quickSearch() {
        const query = await vscode.window.showInputBox({
            prompt: 'Enter search query',
            placeHolder: 'e.g., handleRequest, User struct, connection refused',
        });
        if (!query) {
            return;
        }
        await this.executeSearch(query);
    }
    /**
     * Execute a search
     */
    async executeSearch(query) {
        if (!query) {
            query = await vscode.window.showInputBox({
                prompt: 'Enter search query',
                placeHolder: 'e.g., handleRequest, User struct, connection refused',
            });
        }
        if (!query) {
            return;
        }
        try {
            const result = await this.searchService.search({
                query,
                limit: this.searchConfig.maxResults,
                fileTypes: this.searchConfig.fileTypes,
                languages: this.searchConfig.languages,
            });
            if (result.success && result.results && result.results.length > 0) {
                // Show results in a quick pick
                const items = result.results.map(r => ({
                    label: this.getResultLabel(r),
                    description: `Lines ${r.startLine}-${r.endLine}`,
                    result: r,
                }));
                const selected = await vscode.window.showQuickPick(items, {
                    placeHolder: `Found ${result.results.length} matches`,
                    matchOnDescription: true,
                });
                if (selected) {
                    await this.searchService.navigateToResult(selected.result);
                }
                // Optionally open panel for full results
                const openPanel = await vscode.window.showInformationMessage(`Found ${result.results.length} results`, 'Open Search Panel', 'Dismiss');
                if (openPanel === 'Open Search Panel') {
                    await this.openSearchPanel();
                }
            }
            else if (result.success) {
                vscode.window.showInformationMessage(`No results found for "${query}"`);
            }
            else {
                vscode.window.showErrorMessage(`Search failed: ${result.error}`);
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Search error: ${error}`);
        }
    }
    /**
     * Build search index for current workspace
     */
    async buildIndex() {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showWarningMessage('No workspace folder found');
            return;
        }
        try {
            const result = await this.searchService.buildIndex({
                projectRoot: workspaceFolder.uri.fsPath,
            });
            if (result.success) {
                const indexInfo = result.indexInfo;
                vscode.window.showInformationMessage(`Index built: ${indexInfo?.fileCount || 0} files indexed`);
            }
            else {
                vscode.window.showErrorMessage(`Index build failed: ${result.error}`);
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Index build error: ${error}`);
        }
    }
    /**
     * Search within current selection
     */
    async searchInSelection() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('No active editor');
            return;
        }
        const selection = editor.selection;
        if (selection.isEmpty) {
            vscode.window.showWarningMessage('No text selected');
            return;
        }
        const selectedText = editor.document.getText(selection);
        const query = selectedText.trim();
        if (!query) {
            vscode.window.showWarningMessage('Empty selection');
            return;
        }
        await this.executeSearch(query);
    }
    /**
     * Search from clipboard content
     */
    async searchFromClipboard() {
        const clipboardText = await vscode.env.clipboard.readText();
        if (!clipboardText || !clipboardText.trim()) {
            vscode.window.showWarningMessage('Clipboard is empty');
            return;
        }
        const query = clipboardText.trim();
        const proceed = await vscode.window.showInformationMessage(`Search for: "${query.substring(0, 50)}${query.length > 50 ? '...' : ''}"?`, 'Search', 'Cancel');
        if (proceed === 'Search') {
            await this.executeSearch(query);
        }
    }
    /**
     * Show search history
     */
    async showHistory() {
        const history = this.searchService.getHistory();
        if (history.length === 0) {
            vscode.window.showInformationMessage('No search history');
            return;
        }
        const items = history.map(entry => ({
            label: entry.query,
            description: `${entry.resultCount} results - ${entry.timestamp.toLocaleString()}`,
            query: entry.query,
        }));
        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select a previous search',
        });
        if (selected) {
            await this.executeSearch(selected.query);
        }
    }
    /**
     * Clear search history
     */
    async clearHistory() {
        const proceed = await vscode.window.showWarningMessage('Clear all search history?', { modal: true }, 'Clear', 'Cancel');
        if (proceed === 'Clear') {
            this.searchService.clearHistory();
            vscode.window.showInformationMessage('Search history cleared');
        }
    }
    /**
     * Show index status
     */
    async showIndexStatus() {
        const indexInfo = this.searchService.getIndexInfo();
        const statusMessages = {
            notBuilt: 'Index not built',
            building: 'Index is being built...',
            ready: 'Index is ready',
            error: `Index error: ${indexInfo.error || 'unknown'}`,
        };
        const message = [
            `**Search Index Status**`,
            ``,
            `Status: ${statusMessages[indexInfo.status] || indexInfo.status}`,
            `Files indexed: ${indexInfo.fileCount}`,
            `Tokens: ${indexInfo.tokenCount}`,
            indexInfo.lastBuiltAt ? `Last built: ${indexInfo.lastBuiltAt.toLocaleString()}` : '',
        ].filter(Boolean).join('\n');
        // Show in output channel
        const output = vscode.window.createOutputChannel('Code Search Status');
        output.appendLine(message);
        output.show();
    }
    /**
     * Get label for a search result
     */
    getResultLabel(result) {
        const fileName = result.filePath.split(/[/\\]/).pop() || result.filePath;
        return `${fileName}`;
    }
    /**
     * Get search service
     */
    getService() {
        return this.searchService;
    }
    /**
     * Dispose
     */
    dispose() {
        this.searchService.dispose();
        if (this.searchPanel) {
            this.searchPanel.dispose();
        }
    }
}
exports.SearchCommands = SearchCommands;
/**
 * Create search commands instance
 */
function createSearchCommands(context, client, config) {
    return new SearchCommands(context, client, config);
}
/**
 * Register search commands
 */
function registerSearchCommands(context, client) {
    const commands = createSearchCommands(context, client);
    commands.register();
    return commands;
}
//# sourceMappingURL=commands.js.map