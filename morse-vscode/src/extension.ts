/**
 * Morse VS Code Extension
 * Enhanced with streaming, session persistence, better error handling,
 * and native Chat API integration
 */

import * as vscode from 'vscode';
import { MorseClient } from './morse/client';
import { ChatPanel } from './views/chat/ChatPanel';
import { StatusBarManager } from './status/StatusBarItem';
import { MorseCodeLensProvider } from './codelens/MorseCodeLensProvider';
import { InlineCompletionProvider } from './completion/InlineCompletionProvider';
import { registerCommands } from './commands/index';
import { registerLocalOpenCommand } from './commands/localOpen';
import { registerChatParticipant } from './chat/provider';
import { DiffProvider, DiffContentProvider } from './views/diff/DiffProvider';
import { SidebarProvider } from './views/sidebar/SidebarProvider';
import { getCurrentDiffContext, DiffContext } from './views/diff/context';

let client: MorseClient;
let statusBar: StatusBarManager;

export function activate(context: vscode.ExtensionContext) {
    console.log('Morse extension activated');

    // Validate settings before use
    const settingsValidation = validateSettings();
    if (!settingsValidation.valid) {
        vscode.window.showWarningMessage(
            `Morse: ${settingsValidation.message}`,
            'Open Settings'
        ).then((selection) => {
            if (selection === 'Open Settings') {
                vscode.commands.executeCommand('workbench.action.openSettings', 'morse');
            }
        });
    }

    // Initialize client
    client = new MorseClient();

    // Register global diff content provider
    context.subscriptions.push(
        vscode.workspace.registerTextDocumentContentProvider('morse-diff', new DiffContentProvider())
    );

    // Register sidebar history view
    const sidebarProvider = new SidebarProvider(client);
    context.subscriptions.push(
        vscode.window.registerTreeDataProvider('morse.history', sidebarProvider)
    );

    // Initialize status bar
    statusBar = new StatusBarManager(client);
    context.subscriptions.push(statusBar);

    // Register commands
    registerCommands(context, client);

    // Register local open commands
    registerLocalOpenCommand(context);

    // Register code lens provider
    const codeLensProvider = new MorseCodeLensProvider();
    context.subscriptions.push(
        vscode.languages.registerCodeLensProvider({ pattern: '**/*' }, codeLensProvider)
    );

    // Register inline completion provider
    const completionProvider = new InlineCompletionProvider(client);
    context.subscriptions.push(
        vscode.languages.registerInlineCompletionItemProvider(
            { pattern: '**/*' },
            completionProvider
        )
    );

    // Register CodeLens executor
    registerExecuteCodeLensCommand(context, client);

    // Register native Chat API participant (if available in this VS Code version)
    try {
        // Check if chat namespace exists (VS Code 1.90+)
        if ((vscode as { chat?: { createChatParticipant: unknown } }).chat?.createChatParticipant) {
            registerChatParticipant(context, client);
            console.log('[Morse] Native Chat API participant registered');
        }
    } catch (error) {
        console.log('[Morse] Native Chat API not available in this version');
    }

    // Handle webview restoration
    context.subscriptions.push(
        vscode.window.registerWebviewPanelSerializer('morse.chat', {
            async deserializeWebviewPanel(webviewPanel: vscode.WebviewPanel) {
                ChatPanel.revive(webviewPanel, context.extensionUri, client, context);
            },
        })
    );

    // Register additional commands that need ChatPanel access
    registerChatCommands(context);

    // Watch for configuration changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('morse')) {
                console.log('[Morse] Configuration changed, reloading...');
                // Re-validate settings
                const validation = validateSettings();
                if (!validation.valid && validation.showNotification) {
                    vscode.window.showWarningMessage(`Morse: ${validation.message}`);
                }
            }
        })
    );
}

/**
 * Validate Morse settings
 */
function validateSettings(): { valid: boolean; message: string; showNotification?: boolean } {
    const config = vscode.workspace.getConfiguration('morse');

    // Get settings with proper defaults
    const apiKey = config.get<string>('apiKey') || '';
    const endpoint = config.get<string>('endpoint') || 'http://localhost:8080';
    const model = config.get<string>('model') || 'claude-3-5-sonnet-20241022';

    // Check API key
    if (!apiKey) {
        // Check for environment variable fallback
        const envApiKey = process.env.MORSE_API_KEY;
        if (!envApiKey) {
            return {
                valid: false,
                message: 'API key not configured. Set morse.apiKey or MORSE_API_KEY env var.',
                showNotification: true,
            };
        }
    }

    // Validate endpoint format
    try {
        new URL(endpoint);
    } catch {
        return {
            valid: false,
            message: `Invalid endpoint URL: ${endpoint}`,
            showNotification: true,
        };
    }

    // Validate model
    const validModels = [
        'claude-3-5-sonnet-20241022',
        'claude-3-opus-20240229',
        'gpt-4o',
        'gpt-4-turbo',
    ];
    if (!validModels.includes(model)) {
        console.warn(`[Morse] Unknown model: ${model}`);
    }

    return { valid: true, message: 'Settings valid' };
}

