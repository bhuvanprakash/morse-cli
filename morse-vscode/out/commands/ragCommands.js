"use strict";
/**
 * RAG Commands for Morse VS Code Extension
 * Registers all RAG-related commands for the extension
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
exports.registerRAGCommands = registerRAGCommands;
const vscode = __importStar(require("vscode"));
const client_1 = require("../rag/client");
/**
 * Register all RAG-related commands
 */
function registerRAGCommands(context) {
    const ragClient = (0, client_1.getRAGClient)();
    // morse.rag.init - Initialize RAG for project
    context.subscriptions.push(vscode.commands.registerCommand('morse.rag.init', async () => {
        try {
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Initializing RAG Index',
                cancellable: false,
            }, async (progress) => {
                progress.report({ message: 'Indexing codebase...' });
                const result = await ragClient.init();
                vscode.window.showInformationMessage(`RAG Index initialized: ${result.files} files, ${result.chunks} chunks`);
            });
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to initialize RAG: ${error}`);
        }
    }));
    // morse.rag.refresh - Refresh knowledge base
    context.subscriptions.push(vscode.commands.registerCommand('morse.rag.refresh', async () => {
        try {
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Refreshing RAG Index',
                cancellable: false,
            }, async (progress) => {
                progress.report({ message: 'Checking for modified files...' });
                const result = await ragClient.refresh();
                if (result.updated === 0 && result.removed === 0) {
                    vscode.window.showInformationMessage('No modified files since last index');
                }
                else {
                    vscode.window.showInformationMessage(`RAG refreshed: ${result.updated} updated, ${result.removed} removed`);
                }
            });
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to refresh RAG: ${error}`);
        }
    }));
    // morse.rag.status - Show RAG status
    context.subscriptions.push(vscode.commands.registerCommand('morse.rag.status', async () => {
        try {
            const status = await ragClient.status();
            const panel = vscode.window.createWebviewPanel('morse.ragStatus', 'RAG Status', vscode.ViewColumn.One, { enableScripts: true });
            panel.webview.html = generateStatusHtml(status);
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to get RAG status: ${error}`);
        }
    }));
    // morse.rag.files - List indexed files
    context.subscriptions.push(vscode.commands.registerCommand('morse.rag.files', async () => {
        try {
            const files = await ragClient.files();
            if (files.length === 0) {
                vscode.window.showInformationMessage('No indexed files. Run "Morse: Initialize RAG" first.');
                return;
            }
            const panel = vscode.window.createWebviewPanel('morse.ragFiles', 'RAG Indexed Files', vscode.ViewColumn.One, { enableScripts: true });
            panel.webview.html = generateFilesHtml(files);
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to list files: ${error}`);
        }
    }));
    // morse.rag.add - Add files to index
    context.subscriptions.push(vscode.commands.registerCommand('morse.rag.add', async () => {
        try {
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (!workspaceRoot) {
                vscode.window.showErrorMessage('No workspace folder open');
                return;
            }
            const files = await vscode.window.showOpenDialog({
                title: 'Select files to add to RAG index',
                canSelectMany: true,
                defaultUri: vscode.Uri.file(workspaceRoot),
            });
            if (files && files.length > 0) {
                const filePaths = files.map(f => f.fsPath);
                const result = await ragClient.add(filePaths);
                vscode.window.showInformationMessage(`Added ${result.added} files to RAG index`);
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to add files: ${error}`);
        }
    }));
    // morse.rag.remove - Remove files from index
    context.subscriptions.push(vscode.commands.registerCommand('morse.rag.remove', async () => {
        try {
            const files = await ragClient.files();
            if (files.length === 0) {
                vscode.window.showInformationMessage('No indexed files to remove');
                return;
            }
            const selected = await vscode.window.showQuickPick(files.map(f => f.path), {
                canPickMany: true,
                title: 'Select files to remove from RAG index',
            });
            if (selected && selected.length > 0) {
                const result = await ragClient.remove(selected);
                vscode.window.showInformationMessage(`Removed ${result.removed} files from RAG index`);
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to remove files: ${error}`);
        }
    }));
    // morse.rag.search - Semantic search
    context.subscriptions.push(vscode.commands.registerCommand('morse.rag.search', async () => {
        try {
            const query = await vscode.window.showInputBox({
                prompt: 'Enter search query',
                placeHolder: 'What code are you looking for?',
            });
            if (!query || !query.trim()) {
                return;
            }
            const topKStr = await vscode.window.showInputBox({
                prompt: 'Number of results',
                placeHolder: '5',
                value: '5',
            });
            const topK = parseInt(topKStr || '5', 10);
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Searching RAG Index',
                cancellable: false,
            }, async (progress) => {
                progress.report({ message: `Searching for "${query}"...` });
                const results = await ragClient.search(query, topK);
                if (results.length === 0) {
                    vscode.window.showInformationMessage(`No results found for "${query}"`);
                    return;
                }
                const panel = vscode.window.createWebviewPanel('morse.ragSearch', 'RAG Search Results', vscode.ViewColumn.One, { enableScripts: true });
                panel.webview.html = generateSearchResultsHtml(query, results);
            });
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to search: ${error}`);
        }
    }));
    // morse.rag.clear - Clear knowledge base
    context.subscriptions.push(vscode.commands.registerCommand('morse.rag.clear', async () => {
        try {
            const answer = await vscode.window.showWarningMessage('Clear RAG index? This removes all indexed chunks. This cannot be undone.', { modal: true }, 'Clear', 'Cancel');
            if (answer === 'Clear') {
                await ragClient.clear();
                vscode.window.showInformationMessage('RAG index cleared');
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to clear RAG: ${error}`);
        }
    }));
    // morse.rag.show - Show RAG panel
    context.subscriptions.push(vscode.commands.registerCommand('morse.rag.show', async () => {
        try {
            const panel = vscode.window.createWebviewPanel('morse.ragPanel', 'RAG Knowledge Base', vscode.ViewColumn.One, { enableScripts: true });
            const status = await ragClient.status();
            const files = await ragClient.files();
            panel.webview.html = generateRAGPanelHtml(status, files);
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to show RAG panel: ${error}`);
        }
    }));
    // morse.rag.output - Show RAG output
    context.subscriptions.push(vscode.commands.registerCommand('morse.rag.output', () => {
        ragClient.showOutput();
    }));
    return {
        init: async () => vscode.commands.executeCommand('morse.rag.init'),
        refresh: async () => vscode.commands.executeCommand('morse.rag.refresh'),
        status: async () => ragClient.status(),
        files: async () => ragClient.files(),
        add: async (files) => ragClient.add(files),
        remove: async (files) => ragClient.remove(files),
        search: async (query, topK) => ragClient.search(query, topK || 5),
        clear: async () => vscode.commands.executeCommand('morse.rag.clear'),
        showPanel: async () => vscode.commands.executeCommand('morse.rag.show'),
    };
}
// HTML Generators
function generateStatusHtml(status) {
    const statusColor = status.status === 'active' ? '#4caf50' : status.status === 'stale' ? '#ff9800' : '#f44336';
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; }
        h1 { font-size: 18px; margin-bottom: 20px; }
        .status-card { background: #1e1e1e; border-radius: 8px; padding: 16px; }
        .status-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #333; }
        .status-row:last-child { border-bottom: none; }
        .label { color: #888; }
        .value { color: #fff; font-weight: 500; }
        .status-indicator { display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${statusColor}; margin-right: 8px; }
    </style>
</head>
<body>
    <h1>📚 RAG Index Status</h1>
    <div class="status-card">
        <div class="status-row">
            <span class="label">Status</span>
            <span class="value"><span class="status-indicator"></span>${status.status === 'not_initialized' ? 'Not Initialized' : status.status === 'active' ? 'Active' : 'Stale'}</span>
        </div>
        <div class="status-row">
            <span class="label">Freshness</span>
            <span class="value">${status.freshness}</span>
        </div>
        <div class="status-row">
            <span class="label">Files</span>
            <span class="value">${status.fileCount}</span>
        </div>
        <div class="status-row">
            <span class="label">Chunks</span>
            <span class="value">${status.chunkCount}</span>
        </div>
        <div class="status-row">
            <span class="label">Index Size</span>
            <span class="value">${status.indexSize}</span>
        </div>
        <div class="status-row">
            <span class="label">Last Updated</span>
            <span class="value">${status.lastUpdated}</span>
        </div>
        <div class="status-row">
            <span class="label">Embedder</span>
            <span class="value">${status.embedder}</span>
        </div>
    </div>
</body>
</html>`;
}
function generateFilesHtml(files) {
    const fileList = files.map(f => `<li>${f.path}</li>`).join('');
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; }
        h1 { font-size: 18px; margin-bottom: 20px; }
        ul { list-style: none; padding: 0; }
        li { padding: 6px 12px; background: #1e1e1e; border-radius: 4px; margin-bottom: 4px; font-family: monospace; font-size: 13px; }
    </style>
</head>
<body>
    <h1>📁 Indexed Files (${files.length})</h1>
    <ul>${fileList}</ul>
</body>
</html>`;
}
function generateSearchResultsHtml(query, results) {
    const resultsHtml = results.map((r, i) => `
        <div class="result">
            <div class="result-header">${i + 1}. ${r.filePath}:${r.startLine}-${r.endLine}</div>
            <pre class="result-content">${escapeHtml(r.content)}</pre>
        </div>
    `).join('');
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; }
        h1 { font-size: 18px; margin-bottom: 20px; }
        .result { background: #1e1e1e; border-radius: 8px; padding: 16px; margin-bottom: 12px; }
        .result-header { color: #4fc3f7; font-weight: 500; margin-bottom: 8px; font-family: monospace; }
        .result-content { color: #ccc; font-size: 13px; white-space: pre-wrap; word-break: break-all; margin: 0; }
    </style>
</head>
<body>
    <h1>🔍 Search Results for "${escapeHtml(query)}" (${results.length})</h1>
    ${resultsHtml}
</body>
</html>`;
}
function generateRAGPanelHtml(status, files) {
    const statusColor = status.status === 'active' ? '#4caf50' : status.status === 'stale' ? '#ff9800' : '#f44336';
    const fileList = files.slice(0, 50).map(f => `<li>${f.path}</li>`).join('');
    const moreFiles = files.length > 50 ? `<li class="more">... and ${files.length - 50} more</li>` : '';
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; }
        h1 { font-size: 18px; margin-bottom: 20px; }
        h2 { font-size: 14px; color: #888; margin-top: 24px; margin-bottom: 12px; }
        .status-card { background: #1e1e1e; border-radius: 8px; padding: 16px; }
        .status-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #333; }
        .status-row:last-child { border-bottom: none; }
        .label { color: #888; }
        .value { color: #fff; font-weight: 500; }
        .status-indicator { display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${statusColor}; margin-right: 8px; }
        ul { list-style: none; padding: 0; }
        li { padding: 6px 12px; background: #1e1e1e; border-radius: 4px; margin-bottom: 4px; font-family: monospace; font-size: 13px; }
        li.more { color: #888; font-style: italic; }
        .actions { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 20px; }
        button { padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; font-size: 13px; }
        .btn-primary { background: #0078d4; color: white; }
        .btn-secondary { background: #333; color: white; }
    </style>
</head>
<body>
    <h1>📚 RAG Knowledge Base</h1>
    
    <div class="actions">
        <button class="btn-primary" onclick="vscode.postMessage({command: 'init'})">Initialize</button>
        <button class="btn-secondary" onclick="vscode.postMessage({command: 'refresh'})">Refresh</button>
        <button class="btn-secondary" onclick="vscode.postMessage({command: 'search'})">Search</button>
        <button class="btn-secondary" onclick="vscode.postMessage({command: 'clear'})">Clear</button>
    </div>
    
    <h2>Status</h2>
    <div class="status-card">
        <div class="status-row">
            <span class="label">Status</span>
            <span class="value"><span class="status-indicator"></span>${status.status === 'not_initialized' ? 'Not Initialized' : status.status === 'active' ? 'Active' : 'Stale'}</span>
        </div>
        <div class="status-row">
            <span class="label">Files</span>
            <span class="value">${status.fileCount}</span>
        </div>
        <div class="status-row">
            <span class="label">Chunks</span>
            <span class="value">${status.chunkCount}</span>
        </div>
        <div class="status-row">
            <span class="label">Last Updated</span>
            <span class="value">${status.lastUpdated}</span>
        </div>
    </div>
    
    <h2>Indexed Files (${files.length})</h2>
    <ul>${fileList}${moreFiles}</ul>
    
    <script>
        const vscode = acquireVsCodeApi();
    </script>
</body>
</html>`;
}
function escapeHtml(text) {
    return text
        .replace(/&/g, '&')
        .replace(/</g, '<')
        .replace(/>/g, '>')
        .replace(/"/g, '"')
        .replace(/'/g, '&#039;');
}
//# sourceMappingURL=ragCommands.js.map