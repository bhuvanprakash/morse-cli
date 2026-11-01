/**
 * Command registration for Morse VS Code extension
 */

import * as vscode from 'vscode';
import { MorseClient } from '../morse/client';
import { registerFixCommand } from './fix';
import { registerEditCommand } from './edit';
import { registerChatCommand } from './chat';
import { registerExplainCommand } from './explain';
import { registerTestCommand } from './test';
import { registerCommitCommand } from './commit';
import { registerAuthCommand } from './auth';

export function registerCommands(context: vscode.ExtensionContext, client: MorseClient): void {
    // Register all command modules
    registerFixCommand(context, client);
    registerEditCommand(context, client);
    registerChatCommand(context, client);
    registerExplainCommand(context, client);
    registerTestCommand(context, client);
    registerCommitCommand(context, client);
    registerAuthCommand(context, client);

    // Register dashboard command
    context.subscriptions.push(
        vscode.commands.registerCommand('morse.openDashboard', () => {
            const dashboardUrl = 'https://morse.sh/dashboard';
            vscode.env.openExternal(vscode.Uri.parse(dashboardUrl));
        })
    );
}
