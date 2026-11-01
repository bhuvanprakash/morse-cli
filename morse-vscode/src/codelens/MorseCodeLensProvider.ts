/**
 * CodeLens provider for Morse actions above functions
 */

import * as vscode from 'vscode';

export class MorseCodeLensProvider implements vscode.CodeLensProvider {
    private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

    constructor() {
        // Refresh when configuration changes
        vscode.workspace.onDidChangeConfiguration((_) => {
            this._onDidChangeCodeLenses.fire();
        });
    }

    provideCodeLenses(document: vscode.TextDocument, _token: vscode.CancellationToken): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
        const codeLenses: vscode.CodeLens[] = [];

        // Find function declarations
        const functionRegex = /^(\s*)(export\s+)?(async\s+)?function\s+(\w+)|^(\s*)(export\s+)?(async\s+)?(\w+)\s*[:=]\s*(async\s*)?\(|^(\s*)(export\s+)?class\s+(\w+)/gm;

        const text = document.getText();
        let match;

        while ((match = functionRegex.exec(text)) !== null) {
            const line = document.positionAt(match.index).line;
            const range = new vscode.Range(line, 0, line, 0);

            // Fix lens
            codeLenses.push(new vscode.CodeLens(range, {
                title: '$(sparkle) Fix',
                tooltip: 'Ask Morse to fix this code',
                command: 'morse.executeCodeLens',
                arguments: ['fix', document.uri.toString(), line],
            }));

            // Edit lens
            codeLenses.push(new vscode.CodeLens(range, {
                title: '$(edit) Edit',
                tooltip: 'Ask Morse to edit this code',
                command: 'morse.executeCodeLens',
                arguments: ['edit', document.uri.toString(), line],
            }));

            // Explain lens
            codeLenses.push(new vscode.CodeLens(range, {
                title: '$(question) Explain',
                tooltip: 'Ask Morse to explain this code',
                command: 'morse.executeCodeLens',
                arguments: ['explain', document.uri.toString(), line],
            }));

            // Test lens
            codeLenses.push(new vscode.CodeLens(range, {
                title: '$(beaker) Test',
                tooltip: 'Ask Morse to generate tests',
                command: 'morse.executeCodeLens',
                arguments: ['generateTests', document.uri.toString(), line],
            }));
        }

        return codeLenses;
    }

    resolveCodeLens(codeLens: vscode.CodeLens, _token: vscode.CancellationToken): vscode.ProviderResult<vscode.CodeLens> {
        return codeLens;
    }
}
