/**
 * Inline completion provider for // morse: comments
 */

import * as vscode from 'vscode';
import { MorseClient } from '../morse/client';

export class InlineCompletionProvider implements vscode.InlineCompletionItemProvider {
    private client: MorseClient;
    private triggerRegex = /\/\/\s*morse:\s*(.+)$/;

    constructor(client: MorseClient) {
        this.client = client;
    }

    async provideInlineCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        _context: vscode.InlineCompletionContext,
        token: vscode.CancellationToken
    ): Promise<vscode.InlineCompletionList | vscode.InlineCompletionItem[] | null> {
        // Check if line ends with // morse: comment
        const line = document.lineAt(position.line);
        const lineText = line.text.substring(0, position.character);

        const match = this.triggerRegex.exec(lineText);
        if (!match) {
            return null;
        }

        const instruction = match[1].trim();
        if (!instruction) {
            return null;
        }

        // Get context (previous lines for context)
        const startLine = Math.max(0, position.line - 20);
        const contextRange = new vscode.Range(startLine, 0, position.line, line.text.length);
        const contextCode = document.getText(contextRange);

        try {
            // Call Morse for completion
            const result = await this.client.edit({
                code: contextCode,
                language: document.languageId,
                instruction: instruction,
                filePath: document.fileName,
            });

            if (token.isCancellationRequested) {
                return null;
            }

            // Extract just the new part (after the context)
            const completionText = this.extractCompletion(result.edited, contextCode);

            return [
                new vscode.InlineCompletionItem(completionText, new vscode.Range(position, position))
            ];
        } catch (err) {
            console.error('Inline completion error:', err);
            return null;
        }
    }

    /**
     * Extract the completion part (what comes after the context)
     */
    private extractCompletion(edited: string, context: string): string {
        // Find where the context ends in the edited result
        const contextLines = context.split('\n');
        const editedLines = edited.split('\n');

        // Return lines after the context
        if (editedLines.length > contextLines.length) {
            return editedLines.slice(contextLines.length).join('\n');
        }

        // If same length, return empty
        return '';
    }
}
