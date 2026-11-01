"use strict";
/**
 * Sidebar provider for Morse activity bar panel
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
exports.SidebarProvider = void 0;
const vscode = __importStar(require("vscode"));
class SidebarProvider {
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    client;
    session = null;
    constructor(client) {
        this.client = client;
        this.refreshSession();
    }
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    async refreshSession() {
        try {
            const session = await this.client.getSession();
            if (session) {
                this.session = {
                    email: session.email,
                    plan: session.plan,
                };
            }
            else {
                this.session = null;
            }
        }
        catch {
            this.session = null;
        }
        this.refresh();
    }
    getTreeItem(element) {
        return element;
    }
    getChildren(element) {
        if (element) {
            return Promise.resolve([]);
        }
        const items = [];
        // Account section
        if (this.session) {
            items.push(new SidebarItem(`Signed in as ${this.session.email}`, vscode.TreeItemCollapsibleState.None, 'account', { command: 'morse.auth', title: 'Account' }));
            items.push(new SidebarItem(`Plan: ${this.session.plan}`, vscode.TreeItemCollapsibleState.None, 'plan'));
        }
        else {
            items.push(new SidebarItem('Sign in to Morse', vscode.TreeItemCollapsibleState.None, 'signin', { command: 'morse.auth', title: 'Sign In' }));
        }
        // Actions section
        items.push(new SidebarItem('Quick Actions', vscode.TreeItemCollapsibleState.Expanded, 'section'));
        items.push(new SidebarItem('💡 Fix Code', vscode.TreeItemCollapsibleState.None, 'action', { command: 'morse.fix', title: 'Fix' }));
        items.push(new SidebarItem('✏️ Edit with AI', vscode.TreeItemCollapsibleState.None, 'action', { command: 'morse.edit', title: 'Edit' }));
        items.push(new SidebarItem('💬 Open Chat', vscode.TreeItemCollapsibleState.None, 'action', { command: 'morse.chat', title: 'Chat' }));
        items.push(new SidebarItem('📝 Generate Tests', vscode.TreeItemCollapsibleState.None, 'action', { command: 'morse.generateTests', title: 'Generate Tests' }));
        items.push(new SidebarItem('📤 Generate Commit', vscode.TreeItemCollapsibleState.None, 'action', { command: 'morse.generateCommit', title: 'Generate Commit' }));
        // Resources section
        items.push(new SidebarItem('Resources', vscode.TreeItemCollapsibleState.Expanded, 'section'));
        items.push(new SidebarItem('🌐 Open Dashboard', vscode.TreeItemCollapsibleState.None, 'resource', { command: 'morse.openDashboard', title: 'Dashboard' }));
        items.push(new SidebarItem('📚 Documentation', vscode.TreeItemCollapsibleState.None, 'resource', {
            command: 'vscode.open',
            title: 'Documentation',
            arguments: [vscode.Uri.parse('https://morse.sh/docs')]
        }));
        return Promise.resolve(items);
    }
}
exports.SidebarProvider = SidebarProvider;
class SidebarItem extends vscode.TreeItem {
    label;
    collapsibleState;
    contextValue;
    command;
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
            case 'action':
                this.iconPath = new vscode.ThemeIcon('play');
                break;
            case 'account':
                this.iconPath = new vscode.ThemeIcon('account');
                break;
            case 'plan':
                this.iconPath = new vscode.ThemeIcon('star');
                break;
            case 'resource':
                this.iconPath = new vscode.ThemeIcon('link-external');
                break;
            case 'signin':
                this.iconPath = new vscode.ThemeIcon('sign-in');
                break;
        }
    }
}
//# sourceMappingURL=SidebarProvider.js.map