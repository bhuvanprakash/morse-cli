/**
 * Decorator for diff hunks in the editor
 */

import * as vscode from 'vscode';
import { MorseProtocol } from '../../morse/protocol';

export class HunkDecorator {
    private addedDecorationType: vscode.TextEditorDecorationType;
    private removedDecorationType: vscode.TextEditorDecorationType;
    private gutterDecorationType: vscode.TextEditorDecorationType;

    constructor() {
        // Green background for added lines
        this.addedDecorationType = vscode.window.createTextEditorDecorationType({
            backgroundColor: 'rgba(35, 197, 94, 0.2)',
            borderRadius: '2px',
            overviewRulerColor: 'rgba(35, 197, 94, 0.5)',
            overviewRulerLane: vscode.OverviewRulerLane.Full,
        });

        // Red background for removed lines
        this.removedDecorationType = vscode.window.createTextEditorDecorationType({
            backgroundColor: 'rgba(239, 68, 68, 0.2)',
            borderRadius: '2px',
            overviewRulerColor: 'rgba(239, 68, 68, 0.5)',
            overviewRulerLane: vscode.OverviewRulerLane.Full,
            textDecoration: 'line-through',
        });

        // Gutter indicators
        this.gutterDecorationType = vscode.window.createTextEditorDecorationType({
            gutterIconPath: undefined,
            gutterIconSize: 'contain',
        });
    }

    /**
     * Apply decorations for diff hunks on a specific editor
     */
    applyDecorations(
        editor: vscode.TextEditor,
        range: vscode.Range,
        diff: MorseProtocol.DiffHunk[]
    ): void {
        if (!editor) {
            return;
        }

        const addedRanges: vscode.Range[] = [];
        const removedRanges: vscode.Range[] = [];

        // Calculate offset from range start
        const startLine = range.start.line;
        const lineCount = editor.document.lineCount;

        for (const hunk of diff) {
            if (!hunk.lines) continue;
            for (const line of hunk.lines) {
                const lineNumber = startLine + line.lineNumber;
                // Guard against out-of-bounds
                if (lineNumber < 0 || lineNumber >= lineCount) {
                    continue;
                }
                const lineRange = new vscode.Range(
                    new vscode.Position(lineNumber, 0),
                    new vscode.Position(lineNumber, editor.document.lineAt(lineNumber).text.length)
                );

                if (line.type === 'added') {
                    addedRanges.push(lineRange);
                } else if (line.type === 'removed') {
                    removedRanges.push(lineRange);
                }
            }
        }

        editor.setDecorations(this.addedDecorationType, addedRanges);
        editor.setDecorations(this.removedDecorationType, removedRanges);
    }

    /**
     * Clear all decorations on a specific editor
     */
    clearDecorations(editor?: vscode.TextEditor): void {
        const editors = editor ? [editor] : vscode.window.visibleTextEditors;
        for (const ed of editors) {
            ed.setDecorations(this.addedDecorationType, []);
            ed.setDecorations(this.removedDecorationType, []);
            ed.setDecorations(this.gutterDecorationType, []);
        }
    }

    /**
     * Dispose decoration types
     */
    dispose(): void {
        this.addedDecorationType.dispose();
        this.removedDecorationType.dispose();
        this.gutterDecorationType.dispose();
    }
}
