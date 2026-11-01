"use strict";
/**
 * Edit command - apply natural language edits to code
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
exports.registerEditCommand = registerEditCommand;
const vscode = __importStar(require("vscode"));
const DiffProvider_1 = require("../views/diff/DiffProvider");
function registerEditCommand(context, client) {
    context.subscriptions.push(vscode.commands.registerCommand('morse.edit', async () => {
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
            range = new vscode.Range(new vscode.Position(0, 0), document.lineAt(document.lineCount - 1).range.end);
            code = document.getText();
        }
        else {
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
                const diffProvider = new DiffProvider_1.DiffProvider(client);
                await diffProvider.showDiff(document, range, result.original, result.edited, result.diff, `Applied: "${instruction}"`);
            }
            catch (err) {
                const message = err instanceof Error ? err.message : 'Unknown error';
                vscode.window.showErrorMessage(`Edit failed: ${message}`);
            }
        });
    }));
}
//# sourceMappingURL=edit.js.map