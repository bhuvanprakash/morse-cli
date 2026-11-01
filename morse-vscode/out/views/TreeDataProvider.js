"use strict";
/**
 * Morse Tree Data Provider
 * Provides tree views for:
 * - Files tree: Browse project files
 * - AI suggestions tree: View AI-generated suggestions
 * - Session tree: Manage chat sessions
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
exports.ToolTreeDataProvider = exports.SessionTreeDataProvider = exports.SuggestionsTreeDataProvider = exports.FilesTreeDataProvider = exports.MorseTreeItem = void 0;
exports.registerTreeViews = registerTreeViews;
const vscode = __importStar(require("vscode"));
/**
 * Base tree item for Morse views
 */
class MorseTreeItem extends vscode.TreeItem {
    type;
    children;
    metadata;
    constructor(label, type, collapsibleState = vscode.TreeItemCollapsibleState.None, metadata) {
        super(label, collapsibleState);
        this.type = type;
        this.metadata = metadata;
        // Set icons based on type
        this.setIcon();
    }
    setIcon() {
        switch (this.type) {
            case 'file':
                this.iconPath = new vscode.ThemeIcon('file-code');
                break;
            case 'folder':
                this.iconPath = new vscode.ThemeIcon('folder');
                break;
            case 'suggestion':
                this.iconPath = new vscode.ThemeIcon('lightbulb');
                break;
            case 'session':
                this.iconPath = new vscode.ThemeIcon('comment');
                break;
            case 'action':
                this.iconPath = new vscode.ThemeIcon('play');
                break;
            case 'provider':
                this.iconPath = new vscode.ThemeIcon('cloud');
                break;
            case 'tool':
                this.iconPath = new vscode.ThemeIcon('wrench');
                break;
            default:
                this.iconPath = new vscode.ThemeIcon('symbol-property');
        }
    }
}
exports.MorseTreeItem = MorseTreeItem;
/**
 * Files Tree Data Provider
 * Displays project files in a tree view
 */
class FilesTreeDataProvider {
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    rootPath;
    excludePatterns = [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**',
        '**/*.log',
        '**/.DS_Store',
    ];
    constructor() {
        // Get the workspace root path
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            this.rootPath = workspaceFolders[0].uri.fsPath;
        }
    }
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return element;
    }
    async getChildren(element) {
        if (!this.rootPath) {
            const openChat = new MorseTreeItem('Open Chat', 'action', vscode.TreeItemCollapsibleState.None);
            openChat.iconPath = new vscode.ThemeIcon('comment');
            openChat.command = { command: 'morse.chat', title: 'Open Chat' };
            return [openChat, new MorseTreeItem('No workspace open', 'file')];
        }
        const basePath = element?.metadata?.path || this.rootPath;
        try {
            const files = await vscode.workspace.findFiles(new vscode.RelativePattern(basePath, '**/*'), this.getExcludePattern(), 100);
            // Group files by directory
            const dirMap = new Map();
            for (const file of files) {
                const relativePath = vscode.workspace.asRelativePath(file, false);
                const parts = relativePath.split('/');
                if (parts.length === 1) {
                    // Root level file
                    const item = new MorseTreeItem(file.fsPath.split('/').pop() || 'file', 'file', vscode.TreeItemCollapsibleState.None, { path: file.fsPath });
                    item.command = {
                        command: 'vscode.open',
                        arguments: [file],
                        title: 'Open File',
                    };
                    if (!dirMap.has('')) {
                        dirMap.set('', []);
                    }
                    dirMap.get('')?.push(item);
                }
                else {
                    // File in subdirectory
                    const folder = parts.slice(0, -1).join('/');
                    if (!dirMap.has(folder)) {
                        dirMap.set(folder, []);
                    }
                    const item = new MorseTreeItem(parts[parts.length - 1], 'file', vscode.TreeItemCollapsibleState.None, { path: file.fsPath });
                    item.command = {
                        command: 'vscode.open',
                        arguments: [file],
                        title: 'Open File',
                    };
                    dirMap.get(folder)?.push(item);
                }
            }
            // If we have an element, return its children
            if (element) {
                const elementPath = element.metadata?.path;
                const children = dirMap.get(vscode.workspace.asRelativePath(vscode.Uri.file(elementPath), false));
                return children || [];
            }
            // Return root items: Open Chat first (like Cline/Kilo), then folders and files
            const rootItems = [];
            const openChat = new MorseTreeItem('Open Chat', 'action', vscode.TreeItemCollapsibleState.None);
            openChat.iconPath = new vscode.ThemeIcon('comment');
            openChat.command = { command: 'morse.chat', title: 'Open Chat' };
            openChat.description = 'Start a conversation';
            rootItems.push(openChat);
            // Get immediate subdirectories
            const dirs = new Set();
            for (const [path] of dirMap) {
                if (path) {
                    const firstDir = path.split('/')[0];
                    dirs.add(firstDir);
                }
            }
            for (const dir of dirs) {
                rootItems.push(new MorseTreeItem(dir, 'folder', vscode.TreeItemCollapsibleState.Collapsed, { path: `${this.rootPath}/${dir}` }));
            }
            // Add root level files
            const rootFiles = dirMap.get('') || [];
            rootItems.push(...rootFiles);
            return rootItems.length > 0 ? rootItems : [new MorseTreeItem('No files found', 'file')];
        }
        catch (error) {
            console.error('Error loading files:', error);
            return [new MorseTreeItem('Error loading files', 'file')];
        }
    }
    getExcludePattern() {
        return this.excludePatterns.join('|') || '**/*';
    }
}
exports.FilesTreeDataProvider = FilesTreeDataProvider;
/**
 * AI Suggestions Tree Data Provider
 * Displays AI-generated suggestions
 */
