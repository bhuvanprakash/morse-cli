/**
 * Test command - generate tests for selected code
 */

import * as vscode from 'vscode';
import { MorseClient } from '../morse/client';

export function registerTestCommand(context: vscode.ExtensionContext, client: MorseClient): void {
    context.subscriptions.push(
        vscode.commands.registerCommand('morse.generateTests', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showWarningMessage('No active editor');
                return;
            }

            const document = editor.document;
            const selection = editor.selection;

            let code: string;
            let range: vscode.Range;

            if (selection.isEmpty) {
                const position = selection.active;
                const symbol = await findEnclosingSymbol(document, position);
                if (symbol) {
                    range = symbol.range;
                    code = document.getText(range);
                } else {
                    vscode.window.showWarningMessage('Please select code to generate tests for');
                    return;
                }
            } else {
                range = new vscode.Range(selection.start, selection.end);
                code = document.getText(range);
            }

            const language = document.languageId;
            const filePath = document.fileName;

            const framework = await vscode.window.showInputBox({
                prompt: 'Test framework (optional)',
                placeHolder: 'e.g., jest, pytest, go test (leave empty for auto)',
            });

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Morse is generating tests...',
                cancellable: true,
            }, async (_progress, token) => {
                try {
                    const result = await client.generateTests({
                        code,
                        language,
                        framework: framework || undefined,
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

                    const testDoc = await vscode.workspace.openTextDocument({
                        language,
                        content: result.testCode,
                    });

                    await vscode.window.showTextDocument(testDoc, {
                        viewColumn: vscode.ViewColumn.Beside,
                    });

                    const saveOption = await vscode.window.showInformationMessage(
                        `Tests generated for ${result.testFilePath}`,
                        'Save Test File',
                        'Copy to Clipboard'
                    );

                    if (saveOption === 'Save Test File') {
                        const testUri = vscode.Uri.file(result.testFilePath);
                        await vscode.workspace.fs.writeFile(testUri, Buffer.from(result.testCode));
                        vscode.window.showInformationMessage(`Test file saved: ${result.testFilePath}`);
                    } else if (saveOption === 'Copy to Clipboard') {
                        await vscode.env.clipboard.writeText(result.testCode);
                        vscode.window.showInformationMessage('Test code copied to clipboard');
                    }

                } catch (err) {
                    const message = err instanceof Error ? err.message : 'Unknown error';
                    vscode.window.showErrorMessage(`Test generation failed: ${message}`);
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
