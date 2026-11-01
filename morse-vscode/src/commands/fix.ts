/**
 * Fix command - automatically fix bugs in selected code
 */

import * as vscode from 'vscode';
import { MorseClient } from '../morse/client';
import { DiffProvider } from '../views/diff/DiffProvider';

export function registerFixCommand(context: vscode.ExtensionContext, client: MorseClient): void {
    context.subscriptions.push(
        vscode.commands.registerCommand('morse.fix', async () => {
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
                // No selection - try to find the enclosing function/block
                const position = selection.active;
                const symbol = await findEnclosingSymbol(document, position);
                if (symbol) {
                    range = symbol.range;
                    code = document.getText(range);
                } else {
                    vscode.window.showWarningMessage('Please select code to fix, or place cursor inside a function');
                    return;
                }
            } else {
                range = new vscode.Range(selection.start, selection.end);
                code = document.getText(range);
            }

            const language = document.languageId;
            const filePath = document.fileName;

            // Show progress
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Morse is analyzing your code...',
                cancellable: true,
            }, async (progress, token) => {
                try {
                    const result = await client.fix({
                        code,
                        language,
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

                    // Show diff view
                    const diffProvider = new DiffProvider(client);
                    await diffProvider.showDiff(
                        document,
                        range,
                        result.original,
                        result.fixed,
                        result.diff,
                        result.explanation
                    );

                } catch (err) {
                    const message = err instanceof Error ? err.message : 'Unknown error';
                    vscode.window.showErrorMessage(`Fix failed: ${message}`);
                }
            });
        })
    );
}

async function findEnclosingSymbol(document: vscode.TextDocument, position: vscode.Position): Promise<vscode.DocumentSymbol | undefined> {
    const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
        'vscode.executeDocumentSymbolProvider',
        document.uri
    );

    if (!symbols) {
        return undefined;
    }

    function findSymbol(symbols: vscode.DocumentSymbol[]): vscode.DocumentSymbol | undefined {
        for (const symbol of symbols) {
            if (symbol.range.contains(position)) {
                const child = findSymbol(symbol.children);
                return child || symbol;
            }
        }
        return undefined;
    }

    return findSymbol(symbols);
}