class SuggestionsTreeDataProvider {
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    client;
    suggestions = [];
    contextInfo = null;
    constructor(client) {
        this.client = client;
        this.refresh();
    }
    async refresh() {
        try {
            this.contextInfo = await this.client.getSessionContext();
            this.suggestions = this.contextInfo.suggestions || [];
        }
        catch {
            this.suggestions = [];
            this.contextInfo = null;
        }
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return element;
    }
    async getChildren(element) {
        if (!element) {
            // Root level - Open Chat first (like Cline/Kilo), then suggestion categories
            const openChat = new MorseTreeItem('Open Chat', 'action', vscode.TreeItemCollapsibleState.None);
            openChat.iconPath = new vscode.ThemeIcon('comment');
            openChat.command = { command: 'morse.chat', title: 'Open Chat' };
            openChat.description = 'Talk to Morse';
            openChat.tooltip = new vscode.MarkdownString('Open the chat panel to get AI suggestions.');
            const categories = [
                { id: 'code', label: 'Code Suggestions', icon: 'code' },
                { id: 'refactor', label: 'Refactoring', icon: 'repo-forked' },
                { id: 'test', label: 'Test Suggestions', icon: 'beaker' },
                { id: 'docs', label: 'Documentation', icon: 'book' },
            ];
            const categoryItems = categories.map(cat => new MorseTreeItem(cat.label, 'folder', vscode.TreeItemCollapsibleState.Collapsed, { category: cat.id }));
            return [openChat, ...categoryItems];
        }
        if (element.type === 'folder') {
            const category = element.metadata?.category;
            const categorySuggestions = this.suggestions.filter(s => s.category === category);
            return categorySuggestions.map(suggestion => {
                const item = new MorseTreeItem(suggestion.title ?? suggestion.id ?? 'Suggestion', 'suggestion', vscode.TreeItemCollapsibleState.None, { suggestion });
                item.command = {
                    command: 'morse.applySuggestion',
                    arguments: [suggestion],
                    title: 'Apply Suggestion',
                };
                item.description = suggestion.description ?? undefined;
                return item;
            });
        }
        return [];
    }
}
exports.SuggestionsTreeDataProvider = SuggestionsTreeDataProvider;
/**
 * Session Tree Data Provider
 * Displays chat sessions
 */
class SessionTreeDataProvider {
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    client;
    sessions = [];
    constructor(client) {
        this.client = client;
        this.refresh();
    }
    async refresh() {
        try {
            this.sessions = await this.client.getSessions();
        }
        catch {
            this.sessions = [];
        }
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return element;
    }
    async getChildren(element) {
        if (!element) {
            // Root level - always show "Open Chat" first (like Cline/Kilo), then sessions
            const openChat = new MorseTreeItem('Open Chat', 'action', vscode.TreeItemCollapsibleState.None);
            openChat.iconPath = new vscode.ThemeIcon('comment');
            openChat.command = { command: 'morse.chat', title: 'Open Chat' };
            openChat.description = 'Start a conversation';
            openChat.tooltip = new vscode.MarkdownString('**Open Chat**  \nOpen the Morse chat panel to talk to the AI (like Cline or Kilo).');
            if (this.sessions.length === 0) {
                const noSessions = new MorseTreeItem('No sessions yet', 'session');
                noSessions.tooltip = 'Start a conversation above to create a session';
                return [openChat, noSessions];
            }
            const sessionItems = this.sessions.map(session => {
                const item = new MorseTreeItem(session.title || 'Untitled Session', 'session', vscode.TreeItemCollapsibleState.None, { session });
                item.description = `${session.messages?.length || 0} messages`;
                item.command = {
                    command: 'morse.sessions.open',
                    arguments: [session.id],
                    title: 'Open Session',
                };
                // Set icon based on session status
                if (session.id === this.client.getCurrentSession?.()) {
                    item.iconPath = new vscode.ThemeIcon('pass');
                }
                return item;
            });
            return [openChat, ...sessionItems];
        }
        return [];
    }
}
exports.SessionTreeDataProvider = SessionTreeDataProvider;
/**
 * Tool Tree Data Provider
 * Displays available tools
 */
