"use strict";
/**
 * Memory Client for Morse VS Code Extension
 * Communicates with morse-cli memory API or directly accesses memory files
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
exports.MemoryClient = void 0;
exports.getMemoryClient = getMemoryClient;
exports.refreshMemoryClient = refreshMemoryClient;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
/**
 * Memory Client for accessing and managing project memory
 */
class MemoryClient {
    workspaceRoot;
    memoryPath;
    globalMemoryPath;
    isGlobal = false;
    constructor() {
        this.workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        this.memoryPath = this.workspaceRoot ? path.join(this.workspaceRoot, '.morse', 'memory.md') : '';
        this.globalMemoryPath = path.join(os.homedir(), '.morse', 'memory.md');
    }
    /**
     * Get the current workspace root path
     */
    getWorkspaceRoot() {
        return this.workspaceRoot;
    }
    /**
     * Set whether to use global memory (user-level) instead of project memory
     */
    setGlobalMemory(isGlobal) {
        this.isGlobal = isGlobal;
    }
    /**
     * Get the current memory mode
     */
    getIsGlobal() {
        return this.isGlobal;
    }
    /**
     * Get the path to the memory file
     */
    getMemoryFilePath() {
        return this.isGlobal ? this.globalMemoryPath : this.memoryPath;
    }
    /**
     * Check if memory file exists
     */
    async exists() {
        try {
            const memPath = this.getMemoryFilePath();
            await fs.promises.access(memPath);
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * Read memory content from the project
     */
    async show() {
        const memPath = this.getMemoryFilePath();
        try {
            // Try to read the file directly first
            const content = await this.readMemoryFile(memPath);
            return this.parseMemoryContent(content, memPath);
        }
        catch (error) {
            // Fallback to CLI command
            return this.showViaCLI();
        }
    }
    /**
     * Show memory via CLI command
     */
    async showViaCLI() {
        try {
            const workspaceRoot = this.workspaceRoot || process.cwd();
            const { stdout } = await execAsync('morse memory show', { cwd: workspaceRoot });
            return this.parseMemoryContent(stdout, this.getMemoryFilePath());
        }
        catch (error) {
            // Return empty state if command fails
            return this.getEmptyState();
        }
    }
    /**
     * Read memory file directly
     */
    async readMemoryFile(memPath) {
        try {
            return await fs.promises.readFile(memPath, 'utf-8');
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                return '';
            }
            throw error;
        }
    }
    /**
     * Parse memory content into structured entries
     */
    parseMemoryContent(content, memPath) {
        const entries = [];
        if (!content.trim()) {
            return this.getEmptyState();
        }
        // Parse entries from memory.md
        // Format: "Note — 2024-01-01T12:00:00Z\ncontent"
        const noteRegex = /Note — (\d{4}-\d{2}-\d{2}T[\d:]+Z)\n([\s\S]*?)(?=\n\nNote —|$)/g;
        let match;
        while ((match = noteRegex.exec(content)) !== null) {
            entries.push({
                id: this.generateEntryId(match[1]),
                timestamp: match[1],
                content: match[2].trim(),
            });
        }
        // Get file stats for last updated
        let lastUpdated = new Date().toISOString();
        try {
            const stats = fs.statSync(memPath);
            lastUpdated = stats.mtime.toISOString();
        }
        catch {
            // Use current time if stats fail
        }
        return {
            content,
            entries,
            lastUpdated,
            tokenCount: this.estimateTokens(content),
            isGlobal: this.isGlobal,
        };
    }
    /**
     * Generate a unique ID for a memory entry
     */
    generateEntryId(timestamp) {
        return `entry_${timestamp.replace(/[:\-]/g, '')}`;
    }
    /**
     * Estimate token count (rough approximation)
     */
    estimateTokens(text) {
        const words = text.split(/\s+/).filter(w => w.length > 0).length;
        return Math.ceil(words * 1.3);
    }
    /**
     * Get empty memory state
     */
    getEmptyState() {
        return {
            content: '',
            entries: [],
            lastUpdated: new Date().toISOString(),
            tokenCount: 0,
            isGlobal: this.isGlobal,
        };
    }
    /**
     * Append content to memory
     */
    async append(content) {
        const memPath = this.getMemoryFilePath();
        try {
            // Ensure .morse directory exists
            const dir = path.dirname(memPath);
            await fs.promises.mkdir(dir, { recursive: true });
            // Append new entry
            const timestamp = new Date().toISOString();
            const entry = `\n\nNote — ${timestamp}\n${content.trim()}\n`;
            try {
                const existing = await this.readMemoryFile(memPath);
                await fs.promises.writeFile(memPath, existing + entry, 'utf-8');
            }
            catch {
                // File doesn't exist, create it
                await fs.promises.writeFile(memPath, entry, 'utf-8');
            }
        }
        catch (error) {
            // Fallback to CLI
            await this.appendViaCLI(content);
        }
    }
    /**
     * Append via CLI command
     */
    async appendViaCLI(content) {
        const workspaceRoot = this.workspaceRoot || process.cwd();
        const { stderr } = await execAsync(`morse memory append "${content.replace(/"/g, '\\"')}"`, {
            cwd: workspaceRoot
        });
        if (stderr && !stderr.includes('morse: command not found')) {
            throw new Error(stderr);
        }
    }
    /**
     * Edit/update memory content
     */
    async edit(newContent) {
        const memPath = this.getMemoryFilePath();
        try {
            // Ensure .morse directory exists
            const dir = path.dirname(memPath);
            await fs.promises.mkdir(dir, { recursive: true });
            await fs.promises.writeFile(memPath, newContent, 'utf-8');
        }
        catch (error) {
            throw new Error(`Failed to edit memory: ${error}`);
        }
    }
    /**
     * Update specific section in memory
     */
    async updateSection(section, content) {
        const state = await this.show();
        let newContent = state.content;
        const sectionHeader = `## ${section}`;
        const sectionRegex = new RegExp(`## ${section}[\\s\\S]*?(?=\\n## |$)`, 'i');
        if (sectionRegex.test(newContent)) {
            newContent = newContent.replace(sectionRegex, `${sectionHeader}\n${content}\n`);
        }
        else {
            newContent = newContent.trim() + `\n\n${sectionHeader}\n${content}\n`;
        }
        await this.edit(newContent);
    }
    /**
     * Clear all memory
     */
    async clear() {
        const memPath = this.getMemoryFilePath();
        try {
            // Create empty/default memory
            const defaultContent = this.getDefaultMemoryTemplate();
            await fs.promises.writeFile(memPath, defaultContent, 'utf-8');
        }
        catch (error) {
            // Fallback to CLI
            await this.clearViaCLI();
        }
    }
    /**
     * Clear via CLI command
     */
    async clearViaCLI() {
        const workspaceRoot = this.workspaceRoot || process.cwd();
        // CLI prompts for confirmation, so we need to handle that
        try {
            await execAsync('echo "y" | morse memory clear', { cwd: workspaceRoot });
        }
        catch (error) {
            // CLI might not be available, just clear the file directly
            const memPath = this.getMemoryFilePath();
            await fs.promises.writeFile(memPath, this.getDefaultMemoryTemplate(), 'utf-8');
        }
    }
    /**
     * Get default memory template
     */
    getDefaultMemoryTemplate() {
        return `Project: ${path.basename(this.workspaceRoot || '.')}
Stack: (describe your tech stack here)
Last updated: ${new Date().toISOString().split('T')[0]}

## Architecture
(describe your architecture here)

## Key Decisions
(log important decisions here)

## Current Focus
(what are you working on now)
`;
    }
    /**
     * List memory entries (alias for show)
     */
    async list() {
        const state = await this.show();
        return state.entries;
    }
    /**
     * Search memory for specific content
     */
    async search(query) {
        const state = await this.show();
        const lowerQuery = query.toLowerCase();
        return state.entries.filter(entry => entry.content.toLowerCase().includes(lowerQuery) ||
            state.content.toLowerCase().includes(lowerQuery));
    }
    /**
     * Get memory sync status with CLI
     */
    async getSyncStatus() {
        const cliAvailable = await this.isCLIAvailable();
        if (!cliAvailable) {
            return {
                synced: false,
                lastSync: new Date().toISOString(),
                cliAvailable: false,
            };
        }
        return {
            synced: true,
            lastSync: new Date().toISOString(),
            cliAvailable: true,
        };
    }
    /**
     * Check if morse CLI is available
     */
    async isCLIAvailable() {
        try {
            await execAsync('which morse');
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * Open memory file in external editor
     */
    async openInEditor() {
        const memPath = this.getMemoryFilePath();
        // Ensure file exists
        await this.ensureMemoryExists();
        await vscode.window.showTextDocument(vscode.Uri.file(memPath));
    }
    /**
     * Ensure memory file exists with default content
     */
    async ensureMemoryExists() {
        const memPath = this.getMemoryFilePath();
        try {
            await fs.promises.access(memPath);
        }
        catch {
            // Create with default content
            const dir = path.dirname(memPath);
            await fs.promises.mkdir(dir, { recursive: true });
            await fs.promises.writeFile(memPath, this.getDefaultMemoryTemplate(), 'utf-8');
        }
    }
}
exports.MemoryClient = MemoryClient;
/**
 * Global singleton instance
 */
let memoryClient;
function getMemoryClient() {
    if (!memoryClient) {
        memoryClient = new MemoryClient();
    }
    return memoryClient;
}
/**
 * Refresh memory client with new workspace root
 */
function refreshMemoryClient() {
    memoryClient = new MemoryClient();
    return memoryClient;
}
//# sourceMappingURL=client.js.map