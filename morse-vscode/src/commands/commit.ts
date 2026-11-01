/**
 * Commit command - generate commit message from changes
 */

import * as vscode from 'vscode';
import { MorseClient } from '../morse/client';
import { spawn } from 'child_process';

export function registerCommitCommand(context: vscode.ExtensionContext, client: MorseClient): void {
    context.subscriptions.push(
        vscode.commands.registerCommand('morse.generateCommit', async () => {
            try {
                const diff = await getGitDiff();

                if (!diff) {
                    vscode.window.showWarningMessage('No changes to commit');
                    return;
                }

                if (diff.length > 50000) {
                    const proceed = await vscode.window.showWarningMessage(
                        'Diff is very large. This may take a while. Continue?',
                        'Yes',
                        'No'
                    );
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

                        const selected = await vscode.window.showInformationMessage(
                            `Generated commit message:\n\n${message}`,
                            { modal: true },
                            'Use Message',
                            'Copy to Clipboard',
                            'Edit & Commit'
                        );

                        if (selected === 'Use Message') {
                            await commitChanges(message);
                            vscode.window.showInformationMessage('Changes committed successfully');
                        } else if (selected === 'Copy to Clipboard') {
                            await vscode.env.clipboard.writeText(message);
                            vscode.window.showInformationMessage('Commit message copied to clipboard');
                        } else if (selected === 'Edit & Commit') {
                            const edited = await vscode.window.showInputBox({
                                prompt: 'Edit commit message (use \\n for new lines)',
                                value: message,
                            });
                            if (edited) {
                                await commitChanges(edited);
                                vscode.window.showInformationMessage('Changes committed successfully');
                            }
                        }

                    } catch (err) {
                        const msg = err instanceof Error ? err.message : 'Unknown error';
                        vscode.window.showErrorMessage(`Commit generation failed: ${msg}`);
                    }
                });

            } catch (err) {
                vscode.window.showErrorMessage('Failed to get git diff. Are you in a git repository?');
            }
        })
    );
}

async function getGitDiff(): Promise<string> {
    return new Promise((resolve, reject) => {
        const git = spawn('git', ['diff', '--cached']);
        let stdout = '';
        let stderr = '';
        git.stdout.on('data', (data) => { stdout += data.toString(); });
        git.stderr.on('data', (data) => { stderr += data.toString(); });
        git.on('close', (code) => {
            if (code === 0) {
                if (stdout.trim()) {
                    resolve(stdout);
                } else {
                    // Try unstaged
                    getUnstagedDiff().then(resolve).catch(reject);
                }
            } else {
                reject(new Error(`git diff failed: ${stderr}`));
            }
        });
        git.on('error', (err) => {
            reject(err);
        });
    });
}

async function getUnstagedDiff(): Promise<string> {
    return new Promise((resolve, reject) => {
        const git = spawn('git', ['diff']);
        let stdout = '';
        let stderr = '';
        git.stdout.on('data', (data) => { stdout += data.toString(); });
        git.stderr.on('data', (data) => { stderr += data.toString(); });
        git.on('close', (code) => {
            if (code === 0) {
                resolve(stdout);
            } else {
                reject(new Error(`git diff failed: ${stderr}`));
            }
        });
        git.on('error', (err) => {
            reject(err);
        });
    });
}

async function commitChanges(message: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const git = spawn('git', ['commit', '-m', message]);
        git.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`git commit failed with code ${code}`));
            }
        });
        git.on('error', (err) => {
            reject(err);
        });
    });
}
