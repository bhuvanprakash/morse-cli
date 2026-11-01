"use strict";
/**
 * Skills Loader
 * Loads and parses skills from the .morse/skills directory
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
exports.SkillsLoader = void 0;
exports.createSkillsLoader = createSkillsLoader;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const types_1 = require("./types");
/**
 * YAML frontmatter parser
 */
function parseFrontmatter(content) {
    const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
    const match = content.match(frontmatterRegex);
    if (!match) {
        return {
            metadata: {},
            body: content
        };
    }
    const frontmatter = match[1];
    const body = match[2];
    // Simple YAML parser for frontmatter
    const metadata = {};
    const lines = frontmatter.split('\n');
    let currentKey = '';
    let currentValue = [];
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed)
            continue;
        const keyMatch = trimmed.match(/^(\w+(?:-\w+)*):\s*(.*)$/);
        if (keyMatch) {
            // Save previous key
            if (currentKey) {
                metadata[currentKey] = currentValue.join(' ').trim();
            }
            currentKey = keyMatch[1];
            currentValue = [keyMatch[2]];
        }
        else if (trimmed.startsWith('- ') && currentKey) {
            currentValue.push(trimmed.substring(2));
        }
    }
    // Save last key
    if (currentKey) {
        metadata[currentKey] = currentValue.join(' ').trim();
    }
    return { metadata, body };
}
/**
 * Parse skill ID from directory name
 */
function parseSkillId(dirName) {
    return dirName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
/**
 * Infer category from skill name/path
 */
function inferCategory(skillPath, skillName) {
    const pathLower = skillPath.toLowerCase();
    const nameLower = skillName.toLowerCase();
    // Check path for category hints
    if (pathLower.includes('azure-') || pathLower.includes('aws-') || pathLower.includes('gcp-') || pathLower.includes('cloud')) {
        return 'cloud';
    }
    if (pathLower.includes('security') || pathLower.includes('attack') || pathLower.includes('penetration')) {
        return 'security';
    }
    if (pathLower.includes('ai-') || pathLower.includes('ml-') || pathLower.includes('llm') || pathLower.includes('rag')) {
        return 'ai-ml';
    }
    if (pathLower.includes('frontend') || pathLower.includes('react') || pathLower.includes('vue') || pathLower.includes('angular')) {
        return 'frontend';
    }
    if (pathLower.includes('backend') || pathLower.includes('api-')) {
        return 'backend';
    }
    if (pathLower.includes('devops') || pathLower.includes('deploy') || pathLower.includes('docker') || pathLower.includes('k8s')) {
        return 'devops';
    }
    if (pathLower.includes('database') || pathLower.includes('sql') || pathLower.includes('db-')) {
        return 'database';
    }
    if (pathLower.includes('mobile') || pathLower.includes('android') || pathLower.includes('ios')) {
        return 'mobile';
    }
    if (pathLower.includes('test') || pathLower.includes('e2e') || pathLower.includes('spec')) {
        return 'testing';
    }
    if (pathLower.includes('architect') || pathLower.includes('architecture')) {
        return 'architecture';
    }
    if (pathLower.includes('product') || pathLower.includes('pm-')) {
        return 'product';
    }
    if (pathLower.includes('automate') || pathLower.includes('workflow')) {
        return 'automation';
    }
    if (pathLower.includes('development') || pathLower.includes('code') || pathLower.includes('programming')) {
        return 'development';
    }
    return 'other';
}
/**
 * Extract commands from skill content
 */
function extractCommands(content) {
    const commands = [];
    // Look for "## Commands" or "## Capabilities" sections
    const commandSectionMatch = content.match(/##\s+(?:Commands|Capabilities|Features)\s*\n([\s\S]*?)(?:\n##|\n$)/i);
    if (commandSectionMatch) {
        const lines = commandSectionMatch[1].split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                const commandText = trimmed.substring(2).trim();
                const commandMatch = commandText.match(/^(\w+)(?:\s+(.*))?$/);
                if (commandMatch) {
                    commands.push({
                        id: commandMatch[1].toLowerCase(),
                        name: commandMatch[1],
                        description: commandMatch[2] || commandText,
                        parameters: []
                    });
                }
            }
        }
    }
    // If no commands found, create a default "invoke" command
    if (commands.length === 0) {
        commands.push({
            id: 'invoke',
            name: 'Invoke',
            description: 'Invoke this skill with the current context',
            parameters: []
        });
    }
    return commands;
}
/**
 * Parse a single skill from a directory
 */
