"use strict";
/**
 * Morse VS Code Extension - Snapshot Engine
 * Handles file content snapshotting for checkpoint functionality
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
exports.SnapshotEngine = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const crypto = __importStar(require("crypto"));
const types_1 = require("./types");
/**
 * Snapshot engine for capturing and managing file snapshots
 */
class SnapshotEngine {
    context;
    config;
    workspaceRoot;
    snapshotDir;
    fileCache = new Map();
    lastSnapshotHash = '';
    constructor(context, config) {
        this.context = context;
        this.config = { ...types_1.DEFAULT_CHECKPOINT_CONFIG, ...config };
        // Get workspace root
        const workspace = vscode.workspace.workspaceFolders?.[0];
        if (!workspace) {
            throw new Error('No workspace folder found');
        }
        this.workspaceRoot = workspace.uri.fsPath;
        this.snapshotDir = path.join(this.workspaceRoot, '.morse', 'snapshots');
        // Ensure snapshot directory exists
        this.ensureDirectory(this.snapshotDir);
    }
    /**
     * Take a snapshot of the current workspace state
     */
    async takeSnapshot(message, operationType) {
        const timestamp = new Date();
        const id = this.generateId();
        // Find all tracked files
        const files = await this.scanWorkspace();
        // Create checkpoint object
        const checkpoint = {
            id,
            commitHash: id, // Use ID as commit hash since we're not using git
            message,
            timestamp,
            operationType,
            filesChanged: files.length,
            author: 'user',
            metadata: {},
            autoCreated: false,
            status: 'active',
            level: 'workspace',
            files,
        };
        // Save snapshot files
        await this.saveSnapshotFiles(checkpoint, files);
        // Save checkpoint metadata
        await this.saveCheckpointMetadata(checkpoint);
        return checkpoint;
    }
    /**
     * Scan workspace for files to track
     */
    async scanWorkspace() {
        const files = [];
        const workspace = vscode.workspace.workspaceFolders?.[0];
        if (!workspace) {
            return files;
        }
        // Use glob to find all files
        const patterns = this.getIncludePatterns();
        const excludePatterns = this.config.ignorePatterns;
        for (const pattern of patterns) {
            const uris = await vscode.workspace.findFiles(new vscode.RelativePattern(workspace, pattern), this.createIgnorePattern(), this.config.maxFileSize);
            for (const uri of uris) {
                const relativePath = path.relative(this.workspaceRoot, uri.fsPath);
                // Check if file should be ignored
                if (this.shouldIgnore(relativePath, excludePatterns)) {
                    continue;
                }
                // Check file size
                try {
                    const stat = await fs.promises.stat(uri.fsPath);
                    if (stat.size > this.config.maxFileSize) {
                        continue;
                    }
                    files.push({
                        path: relativePath,
                        changeType: 'added',
                        size: stat.size,
                        contentHash: await this.hashFile(uri.fsPath),
                    });
                }
                catch {
                    // File might have been deleted, skip it
                }
            }
        }
        return files;
    }
    /**
     * Compare current state with a checkpoint
     */
    async compareWithCheckpoint(checkpoint) {
        const currentFiles = await this.scanWorkspace();
        const checkpointFilesMap = new Map(checkpoint.files.map(f => [f.path, f]));
        const currentFilesMap = new Map(currentFiles.map(f => [f.path, f]));
        const changed = [];
        const added = [];
        const deleted = [];
        // Find changed and deleted files
        for (const [filePath, checkpointFile] of checkpointFilesMap) {
            const currentFile = currentFilesMap.get(filePath);
            if (!currentFile) {
                deleted.push({ ...checkpointFile, changeType: 'deleted' });
            }
            else if (currentFile.contentHash !== checkpointFile.contentHash) {
                changed.push({ ...currentFile, changeType: 'modified' });
            }
        }
        // Find added files
        for (const [filePath, currentFile] of currentFilesMap) {
            if (!checkpointFilesMap.has(filePath)) {
                added.push({ ...currentFile, changeType: 'added' });
            }
        }
        return { changed, added, deleted };
    }
    /**
     * Get file content from a checkpoint
     */
    async getFileContent(checkpointId, filePath) {
        const filePath_ = path.join(this.snapshotDir, checkpointId, filePath);
        try {
            return await fs.promises.readFile(filePath_, 'utf-8');
        }
        catch {
            return undefined;
        }
    }
    /**
     * Restore files from a checkpoint
     */
    async restoreFromCheckpoint(checkpointId, files) {
        const metadataPath = path.join(this.snapshotDir, checkpointId, 'metadata.json');
        let metadata;
        try {
            const data = await fs.promises.readFile(metadataPath, 'utf-8');
            metadata = JSON.parse(data);
        }
        catch {
            throw new Error(`Checkpoint ${checkpointId} not found`);
        }
        const filesToRestore = files || metadata.files.map(f => f.path);
        for (const filePath of filesToRestore) {
            const snapshotFilePath = path.join(this.snapshotDir, checkpointId, filePath);
            const targetFilePath = path.join(this.workspaceRoot, filePath);
            try {
                const content = await fs.promises.readFile(snapshotFilePath, 'utf-8');
                // Ensure directory exists
                const dir = path.dirname(targetFilePath);
                await this.ensureDirectory(dir);
                // Write file
                await fs.promises.writeFile(targetFilePath, content, 'utf-8');
            }
            catch (error) {
                console.error(`Failed to restore file ${filePath}:`, error);
                throw error;
            }
        }
    }
    /**
     * Get diff between two checkpoints
     */
    async getCheckpointDiff(checkpointId1, checkpointId2) {
        const checkpoint1 = await this.loadCheckpointMetadata(checkpointId1);
        const checkpoint2 = await this.loadCheckpointMetadata(checkpointId2);
        if (!checkpoint1 || !checkpoint2) {
            throw new Error('One or both checkpoints not found');
        }
        const files = [];
        const files1Map = new Map(checkpoint1.files.map(f => [f.path, f]));
        const files2Map = new Map(checkpoint2.files.map(f => [f.path, f]));
        // Find differences
        for (const [filePath, file1] of files1Map) {
            const file2 = files2Map.get(filePath);
            if (!file2) {
                // Deleted in checkpoint2
                files.push({
                    path: filePath,
                    changeType: 'deleted',
                    oldContent: await this.getFileContent(checkpointId1, filePath),
                });
            }
            else if (file1.contentHash !== file2.contentHash) {
                // Modified
                files.push({
                    path: filePath,
                    changeType: 'modified',
                    oldContent: await this.getFileContent(checkpointId1, filePath),
                    newContent: await this.getFileContent(checkpointId2, filePath),
                });
            }
        }
        // Find additions
        for (const [filePath, file2] of files2Map) {
            if (!files1Map.has(filePath)) {
                files.push({
                    path: filePath,
                    changeType: 'added',
                    newContent: await this.getFileContent(checkpointId2, filePath),
                });
            }
        }
        return { files };
    }
    /**
     * Calculate workspace state hash
     */
    async calculateStateHash() {
        const files = await this.scanWorkspace();
        const hash = crypto.createHash('md5');
        for (const file of files.sort((a, b) => a.path.localeCompare(b.path))) {
            hash.update(`${file.path}:${file.contentHash}`);
        }
        return hash.digest('hex');
    }
    /**
     * Check if there are significant changes since last snapshot
     */
    async hasSignificantChanges() {
        const currentHash = await this.calculateStateHash();
        if (this.lastSnapshotHash === '') {
            return true; // No previous snapshot
        }
        return currentHash !== this.lastSnapshotHash;
    }
    /**
     * Update last snapshot hash
     */
    updateLastSnapshotHash(hash) {
        this.lastSnapshotHash = hash;
    }
    /**
     * Get the snapshot directory path
     */
    getSnapshotDir() {
        return this.snapshotDir;
    }
    /**
     * Clean up old checkpoints based on retention policy
     */
    async cleanupOldCheckpoints(maxCount) {
        const checkpoints = await this.listCheckpoints();
        if (checkpoints.length <= maxCount) {
            return;
        }
        // Sort by timestamp, oldest first
        checkpoints.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        // Delete oldest checkpoints
        const toDelete = checkpoints.slice(0, checkpoints.length - maxCount);
        for (const checkpoint of toDelete) {
            await this.deleteCheckpointData(checkpoint.id);
        }
    }
    /**
     * List all checkpoints
     */
    async listCheckpoints() {
        const checkpoints = [];
        try {
            const entries = await fs.promises.readdir(this.snapshotDir, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    try {
                        const checkpoint = await this.loadCheckpointMetadata(entry.name);
                        if (checkpoint) {
                            checkpoints.push(checkpoint);
                        }
                    }
                    catch {
                        // Skip invalid checkpoints
                    }
                }
            }
        }
        catch {
            // Directory doesn't exist yet
        }
        // Sort by timestamp, newest first
        return checkpoints.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }
    /**
     * Load checkpoint metadata
     */
    async loadCheckpointMetadata(checkpointId) {
        const metadataPath = path.join(this.snapshotDir, checkpointId, 'metadata.json');
        try {
            const data = await fs.promises.readFile(metadataPath, 'utf-8');
            const parsed = JSON.parse(data);
            // Convert timestamp string to Date
            if (typeof parsed.timestamp === 'string') {
                parsed.timestamp = new Date(parsed.timestamp);
            }
            return parsed;
        }
        catch {
            return undefined;
        }
    }
    /**
     * Delete a checkpoint
     */
    async deleteCheckpoint(checkpointId) {
        const metadata = await this.loadCheckpointMetadata(checkpointId);
        if (metadata) {
            // Mark as deleted instead of actually deleting
            metadata.status = 'deleted';
            await this.saveCheckpointMetadata(metadata);
        }
    }
    /**
     * Get include patterns based on workspace
     */
    getIncludePatterns() {
        return ['**/*'];
    }
    /**
     * Create ignore pattern for VS Code
     */
    createIgnorePattern() {
        const workspace = vscode.workspace.workspaceFolders?.[0];
        if (!workspace) {
            return '**/*';
        }
        const patterns = this.config.ignorePatterns.map(p => `**/${p.replace('**/', '')}`);
        return new vscode.RelativePattern(workspace, `{${patterns.join(',')}}`);
    }
    /**
     * Check if a file should be ignored
     */
    shouldIgnore(relativePath, ignorePatterns) {
        for (const pattern of ignorePatterns) {
            // Simple pattern matching
            if (pattern.endsWith('**')) {
                const prefix = pattern.slice(0, -2);
                if (relativePath.startsWith(prefix) || relativePath.includes(prefix)) {
                    return true;
                }
            }
            else if (relativePath.includes(pattern)) {
                return true;
            }
        }
        return false;
    }
    /**
     * Generate unique ID
     */
    generateId() {
        return `cp_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    }
    /**
     * Hash a file's content
     */
    async hashFile(filePath) {
        try {
            const content = await fs.promises.readFile(filePath);
            return crypto.createHash('md5').update(content).digest('hex');
        }
        catch {
            return '';
        }
    }
    /**
     * Save snapshot files
     */
    async saveSnapshotFiles(checkpoint, files) {
        const checkpointDir = path.join(this.snapshotDir, checkpoint.id);
        await this.ensureDirectory(checkpointDir);
        for (const file of files) {
            const sourcePath = path.join(this.workspaceRoot, file.path);
            const targetPath = path.join(checkpointDir, file.path);
            try {
                // Ensure directory exists
                await this.ensureDirectory(path.dirname(targetPath));
                // Copy file
                await fs.promises.copyFile(sourcePath, targetPath);
            }
            catch {
                // File might not exist or be inaccessible
            }
        }
    }
    /**
     * Save checkpoint metadata
     */
    async saveCheckpointMetadata(checkpoint) {
        const checkpointDir = path.join(this.snapshotDir, checkpoint.id);
        await this.ensureDirectory(checkpointDir);
        const metadataPath = path.join(checkpointDir, 'metadata.json');
        await fs.promises.writeFile(metadataPath, JSON.stringify(checkpoint, null, 2), 'utf-8');
    }
    /**
     * Delete checkpoint data
     */
    async deleteCheckpointData(checkpointId) {
        const checkpointDir = path.join(this.snapshotDir, checkpointId);
        try {
            await fs.promises.rm(checkpointDir, { recursive: true, force: true });
        }
        catch {
            // Ignore errors
        }
    }
    /**
     * Ensure directory exists
     */
    async ensureDirectory(dirPath) {
        try {
            await fs.promises.mkdir(dirPath, { recursive: true });
        }
        catch (error) {
            // Directory might already exist
        }
    }
}
exports.SnapshotEngine = SnapshotEngine;
//# sourceMappingURL=snapshot.js.map