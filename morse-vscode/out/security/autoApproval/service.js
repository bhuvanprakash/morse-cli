"use strict";
/**
 * Auto-Approval Service
 *
 * Core service for managing approval requests and decisions.
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
exports.AutoApprovalService = void 0;
exports.createAutoApprovalService = createAutoApprovalService;
const vscode = __importStar(require("vscode"));
const types_1 = require("./types");
const rules_1 = require("./rules");
const history_1 = require("./history");
/**
 * Generate a simple unique ID
 */
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 15);
}
/**
 * Auto-Approval Service
 * Manages risk assessment and approval workflows
 */
class AutoApprovalService {
    config;
    rules;
    history;
    context = null;
    currentRiskLevel = 'low';
    approvalCallback = null;
    autoApproveSessions = new Map();
    pendingRequests = new Map();
    constructor() {
        this.config = types_1.DEFAULT_APPROVAL_CONFIG;
        this.rules = rules_1.RiskRules.fromConfig({
            customRules: this.config.customRules,
            dangerPatterns: this.config.dangerPatterns,
        });
        this.history = new history_1.ApprovalHistory();
    }
    /**
     * Initialize the service with VS Code extension context
     */
    async initialize(context) {
        this.context = context;
        await this.loadSettings();
        // Register commands
        this.registerCommands(context);
        console.log('[AutoApproval] Service initialized');
    }
    /**
     * Load settings from VS Code configuration
     */
    async loadSettings() {
        if (!this.context)
            return;
        const config = vscode.workspace.getConfiguration('morse');
        const settings = {
            enabled: config.get('approval.enabled') ?? types_1.DEFAULT_APPROVAL_SETTINGS.enabled,
            autoApproveLowRisk: config.get('approval.autoApproveLowRisk') ?? types_1.DEFAULT_APPROVAL_SETTINGS.autoApproveLowRisk,
            autoDenyCritical: config.get('approval.autoDenyCritical') ?? types_1.DEFAULT_APPROVAL_SETTINGS.autoDenyCritical,
            defaultLevel: config.get('approval.defaultLevel') ?? types_1.DEFAULT_APPROVAL_SETTINGS.defaultLevel,
            showStatusBarIndicator: config.get('approval.showStatusBarIndicator') ?? types_1.DEFAULT_APPROVAL_SETTINGS.showStatusBarIndicator,
            showNotifications: config.get('approval.showNotifications') ?? types_1.DEFAULT_APPROVAL_SETTINGS.showNotifications,
            autoApproveDuration: config.get('approval.autoApproveDuration') ?? types_1.DEFAULT_APPROVAL_SETTINGS.autoApproveDuration,
        };
        // Update config
        this.config = {
            ...types_1.DEFAULT_APPROVAL_CONFIG,
            enabled: settings.enabled,
            autoApproveLowRisk: settings.autoApproveLowRisk,
            autoDenyCritical: settings.autoDenyCritical,
            defaultLevel: settings.defaultLevel,
            autoApproveDuration: settings.autoApproveDuration,
        };
        // Update rules
        this.rules = rules_1.RiskRules.fromConfig({
            customRules: this.config.customRules,
            dangerPatterns: this.config.dangerPatterns,
        });
        // Update history settings
        this.history.setMaxEntries(1000);
    }
    /**
     * Register commands for the approval system
     */
    registerCommands(context) {
        // Enable auto-approve for session
        context.subscriptions.push(vscode.commands.registerCommand('morse.approval.enableAutoApprove', async () => {
            const sessionId = this.getCurrentSessionId();
            if (sessionId) {
                this.enableAutoApproveSession(sessionId);
                vscode.window.showInformationMessage('Auto-approve enabled for this session');
            }
        }));
        // Disable auto-approve for session
        context.subscriptions.push(vscode.commands.registerCommand('morse.approval.disableAutoApprove', async () => {
            const sessionId = this.getCurrentSessionId();
            if (sessionId) {
                this.disableAutoApproveSession(sessionId);
                vscode.window.showInformationMessage('Auto-approve disabled for this session');
            }
        }));
        // Show approval history
        context.subscriptions.push(vscode.commands.registerCommand('morse.approval.showHistory', async () => {
            await this.showApprovalHistory();
        }));
        // Configure approval settings
        context.subscriptions.push(vscode.commands.registerCommand('morse.approval.configure', async () => {
            await this.configureApproval();
        }));
    }
    /**
     * Set the approval callback for requesting user approval
     */
    setApprovalCallback(callback) {
        this.approvalCallback = callback;
    }
    /**
     * Assess an action and determine if approval is required
     */
    async assessAction(action) {
        let assessment;
        switch (action.toolName) {
            case 'bash':
            case 'shell':
            case 'execute_command':
                if (typeof action.params === 'string') {
                    assessment = this.rules.assessCommand(action.params);
                }
                else if (action.params && typeof action.params === 'object' && 'command' in action.params) {
                    assessment = this.rules.assessCommand(String(action.params.command));
                }
                else {
                    assessment = this.rules.assessCommand(action.description);
                }
                break;
            case 'write_file':
            case 'edit_file':
            case 'delete_file':
                assessment = this.rules.assessFileOperation(action.path || action.description, action.toolName === 'delete_file' ? 'delete' : 'write');
                break;
            case 'read_file':
            case 'search_files':
            case 'glob':
                assessment = this.rules.assessFileOperation(action.path || action.description, 'read');
                break;
            case 'fetch':
            case 'http_request':
                if (action.params && typeof action.params === 'object') {
                    const params = action.params;
                    assessment = this.rules.assessNetworkAccess(params.url || action.description, params.method);
                }
                else {
                    assessment = this.rules.assessNetworkAccess(action.description);
                }
                break;
            default:
                // Default assessment for unknown tools
                assessment = {
                    level: 'low',
                    factors: [],
                    requiresApproval: false,
                    message: `Tool "${action.toolName}" has default low risk`,
                };
        }
        // Update current risk level
        this.currentRiskLevel = assessment.level;
        return assessment;
    }
    /**
     * Request approval for an action
     */
    async requestApproval(action) {
        // If disabled, auto-approve
        if (!this.config.enabled) {
            return {
                approved: true,
                timestamp: new Date(),
            };
        }
        // Check if session has auto-approve enabled
        const sessionId = action.sessionId || this.getCurrentSessionId();
        if (sessionId && this.autoApproveSessions.get(sessionId)) {
            const response = {
                approved: true,
                timestamp: new Date(),
            };
            await this.recordApproval(action, { level: 'low', factors: [], requiresApproval: false }, 'auto_approved', response);
            return response;
        }
        // Check tool-specific permission level
        const toolPermission = this.config.toolOverrides[action.toolName];
        if (toolPermission === 'allow') {
            const response = {
                approved: true,
                timestamp: new Date(),
            };
            await this.recordApproval(action, { level: 'low', factors: [], requiresApproval: false }, 'auto_approved', response);
            return response;
        }
        if (toolPermission === 'deny') {
            const response = {
                approved: false,
                timestamp: new Date(),
            };
            await this.recordApproval(action, { level: 'high', factors: [], requiresApproval: true }, 'auto_denied', response);
            return response;
        }
        // Assess the action
        const assessment = await this.assessAction(action);
        // Auto-approve low risk if configured
        if (assessment.level === 'low' && this.config.autoApproveLowRisk) {
            const response = {
                approved: true,
                timestamp: new Date(),
            };
            await this.recordApproval(action, assessment, 'auto_approved', response);
            return response;
        }
        // Auto-deny critical if configured
        if (assessment.level === 'critical' && this.config.autoDenyCritical) {
            const response = {
                approved: false,
                justification: 'Critical risk actions are automatically denied',
                timestamp: new Date(),
            };
            if (this.config.showNotifications) {
                vscode.window.showWarningMessage(`Action denied: ${action.description} (Critical risk level)`);
            }
            await this.recordApproval(action, assessment, 'auto_denied', response);
            return response;
        }
        // Check if approval is required
        if (!(0, types_1.requiresApproval)(assessment.level, this.config)) {
            const response = {
                approved: true,
                timestamp: new Date(),
            };
            await this.recordApproval(action, assessment, 'auto_approved', response);
            return response;
        }
        // Request approval from user
        if (this.approvalCallback) {
            const request = {
                id: generateId(),
                action,
                riskAssessment: assessment,
                requestedAt: new Date(),
                status: 'pending',
            };
            try {
                const response = await this.approvalCallback(request);
                // Record in history
                await this.recordApproval(action, assessment, response.approved ? 'approved' : 'denied', response);
                return response;
            }
            catch (error) {
                // If callback fails, deny by default
                const response = {
                    approved: false,
                    justification: error instanceof Error ? error.message : 'Unknown error',
                    timestamp: new Date(),
                };
                await this.recordApproval(action, assessment, 'denied', response);
                return response;
            }
        }
        // No callback configured, deny by default
        const response = {
            approved: false,
            justification: 'No approval callback configured',
            timestamp: new Date(),
        };
        await this.recordApproval(action, assessment, 'denied', response);
        return response;
    }
    /**
     * Record an approval decision in history
     */
    async recordApproval(action, assessment, status, response) {
        const entry = {
            id: generateId(),
            action,
            riskAssessment: assessment,
            status,
            justification: response.justification,
            override: response.override || false,
            timestamp: new Date(),
            sessionId: action.sessionId,
        };
        await this.history.addEntry(entry);
    }
    /**
     * Enable auto-approve for a session
     */
    enableAutoApproveSession(sessionId) {
        this.autoApproveSessions.set(sessionId, true);
    }
    /**
     * Disable auto-approve for a session
     */
    disableAutoApproveSession(sessionId) {
        this.autoApproveSessions.delete(sessionId);
    }
    /**
     * Check if auto-approve is enabled for a session
     */
    isAutoApproveEnabled(sessionId) {
        const id = sessionId || this.getCurrentSessionId();
        return id ? this.autoApproveSessions.get(id) || false : false;
    }
    /**
     * Get current risk level
     */
    getCurrentRiskLevel() {
        return this.currentRiskLevel;
    }
    /**
     * Get approval history
     */
    async getHistory(sessionId) {
        return this.history.getEntries(sessionId);
    }
    /**
     * Clear approval history
     */
    async clearHistory() {
        await this.history.clear();
    }
    /**
     * Show approval history in a new panel
     */
    async showApprovalHistory() {
        const entries = await this.history.getEntries();
        if (entries.length === 0) {
            vscode.window.showInformationMessage('No approval history');
            return;
        }
        const items = entries.slice(0, 50).map(entry => ({
            label: `${entry.status === 'approved' || entry.status === 'auto_approved' ? '✓' : '✗'} ${entry.action.toolName}: ${entry.action.description}`,
            description: `Risk: ${entry.riskAssessment.level} | ${entry.timestamp.toLocaleString()}`,
            detail: entry.justification || undefined,
        }));
        await vscode.window.showQuickPick(items, {
            placeHolder: 'Approval History',
            canPickMany: false,
        });
    }
    /**
     * Configure approval settings
     */
    async configureApproval() {
        await vscode.commands.executeCommand('workbench.action.openSettings', 'morse.approval');
    }
    /**
     * Get the current session ID
     */
    getCurrentSessionId() {
        // This would typically come from the morse client or session manager
        return undefined;
    }
    /**
     * Update configuration
     */
    updateConfig(config) {
        this.config = { ...this.config, ...config };
        this.rules = rules_1.RiskRules.fromConfig({
            customRules: this.config.customRules,
            dangerPatterns: this.config.dangerPatterns,
        });
    }
    /**
     * Get current configuration
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * Check if approval system is enabled
     */
    isEnabled() {
        return this.config.enabled;
    }
    /**
     * Set enabled state
     */
    setEnabled(enabled) {
        this.config.enabled = enabled;
    }
}
exports.AutoApprovalService = AutoApprovalService;
/**
 * Create a new AutoApprovalService instance
 */
function createAutoApprovalService() {
    return new AutoApprovalService();
}
//# sourceMappingURL=service.js.map