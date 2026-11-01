"use strict";
/**
 * Sessions Panel for Morse VS Code Extension
 * Provides a tree view for session management with create/delete/view functionality
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
exports.SessionsPanel = void 0;
exports.registerSessionsView = registerSessionsView;
const vscode = __importStar(require("vscode"));
class SessionsPanel {
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    client;
    sessions = [];
    constructor(client) {
        this.client = client;
        this.refresh();
    }
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    async loadSessions() {
        try {
            this.sessions = await this.client.getSessions();
            this.refresh();
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to load sessions: ${error}`);
        }
    }
    getTreeItem(element) {
        return element;
    }
    getChildren(element) {
        if (!element) {
            return this.getRootItems();
        }
        return [];
    }
    async getRootItems() {
        const items = [];
        // Create new session button
        items.push(new SessionTreeItem('$(plus) New Session', vscode.TreeItemCollapsibleState.None, 'new-session', { command: 'morse.newSession', title: 'Create New Session' }));
        // Current session
        const currentSessionId = this.client.getCurrentSession();
        if (currentSessionId) {
            const currentSession = this.sessions.find(s => s.id === currentSessionId);
            if (currentSession) {
                items.push(new SessionTreeItem(`$(play) Current: ${currentSession.title || 'Untitled'}`, vscode.TreeItemCollapsibleState.None, 'current-session', { command: 'morse.chat', title: 'Continue Session' }));
            }
        }
        // Sessions section
        if (this.sessions.length > 0) {
            items.push(new SessionTreeItem('$(history) Sessions', vscode.TreeItemCollapsibleState.Expanded, 'section'));
            // Add each session
            for (const session of this.sessions.slice(0, 20)) {
                const sessionItem = new SessionTreeItem(this.formatSessionLabel(session), vscode.TreeItemCollapsibleState.Collapsed, 'session', { command: 'morse.sessions.view', title: 'View Session', arguments: [session.id] });
                sessionItem.sessionData = session;
                items.push(sessionItem);
            }
            if (this.sessions.length > 20) {
                items.push(new SessionTreeItem(`... and ${this.sessions.length - 20} more`, vscode.TreeItemCollapsibleState.None, 'more'));
            }
        }
        // No sessions message
        if (this.sessions.length === 0) {
            items.push(new SessionTreeItem('No sessions yet', vscode.TreeItemCollapsibleState.None, 'empty'));
        }
        return items;
    }
    formatSessionLabel(session) {
        const date = new Date(session.createdAt);
        const dateStr = date.toLocaleDateString();
        const title = session.title || 'Untitled Session';
        const cost = session.cost ? `$${session.cost.toFixed(4)}` : '';
        const tokens = session.tokenCount ? `${session.tokenCount.toLocaleString()} tokens` : '';
        let label = `$(clock) ${title} - ${dateStr}`;
        if (cost || tokens) {
            label += ` (${[cost, tokens].filter(Boolean).join(', ')})`;
        }
        return label;
    }
    async createSession() {
        try {
            const session = await this.client.createSession();
            vscode.window.showInformationMessage(`Created new session: ${session.id}`);
            await this.loadSessions();
            // Open chat with new session
            vscode.commands.executeCommand('morse.chat');
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to create session: ${error}`);
        }
    }
    async deleteSession(sessionId) {
        const confirmed = await vscode.window.showWarningMessage('Are you sure you want to delete this session? This action cannot be undone.', { modal: true }, 'Delete', 'Cancel');
        if (confirmed === 'Delete') {
            try {
                await this.client.deleteSession(sessionId);
                vscode.window.showInformationMessage('Session deleted');
                await this.loadSessions();
            }
            catch (error) {
                vscode.window.showErrorMessage(`Failed to delete session: ${error}`);
            }
        }
    }
    async viewSessionDetails(sessionId) {
        try {
            const session = await this.client.getSession(sessionId);
            if (!session) {
                vscode.window.showErrorMessage('Session not found');
                return;
            }
            // Show session details in a new panel
            const panel = vscode.window.createWebviewPanel('morse.sessionDetails', `Session: ${session.title || session.id}`, vscode.ViewColumn.One, { enableScripts: true });
            panel.webview.html = this.generateSessionDetailsHtml(session);
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to load session: ${error}`);
        }
    }
    generateSessionDetailsHtml(session) {
        const messages = session.messages || [];
        const createdAt = new Date(session.createdAt).toLocaleString();
        const updatedAt = session.updatedAt ? new Date(session.updatedAt).toLocaleString() : 'N/A';
        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            color: var(--vscode-foreground);
        }
        h1 { font-size: 1.5em; margin-bottom: 10px; }
        .metadata {
            display: grid;
            grid-template-columns: 150px 1fr;
            gap: 8px;
            margin-bottom: 20px;
            padding: 15px;
            background: var(--vscode-editor-background);
            border-radius: 5px;
        }
        .label { font-weight: bold; color: var(--vscode-foreground); }
        .messages { margin-top: 20px; }
        .message {
            padding: 10px;
            margin-bottom: 10px;
            border-radius: 5px;
            background: var(--vscode-editor-background);
        }
        .message-user { border-left: 3px solid var(--vscode-progressBar-background); }
        .message-assistant { border-left: 3px solid var(--vscode-statusBarItem-remoteForeground); }
        .role { font-weight: bold; font-size: 0.9em; margin-bottom: 5px; }
        .content { white-space: pre-wrap; font-family: monospace; }
    </style>
</head>
<body>
    <h1>${session.title || 'Untitled Session'}</h1>
    
    <div class="metadata">
        <span class="label">Session ID:</span>
        <span>${session.id}</span>
        
        <span class="label">Created:</span>
        <span>${createdAt}</span>
        
        <span class="label">Updated:</span>
        <span>${updatedAt}</span>
        
        <span class="label">Model:</span>
        <span>${session.model || 'N/A'}</span>
        
        <span class="label">Provider:</span>
        <span>${session.provider || 'N/A'}</span>
        
        <span class="label">Total Tokens:</span>
        <span>${session.tokenCount?.toLocaleString() || '0'}</span>
        
        <span class="label">Total Cost:</span>
        <span>$${session.cost?.toFixed(4) || '0.0000'}</span>
    </div>
    
    <h2>Messages (${messages.length})</h2>
    <div class="messages">
        ${messages.map((msg) => `
            <div class="message message-${msg.role || 'user'}">
                <div class="role">${msg.role || 'user'}</div>
                <div class="content">${this.escapeHtml(msg.content || '')}</div>
            </div>
        `).join('')}
    </div>
</body>
</html>`;
    }
    escapeHtml(text) {
        return text
            .replace(/&/g, '&')
            .replace(/</g, '<')
            .replace(/>/g, '>')
            .replace(/"/g, '"')
            .replace(/'/g, '&#039;');
    }
}
exports.SessionsPanel = SessionsPanel;
class SessionTreeItem extends vscode.TreeItem {
    label;
    collapsibleState;
    contextValue;
    command;
    sessionData;
    constructor(label, collapsibleState, contextValue, command) {
        super(label, collapsibleState);
        this.label = label;
        this.collapsibleState = collapsibleState;
        this.contextValue = contextValue;
        this.command = command;
        this.tooltip = this.label;
        switch (contextValue) {
            case 'section':
                this.iconPath = new vscode.ThemeIcon('folder');
                break;
            case 'session':
                this.iconPath = new vscode.ThemeIcon('history');
                break;
            case 'new-session':
                this.iconPath = new vscode.ThemeIcon('add');
                break;
            case 'current-session':
                this.iconPath = new vscode.ThemeIcon('play');
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
 * Register session commands and tree view provider
 */
function registerSessionsView(context, client) {
    // Create sessions tree provider
    const sessionsProvider = new SessionsPanel(client);
    // Register tree data provider
    vscode.window.registerTreeDataProvider('morse.sessions', sessionsProvider);
    // Register commands
    context.subscriptions.push(vscode.commands.registerCommand('morse.newSession', async () => {
        await sessionsProvider.createSession();
    }), vscode.commands.registerCommand('morse.sessions.refresh', async () => {
        await sessionsProvider.loadSessions();
    }), vscode.commands.registerCommand('morse.sessions.view', async (sessionId) => {
        await sessionsProvider.viewSessionDetails(sessionId);
    }), vscode.commands.registerCommand('morse.sessions.delete', async (sessionId) => {
        await sessionsProvider.deleteSession(sessionId);
    }), vscode.commands.registerCommand('morse.sessions.switch', async (sessionId) => {
        try {
            client.setCurrentSession(sessionId);
            vscode.window.showInformationMessage('Switched to selected session');
            vscode.commands.executeCommand('morse.chat');
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to switch session: ${error}`);
        }
    }));
    // Initial load
    sessionsProvider.loadSessions();
}
//# sourceMappingURL=SessionsPanel.js.map