"use strict";
/**
 * Local Open Command
 * Opens files in the local editor (VS Code or system default)
 * Similar to Kilo Code's "local open" feature
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
exports.localOpen = localOpen;
exports.openDirectory = openDirectory;
exports.registerLocalOpenCommand = registerLocalOpenCommand;
const vscode = __importStar(require("vscode"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const path = __importStar(require("path"));
const execAsync = (0, util_1.promisify)(child_process_1.exec);
/**
 * Open a file in VS Code or fallback to system default
 */
async function localOpen(options) {
    const { filePath, line, column = 0, fallbackToSystem = true } = options;
    // First try to open in VS Code
    try {
        const success = await openInVSCode(filePath, line, column);
        if (success)
            return true;
    }
    catch (error) {
        console.log('[LocalOpen] VS Code open failed, trying fallback:', error);
    }
    // Fallback to system default if enabled
    if (fallbackToSystem) {
        try {
            await openWithSystemDefault(filePath);
            return true;
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to open file: ${filePath}`);
            console.error('[LocalOpen] System open failed:', error);
        }
    }
    return false;
}
/**
 * Open file in VS Code
 */
async function openInVSCode(filePath, line, column = 0) {
    // Check if path is absolute
    const absolutePath = path.isAbsolute(filePath)
        ? filePath
        : path.join(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '', filePath);
    const uri = vscode.Uri.file(absolutePath);
    // Check if file exists
    try {
        await vscode.workspace.fs.stat(uri);
    }
    catch {
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
        editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
    }
    return true;
}
/**
 * Open file with system default application
 */
async function openWithSystemDefault(filePath) {
    const platform = process.platform;
    let command;
    // Ensure absolute path
    const absolutePath = path.isAbsolute(filePath)
        ? filePath
        : path.join(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '', filePath);
    // Escape quotes in path
    const escapedPath = absolutePath.replace(/"/g, '\\"');
    switch (platform) {
        case 'darwin':
            command = `open "${escapedPath}"`;
            break;
        case 'win32':
            command = `start "" "${escapedPath}"`;
            break;
        case 'linux':
            command = `xdg-open "${escapedPath}"`;
            break;
        default:
            throw new Error(`Unsupported platform: ${platform}`);
    }
    await execAsync(command);
}
/**
 * Open a directory in file explorer/finder
 */
async function openDirectory(dirPath) {
    const platform = process.platform;
    let command;
    const absolutePath = path.isAbsolute(dirPath)
        ? dirPath
        : path.join(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '', dirPath);
    const escapedPath = absolutePath.replace(/"/g, '\\"');
    switch (platform) {
        case 'darwin':
            command = `open "${escapedPath}"`;
            break;
        case 'win32':
            command = `explorer "${escapedPath}"`;
            break;
        case 'linux':
            command = `xdg-open "${escapedPath}"`;
            break;
        default:
            vscode.window.showErrorMessage(`Opening directories not supported on ${platform}`);
            return false;
    }
    try {
        await execAsync(command);
        return true;
    }
    catch (error) {
        vscode.window.showErrorMessage(`Failed to open directory: ${dirPath}`);
        console.error('[LocalOpen] Directory open failed:', error);
        return false;
    }
}
/**
 * Register the local open command
 */
function registerLocalOpenCommand(context) {
    const disposable = vscode.commands.registerCommand('morse.localOpen', async (filePath, line, column) => {
        await localOpen({ filePath, line, column });
    });
    context.subscriptions.push(disposable);
    // Also register open directory command
    const openDirDisposable = vscode.commands.registerCommand('morse.openDirectory', async (dirPath) => {
        await openDirectory(dirPath);
    });
    context.subscriptions.push(openDirDisposable);
}
//# sourceMappingURL=localOpen.js.map