"use strict";
/**
 * Tool Glob Command - Find files by pattern via morse-cli
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
exports.registerToolGlobCommand = registerToolGlobCommand;
const vscode = __importStar(require("vscode"));
function registerToolGlobCommand(context, client) {
    context.subscriptions.push(vscode.commands.registerCommand('morse.toolGlob', async () => {
        const pattern = await vscode.window.showInputBox({
            prompt: 'Enter glob pattern',
            placeHolder: 'e.g., **/*.ts, src/**/*.js, **/*.json',
        });
        if (!pattern) {
            return;
        }
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Finding files matching: ${pattern}`,
            cancellable: true,
        }, async (progress, token) => {
            try {
                let output = '';
                for await (const chunk of client.streamToolExecution('glob', {
                    pattern,
                })) {
                    if (token.isCancellationRequested) {
                        return;
                    }
                    if (chunk.output) {
                        output += chunk.output;
                    }
                    if (chunk.error) {
                        output += `[Error]: ${chunk.error}\n`;
                    }
                    if (chunk.status === 'completed' || chunk.status === 'failed') {
                        if (chunk.error) {
                            vscode.window.showErrorMessage(`Glob failed: ${chunk.error}`);
                        }
                    }
                }
                // Show result
                if (output) {
                    const doc = await vscode.workspace.openTextDocument({
                        language: 'plaintext',
                        content: output,
                    });
                    await vscode.window.showTextDocument(doc, {
                        viewColumn: vscode.ViewColumn.Beside,
                        preview: false,
                    });
                }
                else {
                    vscode.window.showInformationMessage('No files found matching pattern');
                }
            }
            catch (error) {
                vscode.window.showErrorMessage(`Failed to find files: ${error}`);
            }
        });
    }));
}
//# sourceMappingURL=toolGlob.js.map