function registerChatCommands(context: vscode.ExtensionContext): void {
    // Clear Chat command
    const clearChat = vscode.commands.registerCommand('morse.clearChat', () => {
        if (ChatPanel.currentPanel) {
            vscode.window.showInformationMessage('Use the clear button in the chat panel');
        }
    });

    // Export Chat command
    const exportChat = vscode.commands.registerCommand('morse.exportChat', async () => {
        if (ChatPanel.currentPanel) {
            vscode.window.showInformationMessage('Use the export button in the chat panel');
        }
    });

    // Accept Hunk command
    const acceptHunk = vscode.commands.registerCommand('morse.acceptHunk', async () => {
        const ctx = getCurrentDiffContext();
        if (!ctx) {
            vscode.window.showWarningMessage('No pending changes to accept');
            return;
        }

        // Find editor for the document
        let editor = vscode.window.visibleTextEditors.find(e => e.document === ctx.document);
        if (!editor) {
            editor = await vscode.window.showTextDocument(ctx.document, { preview: false });
        }

        try {
            await editor.edit(editBuilder => {
                editBuilder.replace(ctx.range, ctx.modified);
            });
            vscode.window.showInformationMessage('Changes applied');
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Unknown error';
            vscode.window.showErrorMessage(`Failed to apply changes: ${msg}`);
        }
    });

    // Reject Hunk command
    const rejectHunk = vscode.commands.registerCommand('morse.rejectHunk', async () => {
        const ctx = getCurrentDiffContext();
        if (!ctx) {
            vscode.window.showWarningMessage('No pending changes to reject');
            return;
        }
        // Rejection is implicit - we just close the diff and do not apply changes
        vscode.window.showInformationMessage('Changes rejected');
        // Could also trigger a UI close if needed
    });

    // Accept All Hunks command (same as accept since we treat whole change as one)
    const acceptAllHunks = vscode.commands.registerCommand('morse.acceptAllHunks', async () => {
        const ctx = getCurrentDiffContext();
        if (!ctx) {
            vscode.window.showWarningMessage('No pending changes to accept');
            return;
        }

        let editor = vscode.window.visibleTextEditors.find(e => e.document === ctx.document);
        if (!editor) {
            editor = await vscode.window.showTextDocument(ctx.document, { preview: false });
        }

        try {
            await editor.edit(editBuilder => {
                editBuilder.replace(ctx.range, ctx.modified);
            });
            vscode.window.showInformationMessage('All changes applied');
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Unknown error';
            vscode.window.showErrorMessage(`Failed to apply changes: ${msg}`);
        }
    });

    context.subscriptions.push(clearChat, exportChat, acceptHunk, rejectHunk, acceptAllHunks);
}

function registerExecuteCodeLensCommand(context: vscode.ExtensionContext, client: MorseClient): void {
    context.subscriptions.push(
        vscode.commands.registerCommand('morse.executeCodeLens', async (action: string, docUriStr: string, line: number) => {
            try {
                const uri = vscode.Uri.parse(docUriStr);
                const doc = await vscode.workspace.openTextDocument(uri);
                // Reveal the document to user
                await vscode.window.showTextDocument(doc, { preview: false });

                // Find enclosing symbol at the given line
                const position = new vscode.Position(line, 0);
                const symbol = await findEnclosingSymbol(doc, position);
                if (!symbol) {
                    vscode.window.showWarningMessage('Could not find code element at that line');
                    return;
                }

                const range = symbol.range;
                const code = doc.getText(range);
                const language = doc.languageId;
                const filePath = doc.fileName;

                switch (action) {
                    case 'fix':
                        const fixResult = await client.fix({
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
                        const diffProviderFix = new DiffProvider(client);
                        await diffProviderFix.showDiff(
                            doc,
                            range,
                            fixResult.original,
                            fixResult.fixed,
                            fixResult.diff,
                            fixResult.explanation
                        );
                        break;

                    case 'edit':
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
                        if (!instruction) return;

                        const editResult = await client.edit({
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
                        const diffProviderEdit = new DiffProvider(client);
                        await diffProviderEdit.showDiff(
                            doc,
                            range,
                            editResult.original,
                            editResult.edited,
                            editResult.diff,
                            `Applied: "${instruction}"`
                        );
                        break;

                    case 'explain':
                        const explainResult = await client.explain({
                            code,
                            language,
                            filePath,
                        });
                        vscode.window.showInformationMessage(`Explanation:\n${explainResult.explanation}`);
                        break;

                    case 'generateTests':
                        const testResult = await client.generateTests({
                            code,
                            language,
                            filePath,
                        });
                        const testContent = testResult.testCode;
                        if (!testContent) {
                            vscode.window.showWarningMessage('No test code generated');
                            return;
                        }
                        // Determine test file path next to source
                        const testFilePath = filePath.replace(/\.[^/.]+$/, '_test.go');
                        const testFileUri = vscode.Uri.file(testFilePath);
                        await vscode.workspace.fs.writeFile(testFileUri, Buffer.from(testContent));
                        await vscode.window.showTextDocument(testFileUri);
                        vscode.window.showInformationMessage(`Generated tests in ${testFilePath}`);
                        break;

                    default:
                        vscode.window.showWarningMessage(`Unknown action: ${action}`);
                }
            } catch (err) {
                const msg = err instanceof Error ? err.message : 'Unknown error';
                vscode.window.showErrorMessage(`CodeLens action failed: ${msg}`);
            }
        })
    );
}

// Shared helper to find symbol at position
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

export function deactivate() {
    console.log('Morse extension deactivated');
    if (client) {
        client.dispose();
    }
}
