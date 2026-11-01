"use strict";
/**
 * Memory Commands for Morse VS Code Extension
 * Registers all memory-related commands for the extension
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
exports.registerMemoryCommands = registerMemoryCommands;
const vscode = __importStar(require("vscode"));
const client_1 = require("../memory/client");
/**
 * Register all memory-related commands
 */
function registerMemoryCommands(context) {
    const memoryClient = (0, client_1.getMemoryClient)();
    // Show memory command
    context.subscriptions.push(vscode.commands.registerCommand('morse.memory.show', async () => {
        try {
            const state = await memoryClient.show();
            if (!state.content || state.content.trim() === '') {
                vscode.window.showInformationMessage('Memory is empty. Start chatting and morse will learn your project.');
                return;
            }
            // Show memory in a new panel
            const panel = vscode.window.createWebviewPanel('morse.memoryView', 'Project Memory', vscode.ViewColumn.One, { enableScripts: true });
            panel.webview.html = generateMemoryViewHtml(state);
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to show memory: ${error}`);
        }
    }));
    // Append to memory command
    context.subscriptions.push(vscode.commands.registerCommand('morse.memory.append', async () => {
        try {
            const content = await vscode.window.showInputBox({
                prompt: 'Enter note to append to memory',
                placeHolder: 'What should Morse remember?',
            });
            if (content && content.trim()) {
                await memoryClient.append(content);
                vscode.window.showInformationMessage('Added note to memory');
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to append to memory: ${error}`);
        }
    }));
    // Edit memory command
    context.subscriptions.push(vscode.commands.registerCommand('morse.memory.edit', async () => {
        try {
            const state = await memoryClient.show();
            const newContent = await vscode.window.showInputBox({
                prompt: 'Edit memory content',
                value: state.content,
                valueSelection: [0, state.content.length],
            });
            if (newContent !== undefined) {
                await memoryClient.edit(newContent);
                vscode.window.showInformationMessage('Memory updated');
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to edit memory: ${error}`);
        }
    }));
    // Clear memory command
    context.subscriptions.push(vscode.commands.registerCommand('morse.memory.clear', async () => {
        try {
            const answer = await vscode.window.showWarningMessage('Clear all project memory? This cannot be undone.', { modal: true }, 'Clear', 'Cancel');
            if (answer === 'Clear') {
                await memoryClient.clear();
                vscode.window.showInformationMessage('Memory cleared');
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to clear memory: ${error}`);
        }
    }));
    // List memory entries command
    context.subscriptions.push(vscode.commands.registerCommand('morse.memory.list', async () => {
        try {
            const entries = await memoryClient.list();
            if (entries.length === 0) {
                vscode.window.showInformationMessage('No memory entries found');
                return;
            }
            // Show entries in a quick pick
            const items = entries.map(entry => ({
                label: entry.content.substring(0, 50) + (entry.content.length > 50 ? '...' : ''),
                description: new Date(entry.timestamp).toLocaleString(),
                detail: entry.content,
            }));
            const selected = await vscode.window.showQuickPick(items, {
                matchOnDescription: true,
                matchOnDetail: true,
            });
            if (selected) {
                // Copy to clipboard
                await vscode.env.clipboard.writeText(selected.detail || '');
                vscode.window.showInformationMessage('Copied to clipboard');
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to list memory: ${error}`);
        }
    }));
    // Search memory command
    context.subscriptions.push(vscode.commands.registerCommand('morse.memory.search', async () => {
        try {
            const query = await vscode.window.showInputBox({
                prompt: 'Search memory',
                placeHolder: 'Enter search term',
            });
            if (query && query.trim()) {
                const entries = await memoryClient.search(query);
                if (entries.length === 0) {
                    vscode.window.showInformationMessage(`No results found for "${query}"`);
                    return;
                }
                // Show results
                const items = entries.map(entry => ({
                    label: entry.content.substring(0, 50) + (entry.content.length > 50 ? '...' : ''),
                    description: new Date(entry.timestamp).toLocaleString(),
                    detail: entry.content,
                }));
                await vscode.window.showQuickPick(items, {
                    matchOnDescription: true,
                    matchOnDetail: true,
                });
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to search memory: ${error}`);
        }
    }));
    // Open memory in editor command
    context.subscriptions.push(vscode.commands.registerCommand('morse.memory.openEditor', async () => {
        try {
            await memoryClient.openInEditor();
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to open memory: ${error}`);
        }
    }));
    // Toggle global memory command
    context.subscriptions.push(vscode.commands.registerCommand('morse.memory.toggleGlobal', async () => {
        try {
            const client = (0, client_1.getMemoryClient)();
            const newState = !client.getIsGlobal();
            client.setGlobalMemory(newState);
            vscode.window.showInformationMessage(newState
                ? 'Switched to global memory (across all projects)'
                : 'Switched to project memory (current project only)');
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to toggle memory mode: ${error}`);
        }
    }));
    // Sync memory command
    context.subscriptions.push(vscode.commands.registerCommand('morse.memory.sync', async () => {
        try {
            const status = await memoryClient.getSyncStatus();
            if (!status.cliAvailable) {
                vscode.window.showWarningMessage('Morse CLI not found. Memory changes will be saved locally.');
            }
            else {
                vscode.window.showInformationMessage(status.synced
                    ? 'Memory synced with CLI'
                    : 'Memory synced (file-based)');
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to sync memory: ${error}`);
        }
    }));
    // Update current focus command
    context.subscriptions.push(vscode.commands.registerCommand('morse.memory.setFocus', async () => {
        try {
            const focus = await vscode.window.showInputBox({
                prompt: 'Set current focus',
                placeHolder: 'What are you working on?',
            });
            if (focus && focus.trim()) {
                await memoryClient.updateSection('Current Focus', focus);
                vscode.window.showInformationMessage('Current focus updated');
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to set focus: ${error}`);
        }
    }));
    // Return commands interface for external use
    return {
        show: async () => vscode.commands.executeCommand('morse.memory.show'),
        append: async (content) => {
            await memoryClient.append(content);
        },
        edit: async (content) => {
            await memoryClient.edit(content);
        },
        clear: async () => vscode.commands.executeCommand('morse.memory.clear'),
        list: async () => memoryClient.list(),
        search: async (query) => memoryClient.search(query),
        openEditor: async () => vscode.commands.executeCommand('morse.memory.openEditor'),
        toggleGlobal: () => {
            const client = (0, client_1.getMemoryClient)();
            client.setGlobalMemory(!client.getIsGlobal());
        },
    };
}
/**
 * Generate HTML for memory view webview
 */
