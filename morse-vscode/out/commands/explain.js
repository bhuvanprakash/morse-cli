"use strict";
/**
 * Explain command - explain selected code
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerExplainCommand = registerExplainCommand;
const vscode = __importStar(require("vscode"));
function registerExplainCommand(context, client) {
    context.subscriptions.push(vscode.commands.registerCommand('morse.explain', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('No active editor');
            return;
        }
        const document = editor.document;
        const selection = editor.selection;
        let code;
        let range;
        if (selection.isEmpty) {
            const position = selection.active;
            const symbol = await findEnclosingSymbol(document, position);
            if (symbol) {
                range = symbol.range;
                code = document.getText(range);
            }
            else {
                vscode.window.showWarningMessage('Please select code to explain');
                return;
            }
        }
        else {
            range = new vscode.Range(selection.start, selection.end);
            code = document.getText(range);
        }
        const detailOption = await vscode.window.showQuickPick([
            { label: 'Brief', description: 'Quick overview', value: 'brief' },
            { label: 'Normal', description: 'Standard explanation', value: 'normal' },
            { label: 'Detailed', description: 'In-depth analysis', value: 'detailed' },
        ], { placeHolder: 'Select explanation detail level' });
        if (!detailOption) {
            return;
        }
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Morse is analyzing your code...',
            cancellable: true,
        }, async (_progress, token) => {
            try {
                const result = await client.explain({
                    code,
                    language: document.languageId,
                    detail: detailOption.value,
                    context: {
                        filePath: document.fileName,
                        selection: {
                            start: { line: range.start.line, character: range.start.character },
                            end: { line: range.end.line, character: range.end.character },
                        },
                    },
                });
                if (token.isCancellationRequested) {
                    return;
                }
                const markdown = formatExplanation(result.explanation, result.keyPoints, code, document.languageId);
                const doc = await vscode.workspace.openTextDocument({
                    language: 'markdown',
                    content: markdown,
                });
                await vscode.window.showTextDocument(doc, {
                    viewColumn: vscode.ViewColumn.Beside,
                    preview: true,
                });
            }
            catch (err) {
                const message = err instanceof Error ? err.message : 'Unknown error';
                vscode.window.showErrorMessage(`Explanation failed: ${message}`);
            }
        });
    }));
}
async function findEnclosingSymbol(document, position) {
    const symbols = await vscode.commands.executeCommand('vscode.executeDocumentSymbolProvider', document.uri);
    if (!symbols) {
        return undefined;
    }
    function findSymbol(symbols) {
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
function formatExplanation(explanation, keyPoints, code, language) {
    return `# Code Explanation\n\n## Overview\n\n${explanation}\n\n## Key Points\n\n${keyPoints.map(point => `- ${point}`).join('\n')}\n\n## Code\n\n\`\`\`${language}\n${code}\n\`\`\`\n\n---\n*Generated by Morse AI*\n`;
}
//# sourceMappingURL=explain.js.map