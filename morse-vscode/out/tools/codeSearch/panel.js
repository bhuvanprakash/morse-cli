"use strict";
/**
 * Code Search Panel
 * Interactive search panel for VS Code
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
exports.SearchPanel = void 0;
exports.createSearchPanel = createSearchPanel;
const vscode = __importStar(require("vscode"));
/**
 * Search Panel for interactive code searching
 */
class SearchPanel {
    static viewType = 'morse.search';
    static currentPanel;
    panel;
    extensionUri;
    searchService;
    disposables = [];
    state;
    constructor(extensionUri, searchService) {
        this.extensionUri = extensionUri;
        this.searchService = searchService;
        this.state = {
            isVisible: false,
            results: [],
            selectedIndex: 0,
            query: '',
            config: searchService.getConfig(),
            isLoading: false,
            history: [],
            indexStatus: 'notBuilt',
        };
        // Create the webview panel
        this.panel = vscode.window.createWebviewPanel(SearchPanel.viewType, 'Code Search', vscode.ViewColumn.Two, {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [extensionUri],
        });
        this.panel.iconPath = vscode.Uri.joinPath(extensionUri, 'media', 'search.svg');
        this.initializePanel();
    }
    /**
     * Initialize the panel with content
     */
    initializePanel() {
        // Set initial HTML content
        this.panel.webview.html = this.getHtmlContent();
        // Handle messages from the webview
        this.panel.webview.onDidReceiveMessage((message) => this.handleWebviewMessage(message), null, this.disposables);
        // Handle panel disposal
        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
        // Set up search service events
        this.searchService.setEvents({
            onSearchComplete: (results) => {
                this.state.results = results;
                this.state.isLoading = false;
                this.updateResults();
            },
            onIndexBuilt: (indexInfo) => {
                this.state.indexStatus = indexInfo.status;
                this.updateIndexStatus();
            },
            onError: (error) => {
                this.state.isLoading = false;
                this.showError(error);
            },
            onIndexStatusChange: (status) => {
                this.state.indexStatus = status;
                this.updateIndexStatus();
            },
        });
        // Load initial history and index status
        this.state.history = this.searchService.getHistory();
        this.state.indexStatus = this.searchService.getIndexStatus();
    }
    /**
     * Handle messages from the webview
     */
    async handleWebviewMessage(message) {
        switch (message.command) {
            case 'search':
                await this.performSearch(message.payload);
                break;
            case 'selectResult':
                await this.selectResult(message.payload);
                break;
            case 'navigateToResult':
                await this.navigateToResult(message.payload);
                break;
            case 'clearHistory':
                this.clearHistory();
                break;
            case 'buildIndex':
                await this.buildIndex();
                break;
            case 'updateConfig':
                this.updateConfig(message.payload);
                break;
            case 'getHistory':
                this.sendHistory();
                break;
            case 'getSuggestions':
                await this.sendSuggestions(message.payload);
                break;
        }
    }
    /**
     * Perform a search
     */
    async performSearch(query) {
        if (!query.trim()) {
            return;
        }
        this.state.query = query;
        this.state.isLoading = true;
        this.state.selectedIndex = 0;
        this.updateLoading();
        const result = await this.searchService.search({
            query,
            limit: this.state.config.maxResults,
            fileTypes: this.state.config.fileTypes,
            languages: this.state.config.languages,
        });
        if (result.success && result.results) {
            this.state.results = result.results;
            this.state.history = this.searchService.getHistory();
        }
        else if (result.error) {
            this.showError(result.error);
        }
        this.state.isLoading = false;
    }
    /**
     * Select a result (highlight in panel)
     */
    async selectResult(index) {
        this.state.selectedIndex = index;
        this.updateSelection();
    }
    /**
     * Navigate to a result in the editor
     */
    async navigateToResult(index) {
        const result = this.state.results[index];
        if (result) {
            await this.searchService.navigateToResult(result);
        }
    }
    /**
     * Clear search history
     */
    clearHistory() {
        this.searchService.clearHistory();
        this.state.history = [];
        this.sendHistory();
    }
    /**
     * Build the search index
     */
    async buildIndex() {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            this.showError('No workspace folder found');
            return;
        }
        this.state.isLoading = true;
        this.updateLoading();
        const result = await this.searchService.buildIndex({
            projectRoot: workspaceFolder.uri.fsPath,
        });
        this.state.isLoading = false;
        if (!result.success && result.error) {
            this.showError(result.error);
        }
    }
    /**
     * Update search configuration
     */
    updateConfig(config) {
        this.searchService.updateConfig(config);
        this.state.config = this.searchService.getConfig();
        this.panel.webview.postMessage({
            command: 'configUpdated',
            payload: this.state.config,
        });
    }
    /**
     * Send history to webview
     */
    sendHistory() {
        this.panel.webview.postMessage({
            command: 'historyUpdated',
            payload: this.state.history,
        });
    }
    /**
     * Send autocomplete suggestions to webview
     */
    async sendSuggestions(query) {
        const suggestions = await this.searchService.getAutocompleteSuggestions(query);
        this.panel.webview.postMessage({
            command: 'suggestions',
            payload: suggestions,
        });
    }
    /**
     * Update results in webview
     */
    updateResults() {
        this.panel.webview.postMessage({
            command: 'resultsUpdated',
            payload: {
                results: this.state.results,
                selectedIndex: this.state.selectedIndex,
            },
        });
    }
    /**
     * Update selection in webview
     */
    updateSelection() {
        this.panel.webview.postMessage({
            command: 'selectionChanged',
            payload: this.state.selectedIndex,
        });
    }
    /**
     * Update loading state in webview
     */
    updateLoading() {
        this.panel.webview.postMessage({
            command: 'loadingChanged',
            payload: this.state.isLoading,
        });
    }
    /**
     * Update index status in webview
     */
    updateIndexStatus() {
        const indexInfo = this.searchService.getIndexInfo();
        this.panel.webview.postMessage({
            command: 'indexStatusChanged',
            payload: {
                status: indexInfo.status,
                fileCount: indexInfo.fileCount,
            },
        });
    }
    /**
     * Show error message
     */
    showError(message) {
        vscode.window.showErrorMessage(`Search Error: ${message}`);
        this.panel.webview.postMessage({
            command: 'showError',
            payload: message,
        });
    }
    /**
     * Show the panel
     */
    show() {
        this.panel.reveal();
        this.state.isVisible = true;
    }
    /**
     * Hide the panel
     */
    hide() {
        this.panel.dispose();
        this.state.isVisible = false;
    }
    /**
     * Dispose the panel
     */
    dispose() {
        this.panel.dispose();
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
        SearchPanel.currentPanel = undefined;
    }
    /**
     * Get HTML content for the panel
     */
    getHtmlContent() {
        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Code Search</title>
    <style>
        * {
            box-sizing: border-box;
        }
        body {
            margin: 0;
            padding: 0;
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
        }
        .container {
            display: flex;
            flex-direction: column;
            height: 100vh;
        }
        .search-header {
            padding: 12px;
            background-color: var(--vscode-editor-background);
            border-bottom: 1px solid var(--vscode-editor-border);
        }
        .search-input-wrapper {
            display: flex;
            gap: 8px;
            margin-bottom: 8px;
        }
        .search-input {
            flex: 1;
            padding: 8px 12px;
            border: 1px solid var(--vscode-editor-border);
            border-radius: 4px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
        }
        .search-input:focus {
            outline: none;
            border-color: var(--vscode-focusBorder);
        }
        .search-btn {
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            cursor: pointer;
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
        }
        .search-btn:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .search-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        .filters {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
        }
        .filter-select {
            padding: 4px 8px;
            border: 1px solid var(--vscode-editor-border);
            border-radius: 4px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            font-family: var(--vscode-font-family);
            font-size: 12px;
        }
        .status-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 12px;
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            border-bottom: 1px solid var(--vscode-editor-border);
        }
        .index-status {
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
        }
        .status-dot.ready {
            background-color: #4caf50;
        }
        .status-dot.not-built {
            background-color: #9e9e9e;
        }
        .status-dot.building {
            background-color: #ff9800;
            animation: pulse 1s infinite;
        }
        .status-dot.error {
            background-color: #f44336;
        }
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
        .results-container {
            flex: 1;
            overflow-y: auto;
        }
        .result-item {
            padding: 12px;
            cursor: pointer;
            border-bottom: 1px solid var(--vscode-editor-border);
        }
        .result-item:hover {
            background-color: var(--vscode-list-hoverBackground);
        }
        .result-item.selected {
            background-color: var(--vscode-list-activeSelectionBackground);
        }
        .result-file {
            font-weight: bold;
            margin-bottom: 4px;
            color: var(--vscode-editorForeground);
        }
        .result-lines {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 4px;
        }
        .result-snippet {
            font-family: var(--vscode-editor-font-family);
            font-size: 12px;
            white-space: pre-wrap;
            color: var(--vscode-editor-foreground);
            background-color: var(--vscode-editor-background);
            padding: 4px;
            border-radius: 4px;
            overflow-x: auto;
        }
        .history-section {
            padding: 12px;
            border-top: 1px solid var(--vscode-editor-border);
        }
        .history-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
        }
        .history-title {
            font-weight: bold;
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }
        .clear-btn {
            background: none;
            border: none;
            color: var(--vscode-errorForeground);
            cursor: pointer;
            font-size: 12px;
        }
        .history-list {
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
        }
        .history-item {
            padding: 4px 8px;
            background-color: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            border-radius: 4px;
            font-size: 12px;
            cursor: pointer;
        }
        .history-item:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .loading {
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
        }
        .spinner {
            width: 24px;
            height: 24px;
            border: 2px solid var(--vscode-editor-border);
            border-top-color: var(--vscode-button-background);
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        .empty-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            color: var(--vscode-descriptionForeground);
            text-align: center;
            padding: 20px;
        }
        .empty-icon {
            font-size: 48px;
            margin-bottom: 12px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="search-header">
            <div class="search-input-wrapper">
                <input type="text" class="search-input" id="searchInput" placeholder="Search code..." autocomplete="off">
                <button class="search-btn" id="searchBtn">Search</button>
            </div>
            <div class="filters">
                <select class="filter-select" id="fileTypeFilter">
                    <option value="">All File Types</option>
                    <option value=".ts">TypeScript</option>
                    <option value=".js">JavaScript</option>
                    <option value=".py">Python</option>
                    <option value=".go">Go</option>
                    <option value=".java">Java</option>
                </select>
                <select class="filter-select" id="languageFilter">
                    <option value="">All Languages</option>
                    <option value="typescript">TypeScript</option>
                    <option value="javascript">JavaScript</option>
                    <option value="python">Python</option>
                    <option value="go">Go</option>
                    <option value="java">Java</option>
                </select>
                <select class="filter-select" id="maxResultsFilter">
                    <option value="5">5 Results</option>
                    <option value="10" selected>10 Results</option>
                    <option value="20">20 Results</option>
                </select>
            </div>
        </div>
        
        <div class="status-bar">
            <div class="index-status" id="indexStatus">
                <span class="status-dot not-built"></span>
                <span>Index: Not Built</span>
            </div>
            <div id="resultCount">0 results</div>
        </div>
        
        <div class="results-container" id="resultsContainer">
            <div class="empty-state">
                <div class="empty-icon">🔍</div>
                <div>Search your codebase</div>
                <div style="font-size: 12px; margin-top: 8px;">Enter a query or select from history</div>
            </div>
        </div>
        
        <div class="history-section">
            <div class="history-header">
                <span class="history-title">Recent Searches</span>
                <button class="clear-btn" id="clearHistory">Clear</button>
            </div>
            <div class="history-list" id="historyList"></div>
        </div>
    </div>
    
    <script>
        const vscode = acquireVsCodeApi();
        let selectedIndex = -1;
        
        // DOM Elements
        const searchInput = document.getElementById('searchInput');
        const searchBtn = document.getElementById('searchBtn');
        const resultsContainer = document.getElementById('resultsContainer');
        const historyList = document.getElementById('historyList');
        const indexStatus = document.getElementById('indexStatus');
        const resultCount = document.getElementById('resultCount');
        const clearHistoryBtn = document.getElementById('clearHistory');
        const fileTypeFilter = document.getElementById('fileTypeFilter');
        const languageFilter = document.getElementById('languageFilter');
        const maxResultsFilter = document.getElementById('maxResultsFilter');
        
        // Event Listeners
        searchBtn.addEventListener('click', performSearch);
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') performSearch();
        });
        clearHistoryBtn.addEventListener('click', () => {
            vscode.postMessage({ command: 'clearHistory' });
        });
        
        fileTypeFilter.addEventListener('change', updateConfig);
        languageFilter.addEventListener('change', updateConfig);
        maxResultsFilter.addEventListener('change', updateConfig);
        
        // Handle autocomplete
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value;
            if (query.length > 2) {
                vscode.postMessage({ command: 'getSuggestions', payload: query });
            }
        });
        
        function performSearch() {
            const query = searchInput.value.trim();
            if (query) {
                vscode.postMessage({ command: 'search', payload: query });
            }
        }
        
        function updateConfig() {
            const config = {
                fileTypes: fileTypeFilter.value ? [fileTypeFilter.value] : [],
                languages: languageFilter.value ? [languageFilter.value] : [],
                maxResults: parseInt(maxResultsFilter.value, 10),
            };
            vscode.postMessage({ command: 'updateConfig', payload: config });
        }
        
        function renderResults(results, selected) {
            if (!results || results.length === 0) {
                resultsContainer.innerHTML = '<div class="empty-state"><div class="empty-icon">🔍</div><div>No results found</div></div>';
                resultCount.textContent = '0 results';
                return;
            }
            
            resultCount.textContent = results.length + ' results';
            
            resultsContainer.innerHTML = results.map((result, index) => {
                const isSelected = index === selected;
                return \`
                    <div class="result-item \${isSelected ? 'selected' : ''}" data-index="\${index}">
                        <div class="result-file">\${result.filePath}</div>
                        <div class="result-lines">Lines \${result.startLine}-\${result.endLine}</div>
                        <div class="result-snippet">\${escapeHtml(result.snippet)}</div>
                    </div>
                \`;
            }).join('');
            
            // Add click handlers
            document.querySelectorAll('.result-item').forEach(item => {
                item.addEventListener('click', () => {
                    const index = parseInt(item.dataset.index, 10);
                    vscode.postMessage({ command: 'navigateToResult', payload: index });
                });
                item.addEventListener('mouseenter', () => {
                    const index = parseInt(item.dataset.index, 10);
                    vscode.postMessage({ command: 'selectResult', payload: index });
                });
            });
        }
        
        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
        
        function renderHistory(history) {
            if (!history || history.length === 0) {
                historyList.innerHTML = '<span style="font-size: 12px; color: var(--vscode-descriptionForeground);">No recent searches</span>';
                return;
            }
            
            historyList.innerHTML = history.slice(0, 10).map(item => 
                \`<span class="history-item" data-query="\${escapeHtml(item.query)}">\${escapeHtml(item.query)}</span>\`
            ).join('');
            
            document.querySelectorAll('.history-item').forEach(item => {
                item.addEventListener('click', () => {
                    searchInput.value = item.dataset.query;
                    performSearch();
                });
            });
        }
        
        function updateIndexStatus(status, fileCount) {
            const statusText = {
                'notBuilt': 'Not Built',
                'building': 'Building...',
                'ready': 'Ready',
                'error': 'Error'
            };
            
            indexStatus.innerHTML = \`
                <span class="status-dot \${status}"></span>
                <span>Index: \${statusText[status] || status}\${fileCount ? ' (' + fileCount + ' files)' : ''}</span>
            \`;
            
            if (status !== 'ready' && status !== 'building') {
                // Show build button
                const buildBtn = document.createElement('button');
                buildBtn.className = 'search-btn';
                buildBtn.textContent = 'Build Index';
                buildBtn.style.marginLeft = '8px';
                buildBtn.addEventListener('click', () => {
                    vscode.postMessage({ command: 'buildIndex' });
                });
                indexStatus.appendChild(buildBtn);
            }
        }
        
        // Handle messages from extension
        window.addEventListener('message', (event) => {
            const message = event.data;
            
            switch (message.command) {
                case 'resultsUpdated':
                    renderResults(message.payload.results, message.payload.selectedIndex);
                    break;
                case 'selectionChanged':
                    selectedIndex = message.payload;
                    document.querySelectorAll('.result-item').forEach((item, index) => {
                        item.classList.toggle('selected', index === selectedIndex);
                    });
                    break;
                case 'loadingChanged':
                    if (message.payload) {
                        resultsContainer.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
                    }
                    break;
                case 'historyUpdated':
                    renderHistory(message.payload);
                    break;
                case 'indexStatusChanged':
                    updateIndexStatus(message.payload.status, message.payload.fileCount);
                    break;
                case 'configUpdated':
                    fileTypeFilter.value = message.payload.fileTypes?.[0] || '';
                    languageFilter.value = message.payload.languages?.[0] || '';
                    maxResultsFilter.value = message.payload.maxResults || 10;
                    break;
                case 'suggestions':
                    // Could implement dropdown suggestions here
                    break;
                case 'showError':
                    resultsContainer.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><div>' + escapeHtml(message.payload) + '</div></div>';
                    break;
            }
        });
        
        // Initialize
        vscode.postMessage({ command: 'getHistory' });
    </script>
</body>
</html>`;
    }
}
exports.SearchPanel = SearchPanel;
/**
 * Create search panel instance
 */
function createSearchPanel(extensionUri, searchService) {
    return new SearchPanel(extensionUri, searchService);
}
//# sourceMappingURL=panel.js.map