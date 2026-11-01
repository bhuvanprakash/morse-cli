/**
 * Local Open Command
 * Opens files in the local editor (VS Code or system default)
 * Similar to Kilo Code's "local open" feature
 */

import * as vscode from 'vscode';
import { spawn } from 'child_process';
import * as path from 'path';

export interface OpenOptions {
    filePath: string;
    line?: number;
    column?: number;
    fallbackToSystem?: boolean;
}

/**
 * Open a file in VS Code or fallback to system default
 */
export async function localOpen(options: OpenOptions): Promise<boolean> {
    const { filePath, line, column = 0, fallbackToSystem = true } = options;

    // First try to open in VS Code
    try {
        const success = await openInVSCode(filePath, line, column);
        if (success) return true;
    } catch (error) {
        console.log('[LocalOpen] VS Code open failed, trying fallback:', error);
    }

    // Fallback to system default if enabled
    if (fallbackToSystem) {
        try {
            await openWithSystemDefault(filePath);
            return true;
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to open file: ${filePath}`);
            console.error('[LocalOpen] System open failed:', error);
        }
    }

    return false;
}

/**
 * Open file in VS Code
 */
async function openInVSCode(filePath: string, line?: number, column: number = 0): Promise<boolean> {
    // Check if path is absolute
    const absolutePath = path.isAbsolute(filePath)
        ? filePath
        : path.join(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '', filePath);

    const uri = vscode.Uri.file(absolutePath);

    // Check if file exists
    try {
        await vscode.workspace.fs.stat(uri);
    } catch {
        throw new Error(`File not found: ${absolutePath}`);
    }

    // Open the document
    const document = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(document, {
        preview: false,
        preserveFocus: false,
    });

    // Navigate to specific line if provided
    if (line !== undefined && line > 0) {
        const position = new vscode.Position(line - 1, column);
        editor.selection = new vscode.Selection(position, position);
        editor.revealRange(
            new vscode.Range(position, position),
            vscode.TextEditorRevealType.InCenter
        );
    }

    return true;
}

/**
 * Open file with system default application
 */
async function openWithSystemDefault(filePath: string): Promise<void> {
    const platform = process.platform;
    let command: string;
    let args: string[] = [];

    // Ensure absolute path
    const absolutePath = path.isAbsolute(filePath)
        ? filePath
        : path.join(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '', filePath);

    switch (platform) {
        case 'darwin':
            command = 'open';
            args = [absolutePath];
            break;
        case 'win32':
            command = 'cmd';
            args = ['/c', 'start', '', absolutePath];
            break;
        case 'linux':
            command = 'xdg-open';
            args = [absolutePath];
            break;
        default:
            throw new Error(`Unsupported platform: ${platform}`);
    }

    await spawnPromise(command, args);
}

/**
 * Open a directory in file explorer/finder
 */
export async function openDirectory(dirPath: string): Promise<boolean> {
    const platform = process.platform;
    let command: string;
    let args: string[] = [];

    const absolutePath = path.isAbsolute(dirPath)
        ? dirPath
        : path.join(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '', dirPath);

    switch (platform) {
        case 'darwin':
            command = 'open';
            args = [absolutePath];
            break;
        case 'win32':
            command = 'explorer';
            args = [absolutePath];
            break;
        case 'linux':
            command = 'xdg-open';
            args = [absolutePath];
            break;
        default:
            vscode.window.showErrorMessage(`Opening directories not supported on ${platform}`);
            return false;
    }

    try {
        await spawnPromise(command, args);
        return true;
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to open directory: ${dirPath}`);
        console.error('[LocalOpen] Directory open failed:', error);
        return false;
    }
}

/**
 * Register the local open command
 */
export function registerLocalOpenCommand(context: vscode.ExtensionContext): void {
    const disposable = vscode.commands.registerCommand(
        'morse.localOpen',
        async (filePath: string, line?: number, column?: number) => {
            await localOpen({ filePath, line, column });
        }
    );

    context.subscriptions.push(disposable);

    // Also register open directory command
    const openDirDisposable = vscode.commands.registerCommand(
        'morse.openDirectory',
        async (dirPath: string) => {
            await openDirectory(dirPath);
        }
    );

    context.subscriptions.push(openDirDisposable);
}

// spawnPromise wraps child_process.spawn in a Promise
function spawnPromise(command: string, args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args);
        child.on('error', (err) => reject(err));
        child.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Command ${command} exited with code ${code}`));
            }
        });
    });
}
