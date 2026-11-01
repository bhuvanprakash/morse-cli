"use strict";
/**
 * Tool Fetch Command - Make HTTP requests via morse-cli
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
exports.registerToolFetchCommand = registerToolFetchCommand;
const vscode = __importStar(require("vscode"));
function registerToolFetchCommand(context, client) {
    context.subscriptions.push(vscode.commands.registerCommand('morse.toolFetch', async () => {
        const url = await vscode.window.showInputBox({
            prompt: 'Enter URL to fetch',
            placeHolder: 'e.g., https://api.github.com/users/octocat',
        });
        if (!url) {
            return;
        }
        const method = await vscode.window.showInputBox({
            prompt: 'Enter HTTP method',
            placeHolder: 'GET, POST, PUT, DELETE (default: GET)',
            value: 'GET',
        }) || 'GET';
        let body = '';
        if (method === 'POST' || method === 'PUT') {
            body = await vscode.window.showInputBox({
                prompt: 'Enter request body (JSON)',
                placeHolder: '{"key": "value"}',
            }) || '';
        }
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Fetching: ${url}`,
            cancellable: true,
        }, async (progress, token) => {
            try {
                let output = '';
                for await (const chunk of client.streamToolExecution('fetch', {
                    url,
                    method: method,
                    body: body || undefined,
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
                            vscode.window.showErrorMessage(`Fetch failed: ${chunk.error}`);
                        }
                    }
                }
                // Show result
                if (output) {
                    const doc = await vscode.workspace.openTextDocument({
                        language: 'json',
                        content: output,
                    });
                    await vscode.window.showTextDocument(doc, {
                        viewColumn: vscode.ViewColumn.Beside,
                        preview: false,
                    });
                }
                else {
                    vscode.window.showInformationMessage('No response received');
                }
            }
            catch (error) {
                vscode.window.showErrorMessage(`Failed to fetch: ${error}`);
            }
        });
    }));
}
//# sourceMappingURL=toolFetch.js.map