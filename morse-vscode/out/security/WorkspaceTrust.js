"use strict";
/**
 * Morse Workspace Trust
 * Security features for workspace trust decisions
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
exports.MorseWorkspaceTrust = exports.DEFAULT_TRUST_CONFIG = void 0;
exports.createMorseWorkspaceTrust = createMorseWorkspaceTrust;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
/**
 * Default trust configuration
 */
exports.DEFAULT_TRUST_CONFIG = {
    autoTrust: false,
    trustedPaths: [],
    untrustedPaths: [],
    requireConfirmation: true,
    showWarnings: true,
};
/**
 * Morse Workspace Trust Manager
 * Handles security decisions for workspace access
 */
class MorseWorkspaceTrust {
    config;
    trustState = new Map();
    context = null;
    constructor(config) {
        this.config = { ...exports.DEFAULT_TRUST_CONFIG, ...config };
    }
    /**
     * Initialize the workspace trust manager
     */
    async initialize(context) {
        this.context = context;
        // Load saved trust decisions
        await this.loadTrustDecisions();
        // Register trust-related commands
        this.registerCommands(context);
        // Set up workspace trust listener
        this.registerTrustListener(context);
        console.log('Morse Workspace Trust initialized');
    }
    /**
     * Register trust-related commands
     */
    registerCommands(context) {
        // Command to manually trust a workspace
        context.subscriptions.push(vscode.commands.registerCommand('morse.trustWorkspace', async (workspacePath) => {
            const pathToTrust = workspacePath || this.getCurrentWorkspacePath();
            if (pathToTrust) {
                await this.trustWorkspace(pathToTrust);
            }
        }));
        // Command to untrust a workspace
        context.subscriptions.push(vscode.commands.registerCommand('morse.untrustWorkspace', async (workspacePath) => {
            const pathToUntrust = workspacePath || this.getCurrentWorkspacePath();
            if (pathToUntrust) {
                await this.untrustWorkspace(pathToUntrust);
            }
        }));
        // Command to check current workspace trust status
        context.subscriptions.push(vscode.commands.registerCommand('morse.checkWorkspaceTrust', async () => {
            const currentPath = this.getCurrentWorkspacePath();
            if (currentPath) {
                const status = await this.checkTrust(currentPath);
                this.showTrustStatus(status);
            }
        }));
        // Command to manage trusted paths
        context.subscriptions.push(vscode.commands.registerCommand('morse.manageTrustedPaths', async () => {
            await this.showTrustedPathsManager();
        }));
        // Command to reset all trust decisions
        context.subscriptions.push(vscode.commands.registerCommand('morse.resetTrustDecisions', async () => {
            await this.resetAllTrustDecisions();
        }));
    }
    /**
     * Register workspace trust change listener
     */
    registerTrustListener(context) {
        context.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders(async () => {
            // Check trust for new workspace folders
            const folders = vscode.workspace.workspaceFolders;
            if (folders) {
                for (const folder of folders) {
                    const status = await this.checkTrust(folder.uri.fsPath);
                    if (!status.isTrusted && this.config.showWarnings) {
                        this.showTrustWarning(folder.uri.fsPath);
                    }
                }
            }
        }));
    }
    /**
     * Get the current workspace path
     */
    getCurrentWorkspacePath() {
        const folders = vscode.workspace.workspaceFolders;
        if (folders && folders.length > 0) {
            return folders[0].uri.fsPath;
        }
        return null;
    }
    /**
     * Check if a workspace is trusted
     */
    async checkTrust(workspacePath) {
        const normalizedPath = path.normalize(workspacePath);
        const result = {
            isTrusted: false,
            reasons: [],
            warnings: [],
            restrictions: [],
        };
        // Check if explicitly trusted
        if (this.trustState.has(normalizedPath)) {
            result.isTrusted = this.trustState.get(normalizedPath) || false;
            result.reasons.push(`Explicit ${result.isTrusted ? 'trust' : 'distrust'} decision`);
            return result;
        }
        // Check if in trusted paths list
        for (const trustedPath of this.config.trustedPaths) {
            if (normalizedPath.startsWith(path.normalize(trustedPath))) {
                result.isTrusted = true;
                result.reasons.push(`Path matches trusted pattern: ${trustedPath}`);
                return result;
            }
        }
        // Check if in untrusted paths list
        for (const untrustedPath of this.config.untrustedPaths) {
            if (normalizedPath.startsWith(path.normalize(untrustedPath))) {
                result.isTrusted = false;
                result.reasons.push(`Path matches untrusted pattern: ${untrustedPath}`);
                result.restrictions.push('All Morse operations are blocked');
                return result;
            }
        }
        // Auto-trust home directory
        const homeDir = require('os').homedir();
        if (normalizedPath.startsWith(homeDir)) {
            result.isTrusted = this.config.autoTrust;
            result.reasons.push(result.isTrusted
                ? 'Auto-trusting home directory'
                : 'Home directory requires manual trust');
            return result;
        }
        // Check for Morse configuration files
        const morseConfigPath = path.join(normalizedPath, '.morse', 'config.yaml');
        const morseConfigJson = path.join(normalizedPath, '.morse', 'config.json');
        if (fs.existsSync(morseConfigPath) || fs.existsSync(morseConfigJson)) {
            result.isTrusted = true;
            result.reasons.push('Morse configuration file found');
            return result;
        }
        // Check for package.json (project root indicator)
        const packageJsonPath = path.join(normalizedPath, 'package.json');
        const requirementsPath = path.join(normalizedPath, 'requirements.txt');
        const goModPath = path.join(normalizedPath, 'go.mod');
        const cargoTomlPath = path.join(normalizedPath, 'Cargo.toml');
        if (fs.existsSync(packageJsonPath) ||
            fs.existsSync(requirementsPath) ||
            fs.existsSync(goModPath) ||
            fs.existsSync(cargoTomlPath)) {
            result.isTrusted = this.config.autoTrust;
            result.reasons.push(result.isTrusted
                ? 'Auto-trusting project root'
                : 'Project root requires manual trust');
            return result;
        }
        // Default: require confirmation
        if (this.config.requireConfirmation) {
            result.warnings.push('Workspace trust not determined, confirmation required');
        }
        return result;
    }
    /**
     * Trust a workspace
     */
    async trustWorkspace(workspacePath) {
        const normalizedPath = path.normalize(workspacePath);
        this.trustState.set(normalizedPath, true);
        await this.saveTrustDecisions();
        // Update config
        if (!this.config.trustedPaths.includes(normalizedPath)) {
            this.config.trustedPaths.push(normalizedPath);
        }
        // Remove from untrusted if present
        this.config.untrustedPaths = this.config.untrustedPaths.filter(p => !normalizedPath.startsWith(p));
        // Show confirmation
        vscode.window.showInformationMessage(`Workspace "${path.basename(normalizedPath)}" is now trusted by Morse`, 'OK');
        // Trigger any pending operations
        this.triggerPendingOperations(normalizedPath);
    }
    /**
     * Untrust a workspace
     */
    async untrustWorkspace(workspacePath) {
        const normalizedPath = path.normalize(workspacePath);
        this.trustState.set(normalizedPath, false);
        await this.saveTrustDecisions();
        // Update config
        if (!this.config.untrustedPaths.includes(normalizedPath)) {
            this.config.untrustedPaths.push(normalizedPath);
        }
        // Remove from trusted if present
        this.config.trustedPaths = this.config.trustedPaths.filter(p => !normalizedPath.startsWith(p));
        // Show confirmation
        vscode.window.showWarningMessage(`Workspace "${path.basename(normalizedPath)}" is now untrusted by Morse`, 'OK');
        // Block any pending operations
        this.blockPendingOperations(normalizedPath);
    }
    /**
     * Show trust status for a workspace
     */
    showTrustStatus(result) {
        const message = result.isTrusted
            ? '✅ Workspace is trusted'
            : '⚠️ Workspace is not trusted';
        const items = [];
        if (result.reasons.length > 0) {
            items.push(...result.reasons.map(r => `• ${r}`));
        }
        if (result.warnings.length > 0) {
            items.push(...result.warnings.map(w => `⚠️ ${w}`));
        }
        if (result.restrictions.length > 0) {
            items.push(...result.restrictions.map(r => `🚫 ${r}`));
        }
        if (items.length > 0) {
            vscode.window.showInformationMessage(`${message}\n\n${items.join('\n')}`, 'Manage Trust').then(selection => {
                if (selection === 'Manage Trust') {
                    vscode.commands.executeCommand('morse.manageTrustedPaths');
                }
            });
        }
        else {
            vscode.window.showInformationMessage(message);
        }
    }
    /**
     * Show trust warning for a workspace
     */
    showTrustWarning(workspacePath) {
        const workspaceName = path.basename(workspacePath);
        vscode.window.showWarningMessage(`Morse: The workspace "${workspaceName}" is not trusted`, 'Trust Workspace', 'Ignore').then(async (selection) => {
            if (selection === 'Trust Workspace') {
                await this.trustWorkspace(workspacePath);
            }
        });
    }
    /**
     * Show trusted paths manager
     */
    async showTrustedPathsManager() {
        const items = [];
        // Add trusted paths
        for (const trustedPath of this.config.trustedPaths) {
            items.push({
                label: `✅ ${trustedPath}`,
                description: 'Trusted',
                detail: 'Click to remove from trusted paths',
            });
        }
        // Add untrusted paths
        for (const untrustedPath of this.config.untrustedPaths) {
            items.push({
                label: `🚫 ${untrustedPath}`,
                description: 'Untrusted',
                detail: 'Click to remove from untrusted paths',
            });
        }
        if (items.length === 0) {
            items.push({
                label: 'No trust decisions yet',
                description: '',
                detail: 'Open a workspace to make a trust decision',
            });
        }
        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Manage trusted and untrusted paths',
            canPickMany: false,
        });
        if (selected) {
            const pathStr = selected.label.replace(/^[✅🚫]\s*/, '');
            // Check if it was a trusted path
            if (this.config.trustedPaths.includes(pathStr)) {
                this.config.trustedPaths = this.config.trustedPaths.filter(p => p !== pathStr);
            }
            // Check if it was an untrusted path
            if (this.config.untrustedPaths.includes(pathStr)) {
                this.config.untrustedPaths = this.config.untrustedPaths.filter(p => p !== pathStr);
            }
            // Clear from trust state
            this.trustState.delete(pathStr);
            await this.saveTrustDecisions();
        }
    }
    /**
     * Reset all trust decisions
     */
    async resetAllTrustDecisions() {
        const confirm = await vscode.window.showWarningMessage('Are you sure you want to reset all trust decisions?', { modal: true }, 'Reset', 'Cancel');
        if (confirm === 'Reset') {
            this.trustState.clear();
            this.config.trustedPaths = [];
            this.config.untrustedPaths = [];
            await this.saveTrustDecisions();
            vscode.window.showInformationMessage('All trust decisions have been reset');
        }
    }
    /**
     * Load trust decisions from storage
     */
    async loadTrustDecisions() {
        if (!this.context)
            return;
        try {
            const trustData = this.context.globalState.get('morse.trustDecisions');
            if (trustData) {
                this.config.trustedPaths = trustData.trustedPaths || [];
                this.config.untrustedPaths = trustData.untrustedPaths || [];
                if (trustData.trustState) {
                    for (const [path, trusted] of Object.entries(trustData.trustState)) {
                        this.trustState.set(path, trusted);
                    }
                }
            }
        }
        catch (error) {
            console.error('Error loading trust decisions:', error);
        }
    }
    /**
     * Save trust decisions to storage
     */
    async saveTrustDecisions() {
        if (!this.context)
            return;
        try {
            const trustData = {
                trustedPaths: this.config.trustedPaths,
                untrustedPaths: this.config.untrustedPaths,
                trustState: Object.fromEntries(this.trustState),
            };
            await this.context.globalState.update('morse.trustDecisions', trustData);
        }
        catch (error) {
            console.error('Error saving trust decisions:', error);
        }
    }
    /**
     * Trigger pending operations for a newly trusted workspace
     */
    triggerPendingOperations(workspacePath) {
        // This could trigger any operations that were waiting for trust
        vscode.commands.executeCommand('morse.refresh');
    }
    /**
     * Block pending operations for an untrusted workspace
     */
    blockPendingOperations(workspacePath) {
        // This could cancel any ongoing operations
        vscode.window.showWarningMessage('Operations have been blocked for this untrusted workspace');
    }
    /**
     * Validate a file operation
     */
    async validateFileOperation(filePath, operation) {
        const workspacePath = this.findWorkspaceForPath(filePath);
        if (!workspacePath) {
            return {
                isTrusted: true,
                reasons: ['No workspace associated with file'],
                warnings: [],
                restrictions: [],
            };
        }
        const trustResult = await this.checkTrust(workspacePath);
        if (!trustResult.isTrusted) {
            trustResult.restrictions.push(`Cannot ${operation} file in untrusted workspace`);
        }
        // Additional security checks
        const normalizedPath = path.normalize(filePath);
        // Check for sensitive files
        const sensitivePatterns = [
            /\bpassword\b/i,
            /\bsecret\b/i,
            /\bapi[_-]?key\b/i,
            /\btoken\b/i,
            /\.env$/i,
            /\.pem$/i,
            /\.key$/i,
            /\.github\/actions\/secrets\b/,
        ];
        for (const pattern of sensitivePatterns) {
            if (pattern.test(normalizedPath)) {
                trustResult.warnings.push(`Warning: File may contain sensitive data: ${path.basename(normalizedPath)}`);
                if (operation === 'write') {
                    trustResult.restrictions.push('Writing to sensitive files requires explicit trust');
                }
            }
        }
        return trustResult;
    }
    /**
     * Find the workspace path for a given file path
     */
    findWorkspaceForPath(filePath) {
        const folders = vscode.workspace.workspaceFolders;
        if (!folders)
            return null;
        const normalizedPath = path.normalize(filePath);
        for (const folder of folders) {
            const folderPath = path.normalize(folder.uri.fsPath);
            if (normalizedPath.startsWith(folderPath)) {
                return folderPath;
            }
        }
        return null;
    }
    /**
     * Get current configuration
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * Update configuration
     */
    updateConfig(config) {
        this.config = { ...this.config, ...config };
    }
    /**
     * Dispose of the workspace trust manager
     */
    dispose() {
        this.trustState.clear();
    }
}
exports.MorseWorkspaceTrust = MorseWorkspaceTrust;
/**
 * Create and register the Morse workspace trust manager
 */
function createMorseWorkspaceTrust(context, config) {
    const trustManager = new MorseWorkspaceTrust(config);
    trustManager.initialize(context);
    return trustManager;
}
//# sourceMappingURL=WorkspaceTrust.js.map