class ToolTreeDataProvider {
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    client;
    tools = [];
    constructor(client) {
        this.client = client;
        this.refresh();
    }
    async refresh() {
        try {
            this.tools = await this.client.getToolStatus();
        }
        catch {
            this.tools = [];
        }
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return element;
    }
    async getChildren(element) {
        if (!element) {
            // Root level - show tool categories
            const enabledTools = this.tools.filter(t => t.enabled);
            const disabledTools = this.tools.filter(t => !t.enabled);
            const items = [];
            if (enabledTools.length > 0) {
                const enabledItem = new MorseTreeItem(`Enabled (${enabledTools.length})`, 'folder', vscode.TreeItemCollapsibleState.Expanded, { category: 'enabled' });
                enabledItem.iconPath = new vscode.ThemeIcon('check');
                items.push(enabledItem);
            }
            if (disabledTools.length > 0) {
                const disabledItem = new MorseTreeItem(`Disabled (${disabledTools.length})`, 'folder', vscode.TreeItemCollapsibleState.Collapsed, { category: 'disabled' });
                disabledItem.iconPath = new vscode.ThemeIcon('x');
                items.push(disabledItem);
            }
            if (items.length > 0)
                return items;
            // When no tools (e.g. morse serve not running), show Open Chat so user can still use the extension
            const openChat = new MorseTreeItem('Open Chat', 'action', vscode.TreeItemCollapsibleState.None);
            openChat.iconPath = new vscode.ThemeIcon('comment');
            openChat.command = { command: 'morse.chat', title: 'Open Chat' };
            openChat.description = 'Start chat (run "morse serve" in terminal)';
            openChat.tooltip = new vscode.MarkdownString('**Open Chat**  \nStart the chat panel. Run `morse serve` in a terminal to enable tools.');
            const noTools = new MorseTreeItem('No tools available', 'tool');
            noTools.description = 'Start morse serve to see tools';
            noTools.tooltip = 'Start morse serve in a terminal to list available tools';
            return [openChat, noTools];
        }
        const category = element.metadata?.category;
        const categoryTools = category === 'enabled'
            ? this.tools.filter(t => t.enabled)
            : this.tools.filter(t => !t.enabled);
        return categoryTools.map(tool => {
            const item = new MorseTreeItem(tool.name, 'tool', vscode.TreeItemCollapsibleState.None, { tool });
            item.description = tool.description?.substring(0, 50) || '';
            item.command = {
                command: 'morse.tools.toggle',
                arguments: [tool.name],
                title: tool.enabled ? 'Disable Tool' : 'Enable Tool',
            };
            return item;
        });
    }
}
exports.ToolTreeDataProvider = ToolTreeDataProvider;
/**
 * Register all tree views
 */
function registerTreeViews(context, client) {
    // Files tree view
    const filesProvider = new FilesTreeDataProvider();
    context.subscriptions.push(vscode.window.registerTreeDataProvider('morse.files', filesProvider));
    // Suggestions tree view
    const suggestionsProvider = new SuggestionsTreeDataProvider(client);
    context.subscriptions.push(vscode.window.registerTreeDataProvider('morse.suggestions', suggestionsProvider));
    // Sessions tree view (and morse.history from package.json)
    const sessionsProvider = new SessionTreeDataProvider(client);
    context.subscriptions.push(vscode.window.registerTreeDataProvider('morse.sessions', sessionsProvider));
    context.subscriptions.push(vscode.window.registerTreeDataProvider('morse.history', sessionsProvider));
    // Tools tree view
    const toolsProvider = new ToolTreeDataProvider(client);
    context.subscriptions.push(vscode.window.registerTreeDataProvider('morse.tools', toolsProvider));
    // Register refresh commands
    context.subscriptions.push(vscode.commands.registerCommand('morse.files.refresh', () => {
        filesProvider.refresh();
    }));
    context.subscriptions.push(vscode.commands.registerCommand('morse.suggestions.refresh', async () => {
        await suggestionsProvider.refresh();
    }));
    context.subscriptions.push(vscode.commands.registerCommand('morse.sessions.refresh', async () => {
        await sessionsProvider.refresh();
    }));
    context.subscriptions.push(vscode.commands.registerCommand('morse.tools.refresh', async () => {
        await toolsProvider.refresh();
    }));
    console.log('[Morse] Tree views registered');
}
//# sourceMappingURL=TreeDataProvider.js.map