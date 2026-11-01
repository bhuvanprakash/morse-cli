"use strict";
/**
 * Quick Open Provider for Morse - provides quick file and command search
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
exports.MorseQuickOpenProvider = void 0;
const vscode = __importStar(require("vscode"));
class MorseQuickOpenProvider {
    client = null;
    recentFiles = [];
    maxRecentFiles = 20;
    constructor(client) {
        this.client = client || null;
    }
    /**
     * Set the Morse client for AI-powered suggestions
     */
    setClient(client) {
        this.client = client;
    }
    /**
     * Register quick open commands
     */
    registerCommands(context) {
        // Quick file search
        context.subscriptions.push(vscode.commands.registerCommand('morse.quickOpen', () => {
            return this.showQuickOpen();
        }));
        // Quick command search
        context.subscriptions.push(vscode.commands.registerCommand('morse.quickCommand', () => {
            return this.showCommandPalette();
        }));
        // Recent files
        context.subscriptions.push(vscode.commands.registerCommand('morse.recentFiles', () => {
            return this.showRecentFiles();
        }));
    }
    /**
     * Show the main quick open picker
     */
    async showQuickOpen() {
        const quickPick = vscode.window.createQuickPick();
        quickPick.placeholder = 'Search files, commands, or symbols...';
        quickPick.matchOnDetail = true;
        quickPick.matchOnDescription = true;
        // Load initial items
        const items = await this.getQuickOpenItems('');
        quickPick.items = items;
        quickPick.activeItems = items.slice(0, 5);
        // Handle search
        quickPick.onDidChangeValue(async (value) => {
            const filteredItems = await this.getQuickOpenItems(value);
            quickPick.items = filteredItems;
        });
        // Handle selection
        quickPick.onDidAccept(async () => {
            const selected = quickPick.selectedItems[0];
            if (selected && selected.action) {
                await selected.action();
            }
            quickPick.hide();
        });
        quickPick.show();
    }
    /**
     * Get quick open items based on search query
     */
    async getQuickOpenItems(query) {
        const items = [];
        if (!query || query.length < 2) {
            // Show recent files when query is empty or too short
            items.push(...this.getRecentFileItems());
            return items;
        }
        // Add file search results
        items.push(...await this.searchFiles(query));
        // Add command search results
        items.push(...this.searchCommands(query));
        // Add symbol search results
        items.push(...await this.searchSymbols(query));
        // Sort by priority
        items.sort((a, b) => b.priority - a.priority);
        // Limit results
        return items.slice(0, 20);
    }
    /**
     * Search for files matching the query
     */
    async searchFiles(query) {
        const items = [];
        try {
            // Use VS Code workspace search
            const files = await vscode.workspace.findFiles(`**/*${query}*`, '**/node_modules/**', 20);
            for (const file of files) {
                const fileName = file.fsPath.split('/').pop() || '';
                if (fileName.toLowerCase().includes(query.toLowerCase())) {
                    items.push({
                        id: `file:${file.fsPath}`,
                        label: fileName,
                        description: this.getRelativePath(file.fsPath),
                        detail: 'File',
                        type: 'file',
                        priority: 10,
                        action: async () => {
                            const doc = await vscode.workspace.openTextDocument(file);
                            await vscode.window.showTextDocument(doc);
                            this.addToRecentFiles(file.fsPath);
                        }
                    });
                }
            }
        }
        catch (error) {
            console.log('File search error:', error);
        }
        // Add AI-powered suggestions if client is available
        if (this.client && query.length >= 3) {
            try {
                const aiSuggestions = await this.getAISuggestions(query, 'file');
                items.push(...aiSuggestions);
            }
            catch (error) {
                console.log('AI suggestions not available:', error);
            }
        }
        return items;
    }
    /**
     * Search for commands matching the query
     */
    searchCommands(query) {
        const items = [];
        const lowerQuery = query.toLowerCase();
        // Get all registered commands
        const commands = [
            { id: 'morse.chat', label: 'Morse: Chat', description: 'Open Morse chat panel' },
            { id: 'morse.edit', label: 'Morse: Edit Code', description: 'Edit selected code with AI' },
            { id: 'morse.explain', label: 'Morse: Explain Code', description: 'Explain selected code' },
            { id: 'morse.fix', label: 'Morse: Fix Errors', description: 'Fix errors in selected code' },
            { id: 'morse.test', label: 'Morse: Generate Tests', description: 'Generate tests for selected code' },
            { id: 'morse.commit', label: 'Morse: Generate Commit', description: 'Generate git commit message' },
            { id: 'morse.quickOpen', label: 'Morse: Quick Open', description: 'Quick file and command search' },
            { id: 'workbench.action.quickOpen', label: 'Quick Open', description: 'VS Code quick open' },
            { id: 'workbench.action.files.newFile', label: 'New File', description: 'Create a new file' },
            { id: 'workbench.action.openSettings', label: 'Open Settings', description: 'Open VS Code settings' },
            { id: 'workbench.action.toggleSidebarVisibility', label: 'Toggle Sidebar', description: 'Show or hide sidebar' },
            { id: 'workbench.action.terminal.toggleTerminal', label: 'Toggle Terminal', description: 'Show or hide terminal' },
        ];
        for (const cmd of commands) {
            if (cmd.label.toLowerCase().includes(lowerQuery) ||
                cmd.description.toLowerCase().includes(lowerQuery)) {
                items.push({
                    id: `command:${cmd.id}`,
                    label: cmd.label,
                    description: cmd.description,
                    detail: 'Command',
                    type: 'command',
                    priority: cmd.id.startsWith('morse.') ? 20 : 10,
                    action: async () => {
                        await vscode.commands.executeCommand(cmd.id);
                    }
                });
            }
        }
        return items;
    }
    /**
     * Search for symbols matching the query
     */
    async searchSymbols(query) {
        const items = [];
        try {
            // Search workspace symbols
            const symbols = await vscode.commands.executeCommand('vscode.executeWorkspaceSymbolProvider', query);
            if (symbols) {
                for (const symbol of symbols.slice(0, 10)) {
                    const kind = this.getSymbolKindString(symbol.kind);
                    items.push({
                        id: `symbol:${symbol.name}`,
                        label: symbol.name,
                        description: `${kind} in ${symbol.containerName || 'root'}`,
                        detail: symbol.location.uri.fsPath,
                        type: 'symbol',
                        priority: 15,
                        action: async () => {
                            const doc = await vscode.workspace.openTextDocument(symbol.location.uri);
                            const editor = await vscode.window.showTextDocument(doc);
                            const range = symbol.location.range;
                            editor.selection = new vscode.Selection(range.start, range.end);
                            editor.revealRange(range);
                        }
                    });
                }
            }
        }
        catch (error) {
            console.log('Symbol search error:', error);
        }
        return items;
    }
    /**
     * Get AI-powered suggestions for quick open
     */
    async getAISuggestions(query, type) {
        if (!this.client)
            return [];
        // This would integrate with the Morse client for AI suggestions
        // For now, return empty array - actual implementation would call the client
        return [];
    }
    /**
     * Show command palette with Morse commands
     */
    async showCommandPalette() {
        await vscode.commands.executeCommand('workbench.action.quickCommand');
    }
    /**
     * Show recent files
     */
    async showRecentFiles() {
        const quickPick = vscode.window.createQuickPick();
        quickPick.placeholder = 'Recent files...';
        quickPick.items = this.getRecentFileItems();
        quickPick.onDidAccept(async () => {
            const selected = quickPick.selectedItems[0];
            if (selected && selected.action) {
                await selected.action();
            }
            quickPick.hide();
        });
        quickPick.show();
    }
    /**
     * Get recent file items
     */
    getRecentFileItems() {
        return this.recentFiles.slice(0, 10).map((filePath, index) => {
            const fileName = filePath.split('/').pop() || '';
            return {
                id: `recent:${filePath}`,
                label: fileName,
                description: this.getRelativePath(filePath),
                detail: `Recent file #${index + 1}`,
                type: 'recent',
                priority: 30 - index,
                action: async () => {
                    try {
                        const doc = await vscode.workspace.openTextDocument(filePath);
                        await vscode.window.showTextDocument(doc);
                    }
                    catch (error) {
                        vscode.window.showErrorMessage(`Could not open file: ${filePath}`);
                        this.removeFromRecentFiles(filePath);
                    }
                }
            };
        });
    }
    /**
     * Add a file to recent files list
     */
    addToRecentFiles(filePath) {
        // Remove if already exists
        this.recentFiles = this.recentFiles.filter(f => f !== filePath);
        // Add to front
        this.recentFiles.unshift(filePath);
        // Trim to max size
        if (this.recentFiles.length > this.maxRecentFiles) {
            this.recentFiles = this.recentFiles.slice(0, this.maxRecentFiles);
        }
    }
    /**
     * Remove a file from recent files
     */
    removeFromRecentFiles(filePath) {
        this.recentFiles = this.recentFiles.filter(f => f !== filePath);
    }
    /**
     * Get relative path from workspace
     */
    getRelativePath(filePath) {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return filePath;
        }
        const workspacePath = workspaceFolders[0].uri.fsPath;
        if (filePath.startsWith(workspacePath)) {
            return filePath.slice(workspacePath.length + 1);
        }
        return filePath;
    }
    /**
     * Get symbol kind as string
     */
    getSymbolKindString(kind) {
        const kindMap = {
            [vscode.SymbolKind.File]: 'File',
            [vscode.SymbolKind.Module]: 'Module',
            [vscode.SymbolKind.Namespace]: 'Namespace',
            [vscode.SymbolKind.Package]: 'Package',
            [vscode.SymbolKind.Class]: 'Class',
            [vscode.SymbolKind.Method]: 'Method',
            [vscode.SymbolKind.Property]: 'Property',
            [vscode.SymbolKind.Field]: 'Field',
            [vscode.SymbolKind.Constructor]: 'Constructor',
            [vscode.SymbolKind.Enum]: 'Enum',
            [vscode.SymbolKind.Interface]: 'Interface',
            [vscode.SymbolKind.Function]: 'Function',
            [vscode.SymbolKind.Variable]: 'Variable',
            [vscode.SymbolKind.Constant]: 'Constant',
            [vscode.SymbolKind.String]: 'String',
            [vscode.SymbolKind.Number]: 'Number',
            [vscode.SymbolKind.Boolean]: 'Boolean',
            [vscode.SymbolKind.Array]: 'Array',
            [vscode.SymbolKind.Object]: 'Object',
            [vscode.SymbolKind.Key]: 'Key',
            [vscode.SymbolKind.Null]: 'Null',
            [vscode.SymbolKind.EnumMember]: 'Enum Member',
            [vscode.SymbolKind.Struct]: 'Struct',
            [vscode.SymbolKind.Event]: 'Event',
            [vscode.SymbolKind.Operator]: 'Operator',
            [vscode.SymbolKind.TypeParameter]: 'Type Parameter',
        };
        return kindMap[kind] || 'Symbol';
    }
}
exports.MorseQuickOpenProvider = MorseQuickOpenProvider;
//# sourceMappingURL=MorseQuickOpenProvider.js.map