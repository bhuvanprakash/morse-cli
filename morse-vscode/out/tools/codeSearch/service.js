"use strict";
/**
 * Code Search Service
 * Handles code search operations through morse-cli
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
exports.SearchService = void 0;
exports.createSearchService = createSearchService;
const vscode = __importStar(require("vscode"));
const types_1 = require("./types");
/**
 * Search service for managing code search operations
 */
class SearchService {
    client;
    config;
    events = {};
    indexInfo;
    searchHistory = [];
    isInitialized = false;
    constructor(client, config = {}) {
        this.client = client;
        this.config = { ...types_1.DEFAULT_SEARCH_CONFIG, ...config };
        this.indexInfo = {
            status: 'notBuilt',
            fileCount: 0,
            tokenCount: 0,
            indexSize: 0,
        };
    }
    /**
     * Set event handlers
     */
    setEvents(events) {
        this.events = events;
    }
    /**
     * Initialize the search service
     */
    async initialize() {
        this.isInitialized = true;
    }
    /**
     * Check if search service is available
     */
    isAvailable() {
        return this.isInitialized;
    }
    /**
     * Get current index info
     */
    getIndexInfo() {
        return this.indexInfo;
    }
    /**
     * Get configuration
     */
    getConfig() {
        return this.config;
    }
    /**
     * Update configuration
     */
    updateConfig(config) {
        this.config = { ...this.config, ...config };
    }
    /**
     * Get search history
     */
    getHistory() {
        return this.searchHistory;
    }
    /**
     * Clear search history
     */
    clearHistory() {
        this.searchHistory = [];
    }
    /**
     * Execute code search
     */
    async search(args) {
        const startTime = Date.now();
        try {
            const limit = args.limit ?? this.config.maxResults;
            // Merge config filters with args
            const fileTypes = args.fileTypes ?? this.config.fileTypes;
            const languages = args.languages ?? this.config.languages;
            const result = await this.executeSearch({
                query: args.query,
                limit,
                fileTypes,
                languages,
                caseSensitive: args.caseSensitive ?? this.config.caseSensitive,
                useRegex: args.useRegex ?? this.config.useRegex,
            });
            const searchTime = Date.now() - startTime;
            // Add to history
            if (result.success && result.results) {
                this.addToHistory(args.query, result.results.length);
                this.events.onSearchComplete?.(result.results);
            }
            return {
                ...result,
                searchTime,
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.events.onError?.(errorMessage);
            return {
                success: false,
                message: '',
                error: errorMessage,
            };
        }
    }
    /**
     * Build the search index
     */
    async buildIndex(args) {
        try {
            this.updateIndexStatus('building');
            const result = await this.executeBuildIndex(args);
            if (result.success && result.indexInfo) {
                this.indexInfo = result.indexInfo;
                this.events.onIndexBuilt?.(result.indexInfo);
                this.updateIndexStatus('ready');
            }
            else if (result.error) {
                this.updateIndexStatus('error');
                this.indexInfo.error = result.error;
            }
            return result;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.updateIndexStatus('error');
            this.indexInfo.error = errorMessage;
            this.events.onError?.(errorMessage);
            return {
                success: false,
                message: '',
                error: errorMessage,
            };
        }
    }
    /**
     * Get index status
     */
    getIndexStatus() {
        return this.indexInfo.status;
    }
    /**
     * Add result to history
     */
    addToHistory(query, resultCount) {
        this.searchHistory.unshift({
            query,
            timestamp: new Date(),
            resultCount,
        });
        // Keep only last 50 entries
        if (this.searchHistory.length > 50) {
            this.searchHistory = this.searchHistory.slice(0, 50);
        }
    }
    /**
     * Update index status and notify listeners
     */
    updateIndexStatus(status) {
        this.indexInfo.status = status;
        this.events.onIndexStatusChange?.(status);
    }
    /**
     * Execute search through morse-cli
     */
    async executeSearch(args) {
        let output = '';
        let success = false;
        const toolArgs = {
            query: args.query,
            limit: args.limit,
        };
        for await (const chunk of this.client.streamToolExecution('search_code', toolArgs)) {
            if (chunk.output) {
                output += chunk.output;
            }
            if (chunk.error) {
                output += `[Error]: ${chunk.error}\n`;
            }
            if (chunk.status === 'completed') {
                success = true;
            }
            if (chunk.status === 'failed') {
                success = false;
            }
        }
        // Parse output to extract results
        const results = this.parseSearchResults(output);
        return {
            success,
            message: output,
            results,
            totalMatches: results.length,
        };
    }
    /**
     * Execute build index through morse-cli
     */
    async executeBuildIndex(args) {
        let output = '';
        let success = false;
        let indexInfo;
        const toolArgs = {
            project_root: args.projectRoot,
            files: args.files,
            force: args.force,
        };
        for await (const chunk of this.client.streamToolExecution('graph_build', toolArgs)) {
            if (chunk.output) {
                output += chunk.output;
            }
            if (chunk.error) {
                output += `[Error]: ${chunk.error}\n`;
            }
            if (chunk.status === 'completed') {
                success = true;
            }
            if (chunk.status === 'failed') {
                success = false;
            }
        }
        // Parse output to extract index info
        indexInfo = this.parseIndexInfo(output);
        return {
            success,
            message: output,
            indexInfo,
        };
    }
    /**
     * Parse search results from output
     */
    parseSearchResults(output) {
        const results = [];
        // Parse output format: "### Result N\nFile: <path>\n<snippet>"
        const resultRegex = /### Result (\d+)\nFile: ([^\n]+)\n([\s\S]*?)(?=\n### Result |\n$)/g;
        let match;
        while ((match = resultRegex.exec(output)) !== null) {
            const [, , filePath, snippet] = match;
            // Try to extract line numbers from snippet
            const lineMatch = snippet.match(/line[s]?\s*(\d+)(?:\s*[-–]\s*(\d+))?/i);
            const startLine = lineMatch ? parseInt(lineMatch[1], 10) : 1;
            const endLine = lineMatch && lineMatch[2] ? parseInt(lineMatch[2], 10) : startLine;
            results.push({
                id: `result-${results.length}`,
                filePath: filePath.trim(),
                startLine,
                endLine,
                snippet: snippet.trim(),
                score: 1.0 / (results.length + 1), // Simplified scoring
            });
        }
        // Fallback: if no structured output, create a single result with the full output
        if (results.length === 0 && output.length > 0) {
            results.push({
                id: 'result-0',
                filePath: 'unknown',
                startLine: 1,
                endLine: 1,
                snippet: output,
                score: 1.0,
            });
        }
        return results;
    }
    /**
     * Parse index info from output
     */
    parseIndexInfo(output) {
        const info = {
            status: 'ready',
            fileCount: 0,
            tokenCount: 0,
            indexSize: 0,
            lastBuiltAt: new Date(),
        };
        // Parse file count
        const fileMatch = output.match(/(\d+)\s*files?/i);
        if (fileMatch) {
            info.fileCount = parseInt(fileMatch[1], 10);
        }
        // Parse token count
        const tokenMatch = output.match(/(\d+)\s*tokens?/i);
        if (tokenMatch) {
            info.tokenCount = parseInt(tokenMatch[1], 10);
        }
        return info;
    }
    /**
     * Navigate to a search result in the editor
     */
    async navigateToResult(result) {
        try {
            const document = await vscode.workspace.openTextDocument(result.filePath);
            const editor = await vscode.window.showTextDocument(document, {
                preview: false,
            });
            const startLine = Math.max(0, result.startLine - 1);
            const endLine = Math.min(document.lineCount, result.endLine);
            const range = new vscode.Range(startLine, 0, endLine, 0);
            editor.selection = new vscode.Selection(range.start, range.end);
            editor.revealRange(range);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Failed to navigate to result: ${errorMessage}`);
        }
    }
    /**
     * Get autocomplete suggestions for search
     */
    async getAutocompleteSuggestions(partialQuery) {
        // Simple autocomplete based on search history
        const suggestions = this.searchHistory
            .filter(entry => entry.query.toLowerCase().includes(partialQuery.toLowerCase()))
            .map(entry => entry.query)
            .slice(0, 10);
        return suggestions;
    }
    /**
     * Export search results
     */
    async exportResults(results, format) {
        switch (format) {
            case 'json':
                return JSON.stringify(results, null, 2);
            case 'markdown':
                return this.exportResultsAsMarkdown(results);
            default:
                throw new Error(`Unsupported format: ${format}`);
        }
    }
    /**
     * Export results as markdown
     */
    exportResultsAsMarkdown(results) {
        const lines = ['# Search Results\n'];
        for (const result of results) {
            lines.push(`## ${result.filePath}`);
            lines.push(`**Lines ${result.startLine}-${result.endLine}**`);
            lines.push('');
            lines.push('```');
            lines.push(result.snippet);
            lines.push('```');
            lines.push('');
        }
        return lines.join('\n');
    }
    /**
     * Dispose the service
     */
    dispose() {
        this.events = {};
    }
}
exports.SearchService = SearchService;
/**
 * Create search service instance
 */
function createSearchService(client, config) {
    return new SearchService(client, config);
}
//# sourceMappingURL=service.js.map