function generateMemoryViewHtml(state) {
    const lastUpdated = new Date(state.lastUpdated).toLocaleString();
    const tokenPercent = Math.min(100, Math.round((state.tokenCount / 4000) * 100));
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
        }
        h1 {
            font-size: 1.5em;
            margin-bottom: 10px;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .header {
            color: var(--vscode-descriptionForeground);
            margin-bottom: 20px;
            padding: 10px;
            background: var(--vscode-editor-inactiveSelectionBackground);
            border-radius: 5px;
        }
        .memory-content {
            white-space: pre-wrap;
            font-family: var(--vscode-editor-font-family);
            line-height: 1.5;
            padding: 15px;
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-editorLineNumber-foreground);
            border-radius: 5px;
            max-height: 70vh;
            overflow-y: auto;
        }
        .entries {
            margin-top: 20px;
        }
        .entry {
            padding: 10px;
            margin-bottom: 10px;
            background: var(--vscode-editor-inactiveSelectionBackground);
            border-radius: 5px;
            border-left: 3px solid var(--vscode-progressBar-background);
        }
        .entry-timestamp {
            font-size: 0.8em;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 5px;
        }
        .entry-content {
            white-space: pre-wrap;
        }
        .footer {
            margin-top: 20px;
            padding: 10px;
            color: var(--vscode-descriptionForeground);
            font-size: 0.9em;
        }
        .progress-bar {
            height: 8px;
            background: var(--vscode-editor-inactiveSelectionBackground);
            border-radius: 4px;
            overflow: hidden;
            margin-top: 5px;
        }
        .progress-fill {
            height: 100%;
            background: var(--vscode-progressBar-background);
            transition: width 0.3s;
        }
        .global-badge {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            padding: 2px 8px;
            border-radius: 3px;
            font-size: 0.7em;
        }
    </style>
</head>
<body>
    <h1>
        📚 Project Memory
        ${state.isGlobal ? '<span class="global-badge">GLOBAL</span>' : ''}
    </h1>
    
    <div class="header">
        <div>Last updated: ${lastUpdated}</div>
        <div style="margin-top: 10px;">
            Size: ${state.tokenCount.toLocaleString()} / 4,000 tokens (${tokenPercent}%)
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${tokenPercent}%"></div>
            </div>
        </div>
    </div>

    <h2>Full Memory</h2>
    <div class="memory-content">${escapeHtml(state.content)}</div>

    ${state.entries.length > 0 ? `
    <div class="entries">
        <h2>Recent Entries (${state.entries.length})</h2>
        ${state.entries.slice(0, 10).map(entry => `
            <div class="entry">
                <div class="entry-timestamp">${new Date(entry.timestamp).toLocaleString()}</div>
                <div class="entry-content">${escapeHtml(entry.content)}</div>
            </div>
        `).join('')}
    </div>
    ` : ''}

    <div class="footer">
        <p>Edit this file directly or use VS Code commands to modify memory.</p>
    </div>

    <script>
        // Handle copy functionality
        function copyToClipboard() {
            navigator.clipboard.writeText(document.querySelector('.memory-content').textContent);
            alert('Copied to clipboard!');
        }
    </script>
</body>
</html>`;
}
/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
    return text
        .replace(/&/g, '&')
        .replace(/</g, '<')
        .replace(/>/g, '>')
        .replace(/"/g, '"')
        .replace(/'/g, '&#039;');
}
//# sourceMappingURL=memoryCommands.js.map