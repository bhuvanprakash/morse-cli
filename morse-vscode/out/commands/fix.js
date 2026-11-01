"use strict";
/**
 * Fix command - automatically fix bugs in selected code
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
exports.registerFixCommand = registerFixCommand;
const vscode = __importStar(require("vscode"));
const DiffProvider_1 = require("../views/diff/DiffProvider");
function registerFixCommand(context, client) {
    context.subscriptions.push(vscode.commands.registerCommand('morse.fix', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('No active editor');
            return;
        }
        const document = editor.document;
        const selection = editor.selection;
        // Get selected text or entire document
        let code;
        let range;
        if (selection.isEmpty) {
            // No selection - try to find the enclosing function/block
            const position = selection.active;
            const symbol = await findEnclosingSymbol(document, position);
            if (symbol) {
                range = symbol.range;
                code = document.getText(range);
            }
            else {
                vscode.window.showWarningMessage('Please select code to fix, or place cursor inside a function');
                return;
            }
        }
        else {
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
                const diffProvider = new DiffProvider_1.DiffProvider(client);
                await diffProvider.showDiff(document, range, result.original, result.fixed, result.diff, result.explanation);
            }
            catch (err) {
                const message = err instanceof Error ? err.message : 'Unknown error';
                vscode.window.showErrorMessage(`Fix failed: ${message}`);
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
//# sourceMappingURL=fix.js.map