async function parseSkill(skillDir) {
    const dirName = path.basename(skillDir.fsPath);
    const skillPath = skillDir.fsPath;
    try {
        // Look for SKILL.md file
        const skillFilePath = path.join(skillPath, 'SKILL.md');
        if (!fs.existsSync(skillFilePath)) {
            return {
                success: false,
                error: `No SKILL.md found in ${dirName}`
            };
        }
        const content = fs.readFileSync(skillFilePath, 'utf-8');
        const { metadata, body } = parseFrontmatter(content);
        // Parse metadata
        const skillMetadata = {
            name: metadata.name || dirName,
            description: metadata.description || body.substring(0, 200),
            risk: metadata.risk || 'unknown',
            source: metadata.source || 'community',
            dateAdded: metadata.date_added || new Date().toISOString().split('T')[0],
            version: metadata.version || '1.0.0',
            author: metadata.author,
            tags: Array.isArray(metadata.tags) ? metadata.tags : undefined,
            dependencies: Array.isArray(metadata.dependencies) ? metadata.dependencies : undefined
        };
        // Determine category
        const category = inferCategory(skillPath, skillMetadata.name);
        // Extract commands from content
        const commands = extractCommands(body);
        const skill = {
            id: parseSkillId(dirName),
            metadata: skillMetadata,
            content: body,
            category,
            enabled: true,
            path: skillDir,
            commands,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        return {
            success: true,
            skill
        };
    }
    catch (error) {
        return {
            success: false,
            error: `Failed to parse skill ${dirName}: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
    }
}
/**
 * Skills Loader class
 * Loads skills from the .morse/skills directory with caching and file watching
 */
class SkillsLoader {
    config;
    cache = new Map();
    fileWatcher = null;
    eventEmitter = new vscode.EventEmitter();
    loadCompleteEmitter = new vscode.EventEmitter();
    errorEmitter = new vscode.EventEmitter();
    constructor(config = {}) {
        this.config = { ...types_1.DEFAULT_SKILLS_CONFIG, ...config };
    }
    /**
     * Event fired when a skill is loaded
     */
    get onSkillLoaded() {
        return this.eventEmitter.event;
    }
    /**
     * Event fired when all skills are loaded
     */
    get onLoadingComplete() {
        return this.loadCompleteEmitter.event;
    }
    /**
     * Event fired when an error occurs
     */
    get onError() {
        return this.errorEmitter.event;
    }
    /**
     * Get the skills directory path
     */
    getSkillsPath() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return null;
        }
        // Use first workspace folder
        const workspaceRoot = workspaceFolders[0].uri;
        return vscode.Uri.joinPath(workspaceRoot, this.config.skillsPath);
    }
    /**
     * Check if cache is valid
     */
    isCacheValid(skillId) {
        if (!this.config.cacheEnabled) {
            return false;
        }
        const cached = this.cache.get(skillId);
        if (!cached) {
            return false;
        }
        const expirationMs = this.config.cacheExpirationMinutes * 60 * 1000;
        return Date.now() - cached.timestamp < expirationMs;
    }
    /**
     * Load a single skill by ID
     */
    async loadSkill(skillId) {
        // Check cache first
        if (this.isCacheValid(skillId)) {
            return {
                success: true,
                skill: this.cache.get(skillId).skill
            };
        }
        const skillsPath = this.getSkillsPath();
        if (!skillsPath) {
            return {
                success: false,
                error: 'No workspace folder found'
            };
        }
        try {
            // Find the skill directory
            const skillsDir = await vscode.workspace.fs.readDirectory(skillsPath);
            for (const [dirName, fileType] of skillsDir) {
                if (fileType === vscode.FileType.Directory) {
                    const parsedId = parseSkillId(dirName);
                    if (parsedId === skillId) {
                        const skillDir = vscode.Uri.joinPath(skillsPath, dirName);
                        const result = await parseSkill(skillDir);
                        if (result.success && result.skill) {
                            this.cache.set(skillId, {
                                skill: result.skill,
                                timestamp: Date.now()
                            });
                        }
                        return result;
                    }
                }
            }
            return {
                success: false,
                error: `Skill ${skillId} not found`
            };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    /**
     * Load all skills from the skills directory
     */
    async loadAllSkills() {
        const skillsPath = this.getSkillsPath();
        if (!skillsPath) {
            console.log('[Skills] No workspace folder found');
            this.loadCompleteEmitter.fire([]);
            return [];
        }
        try {
            // Check if skills directory exists
            const skillsDir = await vscode.workspace.fs.readDirectory(skillsPath);
            const skills = [];
            for (const [dirName, fileType] of skillsDir) {
                if (fileType === vscode.FileType.Directory) {
                    const skillDir = vscode.Uri.joinPath(skillsPath, dirName);
                    const result = await parseSkill(skillDir);
                    if (result.success && result.skill) {
                        skills.push(result.skill);
                        this.cache.set(result.skill.id, {
                            skill: result.skill,
                            timestamp: Date.now()
                        });
                        this.eventEmitter.fire(result.skill);
                    }
                }
            }
            console.log(`[Skills] Loaded ${skills.length} skills`);
            this.loadCompleteEmitter.fire(skills);
            return skills;
        }
        catch (error) {
            // Skills directory doesn't exist or is not accessible
            console.log(`[Skills] Skills directory not found at ${skillsPath.fsPath}`);
            this.loadCompleteEmitter.fire([]);
            return [];
        }
    }
    /**
     * Start watching for skill changes
     */
    startWatching(context) {
        if (!this.config.watchForChanges) {
            return;
        }
        const skillsPath = this.getSkillsPath();
        if (!skillsPath) {
            return;
        }
        try {
            this.fileWatcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(skillsPath, '**/SKILL.md'));
            this.fileWatcher.onDidChange(async (uri) => {
                console.log(`[Skills] Skill file changed: ${uri.fsPath}`);
                const skillDir = vscode.Uri.joinPath(vscode.Uri.file(path.dirname(uri.fsPath)), '..');
                const dirName = path.basename(skillDir.fsPath);
                const skillId = parseSkillId(dirName);
                // Invalidate cache
                this.cache.delete(skillId);
                // Reload the skill
                const result = await parseSkill(skillDir);
                if (result.success && result.skill) {
                    this.cache.set(skillId, {
                        skill: result.skill,
                        timestamp: Date.now()
                    });
                    this.eventEmitter.fire(result.skill);
                }
            });
            this.fileWatcher.onDidCreate(async (uri) => {
                console.log(`[Skills] New skill created: ${uri.fsPath}`);
                await this.loadAllSkills();
            });
            this.fileWatcher.onDidDelete((uri) => {
                console.log(`[Skills] Skill deleted: ${uri.fsPath}`);
                const skillDir = vscode.Uri.joinPath(vscode.Uri.file(path.dirname(uri.fsPath)), '..');
                const dirName = path.basename(skillDir.fsPath);
                const skillId = parseSkillId(dirName);
                this.cache.delete(skillId);
            });
            context.subscriptions.push(this.fileWatcher);
            console.log('[Skills] File watcher started');
        }
        catch (error) {
            console.error('[Skills] Failed to start file watcher:', error);
        }
    }
    /**
     * Stop watching for skill changes
     */
    stopWatching() {
        if (this.fileWatcher) {
            this.fileWatcher.dispose();
            this.fileWatcher = null;
            console.log('[Skills] File watcher stopped');
        }
    }
    /**
     * Clear the skills cache
     */
    clearCache() {
        this.cache.clear();
        console.log('[Skills] Cache cleared');
    }
    /**
     * Get the skills directory path
     */
    getSkillsDirectory() {
        return this.getSkillsPath();
    }
    /**
     * Dispose the loader
     */
    dispose() {
        this.stopWatching();
        this.eventEmitter.dispose();
        this.loadCompleteEmitter.dispose();
        this.errorEmitter.dispose();
    }
}
exports.SkillsLoader = SkillsLoader;
/**
 * Create a default skills loader
 */
function createSkillsLoader(config) {
    return new SkillsLoader(config);
}
//# sourceMappingURL=loader.js.map