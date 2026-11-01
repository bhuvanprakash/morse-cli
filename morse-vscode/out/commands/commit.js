"use strict";
/**
 * Commit command - generate commit message from changes
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
exports.registerCommitCommand = registerCommitCommand;
const vscode = __importStar(require("vscode"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
function registerCommitCommand(context, client) {
    context.subscriptions.push(vscode.commands.registerCommand('morse.generateCommit', async () => {
        try {
            const diff = await getGitDiff();
            if (!diff) {
                vscode.window.showWarningMessage('No changes to commit');
                return;
            }
            if (diff.length > 50000) {
                const proceed = await vscode.window.showWarningMessage('Diff is very large. This may take a while. Continue?', 'Yes', 'No');
                if (proceed !== 'Yes') {
                    return;
                }
            }
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Morse is generating commit message...',
                cancellable: true,
            }, async (_progress, token) => {
                try {
                    const result = await client.generateCommit({
                        diff,
                        conventional: true,
                    });
                    if (token.isCancellationRequested) {
                        return;
                    }
                    const message = result.description
                        ? `${result.message}\n\n${result.description}`
                        : result.message;
                    const selected = await vscode.window.showInformationMessage(`Generated commit message:\n\n${message}`, { modal: true }, 'Use Message', 'Copy to Clipboard', 'Edit & Commit');
                    if (selected === 'Use Message') {
                        await commitChanges(message);
                        vscode.window.showInformationMessage('Changes committed successfully');
                    }
                    else if (selected === 'Copy to Clipboard') {
                        await vscode.env.clipboard.writeText(message);
                        vscode.window.showInformationMessage('Commit message copied to clipboard');
                    }
                    else if (selected === 'Edit & Commit') {
                        const edited = await vscode.window.showInputBox({
                            prompt: 'Edit commit message (use \\n for new lines)',
                            value: message,
                        });
                        if (edited) {
                            await commitChanges(edited);
                            vscode.window.showInformationMessage('Changes committed successfully');
                        }
                    }
                }
                catch (err) {
                    const msg = err instanceof Error ? err.message : 'Unknown error';
                    vscode.window.showErrorMessage(`Commit generation failed: ${msg}`);
                }
            });
        }
        catch (err) {
            vscode.window.showErrorMessage('Failed to get git diff. Are you in a git repository?');
        }
    }));
}
async function getGitDiff() {
    const { stdout } = await execAsync('git diff --cached');
    if (stdout.trim()) {
        return stdout;
    }
    const { stdout: unstaged } = await execAsync('git diff');
    return unstaged;
}
async function commitChanges(message) {
    const escapedMessage = message.replace(/"/g, '\\"');
    await execAsync(`git commit -m "${escapedMessage}"`);
}
//# sourceMappingURL=commit.js.map