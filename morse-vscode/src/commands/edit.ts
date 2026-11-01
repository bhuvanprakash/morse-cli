/**
 * Edit command - apply natural language edits to code
 */

import * as vscode from 'vscode';
import { MorseClient } from '../morse/client';
import { DiffProvider } from '../views/diff/DiffProvider';

export function registerEditCommand(context: vscode.ExtensionContext, client: MorseClient): void {
    context.subscriptions.push(
        vscode.commands.registerCommand('morse.edit', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showWarningMessage('No active editor');
                return;
            }

            const document = editor.document;
            const selection = editor.selection;

            // Get selected text or entire document
            let code: string;
            let range: vscode.Range;

            if (selection.isEmpty) {
                range = new vscode.Range(
                    new vscode.Position(0, 0),
                    document.lineAt(document.lineCount - 1).range.end
                );
                code = document.getText();
            } else {
                range = new vscode.Range(selection.start, selection.end);
                code = document.getText(range);
            }

            // Get instruction from user
            const instruction = await vscode.window.showInputBox({
                prompt: 'Describe the changes you want to make',
                placeHolder: 'e.g., "Add error handling", "Refactor to use async/await"',
                validateInput: (value) => {
                    if (!value || value.trim().length === 0) {
                        return 'Please enter an instruction';
                    }
                    return undefined;
                },
            });

            if (!instruction) {
                return;
            }

            const language = document.languageId;
            const filePath = document.fileName;

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Morse is applying your edits...',
                cancellable: true,
            }, async (_progress, token) => {
                try {
                    const result = await client.edit({
                        code,
                        language,
                        instruction,
                        filePath,
                        context: {
                            filePath,
                            selection: {
                                start: { line: range.start.line, character: range.start.character },
                                end: { line: range.end.line, character: range.end.character },
                            },
                        },
                    });

                    if (token.isCancellationRequested) {
                        return;
                    }

                    const diffProvider = new DiffProvider(client);
                    await diffProvider.showDiff(
                        document,
                        range,
                        result.original,
                        result.edited,
                        result.diff,
                        `Applied: "${instruction}"`
                    );

                } catch (err) {
                    const message = err instanceof Error ? err.message : 'Unknown error';
                    vscode.window.showErrorMessage(`Edit failed: ${message}`);
                }
            });
        })
    );
}
