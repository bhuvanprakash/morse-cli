/**
 * Diff provider for showing code changes
 */

import * as vscode from 'vscode';
import { MorseClient } from '../../morse/client';
import { MorseProtocol } from '../../morse/protocol';
import { HunkDecorator } from './HunkDecorator';
import { setCurrentDiffContext, clearCurrentDiffContext } from './context';

export class DiffProvider {
    private client: MorseClient;
    private decorator: HunkDecorator;

    constructor(client: MorseClient) {
        this.client = client;
        this.decorator = new HunkDecorator();
    }

    /**
     * Show diff view for code changes
     */
    async showDiff(
        document: vscode.TextDocument,
        range: vscode.Range,
        original: string,
        modified: string,
        diff: MorseProtocol.DiffHunk[],
        explanation: string
    ): Promise<void> {
        // Create a virtual document for the diff
        const uri = document.uri.with({
            scheme: 'morse-diff',
            query: Buffer.from(JSON.stringify({
                original,
                modified,
                diff,
                explanation,
                filePath: document.fileName,
            })).toString('base64'),
        });

        let targetEditor: vscode.TextEditor | undefined;
        try {
            // Indicate that there are pending hunks
            vscode.commands.executeCommand('setContext', 'morse.hasPendingHunks', true);

            // Store diff context for hunk commands
            setCurrentDiffContext({
                document,
                range,
                original,
                modified,
                diff,
                explanation,
                timestamp: Date.now(),
            });

            // Ensure the original document is visible and get its editor
            targetEditor = vscode.window.visibleTextEditors.find(e => e.document === document);
            if (!targetEditor) {
                targetEditor = await vscode.window.showTextDocument(document, { preview: false });
            }

            // Show diff in compare view (this may switch active editor)
            await vscode.commands.executeCommand(
                'vscode.diff',
                document.uri,
                uri,
                `Morse: ${explanation.substring(0, 50)}...`,
                { preview: false }
            );

            // Apply inline decorations to the original document (may not be active now)
            this.decorator.applyDecorations(targetEditor, range, diff);

            // Show apply/reject buttons
            const action = await vscode.window.showInformationMessage(
                explanation,
                'Apply Changes',
                'Reject',
                'Copy to Clipboard'
            );

            if (action === 'Apply Changes') {
                await this.applyChanges(targetEditor, range, modified);
                vscode.window.showInformationMessage('Changes applied');
            } else if (action === 'Copy to Clipboard') {
                await vscode.env.clipboard.writeText(modified);
                vscode.window.showInformationMessage('Modified code copied to clipboard');
            }
        } finally {
            // Clear pending hunks context
            vscode.commands.executeCommand('setContext', 'morse.hasPendingHunks', false);
            clearCurrentDiffContext();
            // Always clear and dispose decorations to avoid resource leaks
            if (targetEditor) {
                this.decorator.clearDecorations(targetEditor);
            } else {
                this.decorator.clearDecorations();
            }
            this.decorator.dispose();
        }

            // Show diff in compare view (this may switch active editor)
            await vscode.commands.executeCommand(
                'vscode.diff',
                document.uri,
                uri,
                `Morse: ${explanation.substring(0, 50)}...`,
                { preview: false }
            );

            // Apply inline decorations to the original document (may not be active now)
            this.decorator.applyDecorations(targetEditor, range, diff);

            // Show apply/reject buttons that operate on the whole change
            const action = await vscode.window.showInformationMessage(
                explanation,
                'Apply Changes',
                'Reject',
                'Copy to Clipboard'
            );

            if (action === 'Apply Changes') {
                await this.applyChanges(targetEditor, range, modified);
                vscode.window.showInformationMessage('Changes applied');
            } else if (action === 'Copy to Clipboard') {
                await vscode.env.clipboard.writeText(modified);
                vscode.window.showInformationMessage('Modified code copied to clipboard');
            }
        } finally {
            // Clear pending hunks context
            vscode.commands.executeCommand('setContext', 'morse.hasPendingHunks', false);
            // Always clear and dispose decorations to avoid resource leaks
            if (targetEditor) {
                this.decorator.clearDecorations(targetEditor);
            } else {
                this.decorator.clearDecorations();
            }
            this.decorator.dispose();
        }
    }

            // Show diff in compare view (this may switch active editor)
            await vscode.commands.executeCommand(
                'vscode.diff',
                document.uri,
                uri,
                `Morse: ${explanation.substring(0, 50)}...`,
                { preview: false }
            );

            // Apply inline decorations to the original document (may not be active now)
            this.decorator.applyDecorations(targetEditor, range, diff);

            // Show apply/reject buttons
            const action = await vscode.window.showInformationMessage(
                explanation,
                'Apply Changes',
                'Reject',
                'Copy to Clipboard'
            );

            if (action === 'Apply Changes') {
                await this.applyChanges(targetEditor, range, modified);
                vscode.window.showInformationMessage('Changes applied');
            } else if (action === 'Copy to Clipboard') {
                await vscode.env.clipboard.writeText(modified);
                vscode.window.showInformationMessage('Modified code copied to clipboard');
            }
        } finally {
            // Always clear and dispose decorations to avoid resource leaks
            if (targetEditor) {
                this.decorator.clearDecorations(targetEditor);
            } else {
                this.decorator.clearDecorations();
            }
            // Note: dispose is also called here, but clearDecorations already cleared.
            // Additional dispose could be redundant if called multiple times; HunkDecorator.dispose is idempotent? 
            // It disposes decoration types; calling twice might panic. So we remove explicit dispose here and let the DiffProvider's own dispose handle it.
            // But we want to ensure it's called when the DiffProvider instance is discarded. Since DiffProvider instances are transient, we need to call dispose after use.
            // So we keep dispose here but ensure it's safe: the HunkDecorator instances are created per DiffProvider, so after showDiff completes, we can safely dispose.
            this.decorator.dispose();
        }
    }

    /**
     * Apply changes to the document using the provided editor
     */
    private async applyChanges(
        editor: vscode.TextEditor,
        range: vscode.Range,
        newText: string
    ): Promise<void> {
        await editor.edit(editBuilder => {
            editBuilder.replace(range, newText);
        });
    }

    dispose(): void {
        this.decorator.dispose();
    }
}

/**
 * Content provider for diff virtual documents
 */
export class DiffContentProvider implements vscode.TextDocumentContentProvider {
    onDidChange?: vscode.Event<vscode.Uri>;

    provideTextDocumentContent(uri: vscode.Uri): string {
        try {
            const data = JSON.parse(Buffer.from(uri.query, 'base64').toString());
            return data.modified;
        } catch {
            return '';
        }
    }
}
