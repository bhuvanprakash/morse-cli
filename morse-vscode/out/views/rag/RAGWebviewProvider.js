"use strict";
/**
 * RAG Webview Provider for Morse VS Code Extension
 * Full webview panel for RAG management with visual progress and search
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
exports.RAGWebviewProvider = void 0;
const vscode = __importStar(require("vscode"));
const client_1 = require("../../rag/client");
/**
 * RAG Webview Provider for managing knowledge bases
 */
class RAGWebviewProvider {
    static viewType = 'morse.rag';
    static currentPanel;
    panel;
    ragClient;
    disposables = [];
    currentStatus = null;
    currentFiles = [];
    isIndexing = false;
    constructor(panel, extensionUri) {
        this.panel = panel;
        this.ragClient = (0, client_1.getRAGClient)();
        // Set up message handler
        this.panel.webview.onDidReceiveMessage(async (message) => {
            await this.handleMessage(message);
        }, null, this.disposables);
        // Handle panel dispose
        this.panel.onDidDispose(() => {
            this.dispose();
        }, null, this.disposables);
        // Load initial data
        this.loadData();
    }
    /**
     * Create or show the RAG webview panel
     */
    static createOrShow(extensionUri) {
        const column = vscode.window.activeTextEditor?.viewColumn;
        if (RAGWebviewProvider.currentPanel) {
            RAGWebviewProvider.currentPanel.panel.reveal(column);
            return RAGWebviewProvider.currentPanel;
        }
        const panel = vscode.window.createWebviewPanel(RAGWebviewProvider.viewType, 'RAG Knowledge Base', column || vscode.ViewColumn.One, {
            enableScripts: true,
            retainContextWhenHidden: true,
        });
        RAGWebviewProvider.currentPanel = new RAGWebviewProvider(panel, extensionUri);
        return RAGWebviewProvider.currentPanel;
    }
    /**
     * Dispose the panel
     */
    dispose() {
        RAGWebviewProvider.currentPanel = undefined;
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
    }
    /**
     * Load RAG status and files
     */
    async loadData() {
        try {
            this.currentStatus = await this.ragClient.status();
            this.currentFiles = await this.ragClient.files();
            this.updateWebview();
        }
        catch (error) {
            console.error('Failed to load RAG data:', error);
        }
    }
    /**
     * Handle messages from webview
     */
    async handleMessage(message) {
        switch (message.command) {
            case 'init':
                await this.initializeRAG();
                break;
            case 'refresh':
                await this.refreshRAG();
                break;
            case 'search':
                await this.searchRAG(message.query);
                break;
            case 'clear':
                await this.clearRAG();
                break;
            case 'addFiles':
                await this.addFiles();
                break;
            case 'removeFiles':
                await this.removeFiles(message.files);
                break;
            case 'showStatus':
                await this.showStatus();
                break;
            case 'showFiles':
                await this.showFiles();
                break;
            case 'openFile':
                await this.openFile(message.path);
                break;
        }
    }
    /**
     * Initialize RAG index
     */
    async initializeRAG() {
        if (this.isIndexing) {
            return;
        }
        this.isIndexing = true;
        this.updateWebview();
        try {
            // Set up progress callback
            this.ragClient.onProgress((progress) => {
                this.updateWebview({
                    indexing: true,
                    progress: progress,
                });
            });
            const result = await this.ragClient.init();
            vscode.window.showInformationMessage(`RAG Index initialized: ${result.files} files, ${result.chunks} chunks`);
            await this.loadData();
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to initialize RAG: ${error}`);
        }
        finally {
            this.isIndexing = false;
            this.updateWebview();
        }
    }
    /**
     * Refresh RAG index
     */
    async refreshRAG() {
        if (this.isIndexing) {
            return;
        }
        this.isIndexing = true;
        this.updateWebview();
        try {
            const result = await this.ragClient.refresh();
            if (result.updated === 0 && result.removed === 0) {
                vscode.window.showInformationMessage('No modified files since last index');
            }
            else {
                vscode.window.showInformationMessage(`RAG refreshed: ${result.updated} updated, ${result.removed} removed`);
            }
            await this.loadData();
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to refresh RAG: ${error}`);
        }
        finally {
            this.isIndexing = false;
            this.updateWebview();
        }
    }
    /**
     * Search RAG index
     */
    async searchRAG(query) {
        const searchQuery = query || await vscode.window.showInputBox({
            prompt: 'Search RAG index',
            placeHolder: 'Enter search query...',
        });
        if (!searchQuery || !searchQuery.trim()) {
            return;
        }
        try {
            const results = await this.ragClient.search(searchQuery, 10);
            if (results.length === 0) {
                vscode.window.showInformationMessage(`No results found for "${searchQuery}"`);
                return;
            }
            this.updateWebview({
                searchResults: results,
                searchQuery: searchQuery,
            });
        }
        catch (error) {
            vscode.window.showErrorMessage(`Search failed: ${error}`);
        }
    }
    /**
     * Clear RAG index
     */
    async clearRAG() {
        const answer = await vscode.window.showWarningMessage('Clear RAG index? This removes all indexed chunks.', { modal: true }, 'Clear', 'Cancel');
        if (answer !== 'Clear') {
            return;
        }
        try {
            await this.ragClient.clear();
            vscode.window.showInformationMessage('RAG index cleared');
            await this.loadData();
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to clear RAG: ${error}`);
        }
    }
    /**
     * Add files to index
     */
    async addFiles() {
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
        if (!files || files.length === 0) {
            return;
        }
        try {
            const filePaths = files.map(f => f.fsPath);
            const result = await this.ragClient.add(filePaths);
            vscode.window.showInformationMessage(`Added ${result.added} files to RAG index`);
            await this.loadData();
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to add files: ${error}`);
        }
    }
    /**
     * Remove files from index
     */
    async removeFiles(files) {
        const filesToRemove = files || await vscode.window.showQuickPick(this.currentFiles.map(f => f.path), {
            canPickMany: true,
            title: 'Select files to remove',
        });
        if (!filesToRemove || filesToRemove.length === 0) {
            return;
        }
        try {
            const result = await this.ragClient.remove(filesToRemove);
            vscode.window.showInformationMessage(`Removed ${result.removed} files from RAG index`);
            await this.loadData();
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to remove files: ${error}`);
        }
    }
    /**
     * Show RAG status
     */
    async showStatus() {
        await vscode.commands.executeCommand('morse.rag.status');
    }
    /**
     * Show indexed files
     */
    async showFiles() {
        await vscode.commands.executeCommand('morse.rag.files');
    }
    /**
     * Open a file
     */
    async openFile(filePath) {
        const document = await vscode.workspace.openTextDocument(filePath);
        await vscode.window.showTextDocument(document);
    }
    /**
     * Update webview content
     */
    updateWebview(options) {
        const status = this.currentStatus || {
            status: 'not_initialized',
            freshness: 'Not initialized',
            fileCount: 0,
            chunkCount: 0,
            indexSize: '0 B',
            lastUpdated: 'Never',
            embedder: 'Unknown',
        };
        const files = this.currentFiles;
        const indexing = options?.indexing ?? this.isIndexing;
        const progress = options?.progress;
        const searchResults = options?.searchResults;
        const searchQuery = options?.searchQuery;
        const statusColor = status.status === 'active' ? '#4caf50' : status.status === 'stale' ? '#ff9800' : '#f44336';
        const html = this.generateHtml(status, files, indexing, progress, searchResults, searchQuery);
        this.panel.webview.html = html;
    }
    /**
     * Generate HTML content
     */
    generateHtml(status, files, indexing, progress, searchResults, searchQuery) {
        const statusColor = status.status === 'active' ? '#4caf50' : status.status === 'stale' ? '#ff9800' : '#f44336';
        let searchHtml = '';
        if (searchResults && searchResults.length > 0) {
            const resultsList = searchResults.map((r, i) => `
                <div class="result" onclick="openFile('${r.filePath.replace(/\\/g, '\\\\')}')">
                    <div class="result-header">${i + 1}. ${r.filePath}:${r.startLine}-${r.endLine}</div>
                    <pre class="result-content">${this.escapeHtml(r.content)}</pre>
                </div>
            `).join('');
            searchHtml = `
                <div class="section">
                    <h2>Search Results for "${this.escapeHtml(searchQuery || '')}" (${searchResults.length})</h2>
                    ${resultsList}
                </div>
            `;
        }
        let indexingHtml = '';
        if (indexing && progress) {
            const percent = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
            indexingHtml = `
                <div class="indexing-overlay">
                    <div class="indexing-card">
                        <div class="spinner"></div>
                        <h3>${progress.status === 'complete' ? 'Indexing Complete!' : 'Indexing...'}</h3>
                        <p>${progress.message || `${progress.currentFile} (${percent}%)`}</p>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${percent}%"></div>
                        </div>
                    </div>
                </div>
            `;
        }
        const fileList = files.slice(0, 30).map(f => `<li onclick="removeFiles(['${f.path.replace(/\\/g, '\\\\')}'])">${f.path} <span class="remove">×</span></li>`).join('');
        const moreFiles = files.length > 30 ? `<li class="more">... and ${files.length - 30} more</li>` : '';
        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        * { box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            padding: 20px; 
            margin: 0;
            background: #1e1e1e;
            color: #d4d4d4;
        }
        h1 { font-size: 20px; margin: 0 0 20px 0; color: #fff; }
        h2 { font-size: 14px; color: #888; margin: 20px 0 12px 0; text-transform: uppercase; letter-spacing: 1px; }
        
        .actions { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 20px; }
        button { 
            padding: 10px 16px; 
            border: none; 
            border-radius: 6px; 
            cursor: pointer; 
            font-size: 13px;
            font-weight: 500;
            transition: all 0.2s;
        }
        .btn-primary { background: #0078d4; color: white; }
        .btn-primary:hover { background: #106ebe; }
        .btn-secondary { background: #333; color: white; }
        .btn-secondary:hover { background: #444; }
        .btn-danger { background: #d32f2f; color: white; }
        .btn-danger:hover { background: #b71c1c; }
        
        .search-box { 
            display: flex; 
            gap: 8px; 
            margin-bottom: 20px; 
        }
        .search-input { 
            flex: 1; 
            padding: 10px 14px; 
            border: 1px solid #333; 
            border-radius: 6px; 
            background: #2d2d2d;
            color: #fff;
            font-size: 14px;
        }
        .search-input:focus { outline: none; border-color: #0078d4; }
        
        .status-card { 
            background: #252526; 
            border-radius: 8px; 
            padding: 16px; 
            margin-bottom: 20px;
        }
        .status-row { 
            display: flex; 
            justify-content: space-between; 
            padding: 8px 0; 
            border-bottom: 1px solid #333; 
        }
        .status-row:last-child { border-bottom: none; }
        .label { color: #888; }
        .value { color: #fff; font-weight: 500; }
        .status-indicator { 
            display: inline-block; 
            width: 10px; 
            height: 10px; 
            border-radius: 50%; 
            background: ${statusColor}; 
            margin-right: 8px; 
        }
        
        ul { list-style: none; padding: 0; margin: 0; }
        li { 
            padding: 8px 12px; 
            background: #252526; 
            border-radius: 4px; 
            margin-bottom: 4px; 
            font-family: monospace; 
            font-size: 12px;
            cursor: pointer;
            display: flex;
            justify-content: space-between;
        }
        li:hover { background: #2d2d2d; }
        li .remove { color: #f44336; opacity: 0; transition: opacity 0.2s; }
        li:hover .remove { opacity: 1; }
        li.more { color: #888; font-style: italic; cursor: default; }
        
        .result { 
            background: #252526; 
            border-radius: 8px; 
            padding: 16px; 
            margin-bottom: 12px; 
            cursor: pointer;
        }
        .result:hover { background: #2d2d2d; }
        .result-header { 
            color: #4fc3f7; 
            font-weight: 500; 
            margin-bottom: 8px; 
            font-family: monospace; 
        }
        .result-content { 
            color: #ccc; 
            font-size: 12px; 
            white-space: pre-wrap; 
            word-break: break-all; 
            margin: 0; 
            max-height: 150px;
            overflow: hidden;
        }
        
        .indexing-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
        }
        .indexing-card {
            background: #252526;
            padding: 32px;
            border-radius: 12px;
            text-align: center;
        }
        .spinner {
            width: 48px;
            height: 48px;
            border: 4px solid #333;
            border-top-color: #0078d4;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 16px;
        }
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        .progress-bar {
            height: 8px;
            background: #333;
            border-radius: 4px;
            overflow: hidden;
            margin-top: 16px;
        }
        .progress-fill {
            height: 100%;
            background: #0078d4;
            transition: width 0.3s;
        }
    </style>
</head>
<body>
    <h1>📚 RAG Knowledge Base</h1>
    
    <div class="search-box">
        <input type="text" class="search-input" id="searchInput" placeholder="Search code..." onkeypress="handleSearch(event)">
        <button class="btn-primary" onclick="doSearch()">Search</button>
    </div>
    
    <div class="actions">
        <button class="btn-primary" onclick="initRAG()">Initialize</button>
        <button class="btn-secondary" onclick="refreshRAG()">Refresh</button>
        <button class="btn-secondary" onclick="showFiles()">View Files</button>
        <button class="btn-secondary" onclick="addFiles()">Add Files</button>
        <button class="btn-danger" onclick="clearRAG()">Clear</button>
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
    
    <h2>Indexed Files (${files.length})</h2>
    <ul>${fileList}${moreFiles}</ul>
    
    ${searchHtml}
    ${indexingHtml}
    
    <script>
        const vscode = acquireVsCodeApi();
        
        function handleSearch(event) {
            if (event.key === 'Enter') {
                doSearch();
            }
        }
        
        function doSearch() {
            const input = document.getElementById('searchInput');
            const query = input.value.trim();
            if (query) {
                vscode.postMessage({ command: 'search', query: query });
            }
        }
        
        function initRAG() {
            vscode.postMessage({ command: 'init' });
        }
        
        function refreshRAG() {
            vscode.postMessage({ command: 'refresh' });
        }
        
        function clearRAG() {
            vscode.postMessage({ command: 'clear' });
        }
        
        function addFiles() {
            vscode.postMessage({ command: 'addFiles' });
        }
        
        function removeFiles(files) {
            vscode.postMessage({ command: 'removeFiles', files: files });
        }
        
        function showFiles() {
            vscode.postMessage({ command: 'showFiles' });
        }
        
        function openFile(path) {
            vscode.postMessage({ command: 'openFile', path: path });
        }
    </script>
</body>
</html>`;
    }
    /**
     * Escape HTML special characters
     */
    escapeHtml(text) {
        return text
            .replace(/&/g, '&')
            .replace(/</g, '<')
            .replace(/>/g, '>')
            .replace(/"/g, '"')
            .replace(/'/g, '&#039;');
    }
}
exports.RAGWebviewProvider = RAGWebviewProvider;
//# sourceMappingURL=RAGWebviewProvider.js.map