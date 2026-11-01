/**
 * Status bar manager for Morse
 */

import * as vscode from 'vscode';
import { MorseClient } from '../morse/client';

export class StatusBarManager {
    private statusBarItem: vscode.StatusBarItem;
    private client: MorseClient;
    private disposables: vscode.Disposable[] = [];
    private updateInterval: NodeJS.Timeout | undefined;

    constructor(client: MorseClient) {
        this.client = client;

        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100
        );

        this.statusBarItem.command = 'morse.auth';
        this.updateStatus();
        this.statusBarItem.show();

        // Update status periodically
        this.updateInterval = setInterval(() => {
            this.updateStatus();
        }, 30000);

        // Listen for configuration changes
        this.disposables.push(
            vscode.workspace.onDidChangeConfiguration(() => {
                this.updateStatus();
            })
        );
    }

    private async updateStatus(): Promise<void> {
        try {
            const session = await this.client.getSession();

            if (session) {
                // Set authentication context key
                vscode.commands.executeCommand('setContext', 'morse.isAuthenticated', true);

                // Get usage stats
                try {
                    const stats = await this.client.getUsageStats();
                    const today = stats.daily[stats.daily.length - 1];

                    this.statusBarItem.text = `$(sparkle) Morse: ${session.plan}`;
                    this.statusBarItem.tooltip = new vscode.MarkdownString([
                        `**Morse AI**`,
                        ``,
                        `Signed in as: ${session.email}`,
                        `Plan: ${session.plan}`,
                        ``,
                        `**Today's Usage:**`,
                        `Tokens: ${today?.tokens.toLocaleString() || 0}`,
                        `Cost: $${today?.cost.toFixed(4) || '0.0000'}`,
                        `Requests: ${today?.requests || 0}`,
                    ].join('\n'));
                } catch {
                    this.statusBarItem.text = `$(sparkle) Morse: ${session.plan}`;
                    this.statusBarItem.tooltip = `Signed in as ${session.email}`;
                }
            } else {
                vscode.commands.executeCommand('setContext', 'morse.isAuthenticated', false);
                this.statusBarItem.text = `$(sparkle) Morse: Sign In`;
                this.statusBarItem.tooltip = 'Click to sign in to Morse';
            }
        } catch {
            vscode.commands.executeCommand('setContext', 'morse.isAuthenticated', false);
            this.statusBarItem.text = `$(sparkle) Morse: Disconnected`;
            this.statusBarItem.tooltip = 'Morse CLI not running. Click to reconnect.';
        }
    }

    dispose(): void {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        this.statusBarItem.dispose();
        this.disposables.forEach(d => d.dispose());
    }
}
