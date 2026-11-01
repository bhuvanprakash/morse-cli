"use strict";
/**
 * RAG Client for Morse VS Code Extension
 * Communicates with morse-cli RAG commands to manage semantic code search
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
exports.RAGClient = void 0;
exports.getRAGClient = getRAGClient;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const fs = __importStar(require("fs"));
const execAsync = (0, util_1.promisify)(child_process_1.exec);
/**
 * Client for RAG operations
 * Communicates with morse-cli via child process
 */
class RAGClient {
    workspaceRoot;
    cliPath;
    outputChannel;
    progressCallback = null;
    constructor() {
        this.workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        this.outputChannel = vscode.window.createOutputChannel('Morse RAG');
        this.detectMorseCLI();
    }
    /**
     * Detect morse CLI path
     */
    async detectMorseCLI() {
        // Check config for custom path
        const config = vscode.workspace.getConfiguration('morse');
        const cliPath = config.get('cliPath');
        if (cliPath) {
            this.cliPath = cliPath;
            return;
        }
        // Try common locations
        const possiblePaths = [
            'morse',
            '/usr/local/bin/morse',
            path.join(process.env.HOME || '', '.local/bin/morse'),
        ];
        for (const p of possiblePaths) {
            try {
                await execAsync(`${p} --version`);
                this.cliPath = p;
                return;
            }
            catch {
                // Continue to next path
            }
        }
        this.cliPath = 'morse'; // Default, will fail gracefully if not found
    }
    /**
     * Get workspace root path
     */
    getWorkspaceRoot() {
        return this.workspaceRoot;
    }
    /**
     * Set progress callback for long-running operations
     */
    onProgress(callback) {
        this.progressCallback = callback;
    }
    /**
     * Execute morse rag command
     */
    async runCommand(args, showOutput = true) {
        if (!this.cliPath) {
            throw new Error('Morse CLI not found. Please install morse or set cliPath in settings.');
        }
        const cwd = this.workspaceRoot || process.cwd();
        const fullArgs = ['rag', ...args];
        if (showOutput) {
            this.outputChannel.appendLine(`$ morse ${fullArgs.join(' ')}`);
        }
        try {
            const { stdout, stderr } = await execAsync(`${this.cliPath} ${fullArgs.join(' ')}`, {
                cwd,
                timeout: 300000, // 5 minute timeout for indexing
            });
            if (showOutput && stdout) {
                this.outputChannel.appendLine(stdout);
            }
            if (stderr && showOutput) {
                this.outputChannel.appendLine(`stderr: ${stderr}`);
            }
            return stdout;
        }
        catch (error) {
            const message = error.message || String(error);
            if (showOutput) {
                this.outputChannel.appendLine(`Error: ${message}`);
            }
            throw new Error(`RAG command failed: ${message}`);
        }
    }
    /**
     * Check if morse CLI is available
     */
    async isAvailable() {
        if (!this.cliPath) {
            return false;
        }
        try {
            await execAsync(`${this.cliPath} --version`);
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * Get the RAG index database path
     */
    getIndexPath() {
        if (!this.workspaceRoot) {
            return undefined;
        }
        return path.join(this.workspaceRoot, '.morse', 'rag', 'index.db');
    }
    /**
     * Check if RAG index exists
     */
    async isIndexInitialized() {
        const indexPath = this.getIndexPath();
        if (!indexPath) {
            return false;
        }
        try {
            await fs.promises.access(indexPath);
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * Initialize RAG index for the project
     */
    async init() {
        const available = await this.isAvailable();
        if (!available) {
            throw new Error('Morse CLI not available. Please install morse first.');
        }
        // Show output channel
        this.outputChannel.show(true);
        if (this.progressCallback) {
            this.progressCallback({
                current: 0,
                total: 0,
                currentFile: 'Scanning project...',
                status: 'indexing',
            });
        }
        try {
            const output = await this.runCommand(['init']);
            // Parse output for file/chunk counts
            const filesMatch = output.match(/(\d+) files indexed/);
            const chunksMatch = output.match(/(\d+) chunks/);
            const files = filesMatch ? parseInt(filesMatch[1], 10) : 0;
            const chunks = chunksMatch ? parseInt(chunksMatch[1], 10) : 0;
            if (this.progressCallback) {
                this.progressCallback({
                    current: files,
                    total: files,
                    currentFile: 'Complete',
                    status: 'complete',
                    message: `Indexed ${files} files with ${chunks} chunks`,
                });
            }
            return { files, chunks };
        }
        catch (error) {
            if (this.progressCallback) {
                this.progressCallback({
                    current: 0,
                    total: 0,
                    currentFile: 'Error',
                    status: 'error',
                    message: String(error),
                });
            }
            throw error;
        }
    }
    /**
     * Refresh RAG index with modified files
     */
    async refresh() {
        const available = await this.isAvailable();
        if (!available) {
            throw new Error('Morse CLI not available');
        }
        this.outputChannel.show(true);
        if (this.progressCallback) {
            this.progressCallback({
                current: 0,
                total: 0,
                currentFile: 'Checking for modified files...',
                status: 'indexing',
            });
        }
        try {
            const output = await this.runCommand(['refresh']);
            const updatedMatch = output.match(/Updated (\d+) files/);
            const removedMatch = output.match(/Removed (\d+) deleted files/);
            const updated = updatedMatch ? parseInt(updatedMatch[1], 10) : 0;
            const removed = removedMatch ? parseInt(removedMatch[1], 10) : 0;
            if (this.progressCallback) {
                this.progressCallback({
                    current: updated,
                    total: updated,
                    currentFile: 'Complete',
                    status: 'complete',
                    message: `Updated ${updated} files, removed ${removed} files`,
                });
            }
            return { updated, removed };
        }
        catch (error) {
            if (this.progressCallback) {
                this.progressCallback({
                    current: 0,
                    total: 0,
                    currentFile: 'Error',
                    status: 'error',
                    message: String(error),
                });
            }
            throw error;
        }
    }
    /**
     * Get RAG index status
     */
    async status() {
        const available = await this.isAvailable();
        if (!available) {
            return {
                status: 'not_initialized',
                freshness: 'CLI not available',
                fileCount: 0,
                chunkCount: 0,
                indexSize: '0 B',
                lastUpdated: 'Never',
                embedder: 'Unknown',
            };
        }
        try {
            const output = await this.runCommand(['status'], false);
            const statusMatch = output.match(/Status\s*:\s*(\w+)/);
            const freshnessMatch = output.match(/Freshness\s*:\s*(.+)/);
            const filesMatch = output.match(/Files\s*:\s*(\d+)/);
            const chunksMatch = output.match(/Chunks\s*:\s*(\d+)/);
            const dbMatch = output.match(/Index DB\s*:\s*(.+)/);
            const lastMatch = output.match(/Last updated:\s*(.+)/);
            const embedderMatch = output.match(/Embedder\s*:\s*(.+)/);
            let status = 'not_initialized';
            const freshness = freshnessMatch ? freshnessMatch[1].trim() : 'Unknown';
            if (freshness.includes('Active')) {
                status = 'active';
            }
            else if (freshness.includes('Stale')) {
                status = 'stale';
            }
            return {
                status,
                freshness,
                fileCount: filesMatch ? parseInt(filesMatch[1], 10) : 0,
                chunkCount: chunksMatch ? parseInt(chunksMatch[1], 10) : 0,
                indexSize: dbMatch ? dbMatch[1].trim() : '0 B',
                lastUpdated: lastMatch ? lastMatch[1].trim() : 'Never',
                embedder: embedderMatch ? embedderMatch[1].trim() : 'Unknown',
            };
        }
        catch {
            return {
                status: 'not_initialized',
                freshness: 'Not initialized',
                fileCount: 0,
                chunkCount: 0,
                indexSize: '0 B',
                lastUpdated: 'Never',
                embedder: 'Unknown',
            };
        }
    }
    /**
     * List indexed files
     */
    async files() {
        const available = await this.isAvailable();
        if (!available) {
            return [];
        }
        try {
            const output = await this.runCommand(['files'], false);
            const lines = output.split('\n').filter(line => line.trim() && !line.includes('Indexed files:'));
            const files = [];
            for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed && !trimmed.startsWith('...')) {
                    files.push({ path: trimmed });
                }
            }
            return files;
        }
        catch {
            return [];
        }
    }
    /**
     * Search the RAG index
     */
    async search(query, topK = 5) {
        const available = await this.isAvailable();
        if (!available) {
            throw new Error('Morse CLI not available');
        }
        if (!query.trim()) {
            throw new Error('Search query cannot be empty');
        }
        this.outputChannel.show(true);
        try {
            const output = await this.runCommand(['search', query, '--top-k', topK.toString()], false);
            const results = [];
            const lines = output.split('\n');
            let currentResult = null;
            for (const line of lines) {
                const match = line.match(/^\d+\.\s+(.+):(\d+)-(\d+)/);
                if (match) {
                    if (currentResult) {
                        results.push(currentResult);
                    }
                    currentResult = {
                        filePath: match[1],
                        startLine: parseInt(match[2], 10),
                        endLine: parseInt(match[3], 10),
                        content: '',
                    };
                }
                else if (currentResult && line.trim()) {
                    currentResult.content += (currentResult.content ? '\n' : '') + line.trim().replace(/^\s+/, '');
                }
            }
            if (currentResult) {
                results.push(currentResult);
            }
            return results;
        }
        catch (error) {
            // Return empty array if no results found
            return [];
        }
    }
    /**
     * Add files to the index
     */
    async add(files) {
        const available = await this.isAvailable();
        if (!available) {
            throw new Error('Morse CLI not available');
        }
        if (files.length === 0) {
            return { added: 0 };
        }
        this.outputChannel.show(true);
        try {
            await this.runCommand(['add', ...files]);
            return { added: files.length };
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Remove files from the index
     */
    async remove(files) {
        const available = await this.isAvailable();
        if (!available) {
            throw new Error('Morse CLI not available');
        }
        if (files.length === 0) {
            return { removed: 0 };
        }
        this.outputChannel.show(true);
        try {
            await this.runCommand(['remove', ...files]);
            return { removed: files.length };
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Clear the RAG index
     */
    async clear() {
        const available = await this.isAvailable();
        if (!available) {
            // If CLI not available, just delete the index file directly
            const indexPath = this.getIndexPath();
            if (indexPath) {
                try {
                    await fs.promises.unlink(indexPath);
                }
                catch {
                    // Ignore if doesn't exist
                }
            }
            return;
        }
        this.outputChannel.show(true);
        try {
            await this.runCommand(['clear', '--yes']);
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Show the RAG output channel
     */
    showOutput() {
        this.outputChannel.show(true);
    }
}
exports.RAGClient = RAGClient;
// Singleton instance
let ragClientInstance = null;
/**
 * Get the RAG client singleton
 */
function getRAGClient() {
    if (!ragClientInstance) {
        ragClientInstance = new RAGClient();
    }
    return ragClientInstance;
}
//# sourceMappingURL=client.js.map