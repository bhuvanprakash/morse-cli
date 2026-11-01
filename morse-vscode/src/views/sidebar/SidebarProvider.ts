/**
 * Sidebar provider for Morse activity bar panel
 */

import * as vscode from 'vscode';
import { MorseClient } from '../../morse/client';

export class SidebarProvider implements vscode.TreeDataProvider<SidebarItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<SidebarItem | undefined | void> = new vscode.EventEmitter<SidebarItem | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<SidebarItem | undefined | void> = this._onDidChangeTreeData.event;

    private client: MorseClient;
    private session: { email: string; plan: string } | null = null;

    constructor(client: MorseClient) {
        this.client = client;
        this.refreshSession();
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    async refreshSession(): Promise<void> {
        try {
            const session = await this.client.getSession();
            if (session) {
                this.session = {
                    email: session.email,
                    plan: session.plan,
                };
            } else {
                this.session = null;
            }
        } catch {
            this.session = null;
        }
        this.refresh();
    }

    getTreeItem(element: SidebarItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: SidebarItem): Thenable<SidebarItem[]> {
        if (element) {
            return Promise.resolve([]);
        }

        const items: SidebarItem[] = [];

        // Account section
        if (this.session) {
            items.push(new SidebarItem(
                `Signed in as ${this.session.email}`,
                vscode.TreeItemCollapsibleState.None,
                'account',
                { command: 'morse.auth', title: 'Account' }
            ));
            items.push(new SidebarItem(
                `Plan: ${this.session.plan}`,
                vscode.TreeItemCollapsibleState.None,
                'plan'
            ));
        } else {
            items.push(new SidebarItem(
                'Sign in to Morse',
                vscode.TreeItemCollapsibleState.None,
                'signin',
                { command: 'morse.auth', title: 'Sign In' }
            ));
        }

        // Actions section
        items.push(new SidebarItem(
            'Quick Actions',
            vscode.TreeItemCollapsibleState.Expanded,
            'section'
        ));

        items.push(new SidebarItem(
            '💡 Fix Code',
            vscode.TreeItemCollapsibleState.None,
            'action',
            { command: 'morse.fix', title: 'Fix' }
        ));

        items.push(new SidebarItem(
            '✏️ Edit with AI',
            vscode.TreeItemCollapsibleState.None,
            'action',
            { command: 'morse.edit', title: 'Edit' }
        ));

        items.push(new SidebarItem(
            '💬 Open Chat',
            vscode.TreeItemCollapsibleState.None,
            'action',
            { command: 'morse.chat', title: 'Chat' }
        ));

        items.push(new SidebarItem(
            '📝 Generate Tests',
            vscode.TreeItemCollapsibleState.None,
            'action',
            { command: 'morse.generateTests', title: 'Generate Tests' }
        ));

        items.push(new SidebarItem(
            '📤 Generate Commit',
            vscode.TreeItemCollapsibleState.None,
            'action',
            { command: 'morse.generateCommit', title: 'Generate Commit' }
        ));

        // Resources section
        items.push(new SidebarItem(
            'Resources',
            vscode.TreeItemCollapsibleState.Expanded,
            'section'
        ));

        items.push(new SidebarItem(
            '🌐 Open Dashboard',
            vscode.TreeItemCollapsibleState.None,
            'resource',
            { command: 'morse.openDashboard', title: 'Dashboard' }
        ));

        items.push(new SidebarItem(
            '📚 Documentation',
            vscode.TreeItemCollapsibleState.None,
            'resource',
            {
                command: 'vscode.open',
                title: 'Documentation',
                arguments: [vscode.Uri.parse('https://morse.sh/docs')]
            }
        ));

        return Promise.resolve(items);
    }
}

class SidebarItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly contextValue: string,
        public readonly command?: vscode.Command
    ) {
        super(label, collapsibleState);

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
