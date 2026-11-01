"use strict";
/**
 * Tool Bash Command - Execute bash commands via morse-cli
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
exports.registerToolBashCommand = registerToolBashCommand;
const vscode = __importStar(require("vscode"));
function registerToolBashCommand(context, client) {
    context.subscriptions.push(vscode.commands.registerCommand('morse.toolBash', async () => {
        const command = await vscode.window.showInputBox({
            prompt: 'Enter bash command to execute',
            placeHolder: 'e.g., ls -la, git status, npm run build',
        });
        if (!command) {
            return;
        }
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Executing: ${command}`,
            cancellable: true,
        }, async (progress, token) => {
            try {
                let output = '';
                for await (const chunk of client.streamToolExecution('bash', { command })) {
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
                            vscode.window.showErrorMessage(`Command failed: ${chunk.error}`);
                        }
                    }
                }
                // Show result
                if (output) {
                    const doc = await vscode.workspace.openTextDocument({
                        language: 'bash',
                        content: output,
                    });
                    await vscode.window.showTextDocument(doc, {
                        viewColumn: vscode.ViewColumn.Beside,
                        preview: false,
                    });
                }
                else {
                    vscode.window.showInformationMessage('Command executed successfully (no output)');
                }
            }
            catch (error) {
                vscode.window.showErrorMessage(`Failed to execute command: ${error}`);
            }
        });
    }));
}
//# sourceMappingURL=toolBash.js.map