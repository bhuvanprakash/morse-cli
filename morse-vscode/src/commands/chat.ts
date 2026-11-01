/**
 * Chat command - open the chat panel
 */

import * as vscode from 'vscode';
import { MorseClient } from '../morse/client';
import { ChatPanel } from '../views/chat/ChatPanel';

export function registerChatCommand(context: vscode.ExtensionContext, client: MorseClient): void {
    context.subscriptions.push(
        vscode.commands.registerCommand('morse.chat', async () => {
            const existingPanel = ChatPanel.currentPanel;
            if (existingPanel) {
                existingPanel.reveal();
                return;
            }

            ChatPanel.create(context.extensionUri, client, context);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('morse.chatAboutSelection', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showWarningMessage('No active editor');
                return;
            }

            const selection = editor.selection;
            const code = selection.isEmpty
                ? editor.document.getText()
                : editor.document.getText(selection);

            const language = editor.document.languageId;
            const fileName = editor.document.fileName;

            let panel = ChatPanel.currentPanel;
            if (!panel) {
                panel = ChatPanel.create(context.extensionUri, client, context);
            } else {
                panel.reveal();
            }

            panel.addCodeContext(code, language, fileName);
        })
    );
}
