"use strict";
/**
 * Auto-Approval UI
 *
 * Provides UI components for the approval system including status bar indicator
 * and approval request dialogs.
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
exports.ApprovalUI = void 0;
exports.createApprovalUI = createApprovalUI;
const vscode = __importStar(require("vscode"));
const types_1 = require("./types");
/**
 * UI manager for the approval system
 */
class ApprovalUI {
    statusBarItem = null;
    currentRiskLevel = 'low';
    context = null;
    /**
     * Initialize the UI
     */
    initialize(context) {
        this.context = context;
        this.createStatusBarItem();
    }
    /**
     * Create the status bar item
     */
    createStatusBarItem() {
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.statusBarItem.command = 'morse.approval.configure';
        this.statusBarItem.tooltip = 'Morse Auto-Approval: Click to configure';
        this.updateStatusBar();
        if (this.statusBarItem) {
            this.statusBarItem.show();
        }
    }
    /**
     * Update the status bar indicator
     */
    updateStatusBar(riskLevel) {
        if (!this.statusBarItem)
            return;
        if (riskLevel) {
            this.currentRiskLevel = riskLevel;
        }
        const icon = types_1.RISK_LEVEL_ICONS[this.currentRiskLevel];
        const color = types_1.RISK_LEVEL_COLORS[this.currentRiskLevel];
        const text = `$(shield-${icon}) Morse: ${this.currentRiskLevel}`;
        this.statusBarItem.text = text;
        this.statusBarItem.color = color;
        this.statusBarItem.tooltip = `Morse Auto-Approval: Current risk level is ${this.currentRiskLevel}\nClick to configure`;
    }
    /**
     * Show approval request dialog
     */
    async showApprovalRequest(request) {
        const riskAssessment = request.riskAssessment;
        const action = request.action;
        // Format risk level display
        const riskIcon = this.getRiskIcon(riskAssessment.level);
        const riskColor = this.getRiskColor(riskAssessment.level);
        // Build the message
        const message = this.buildApprovalMessage(action, riskAssessment);
        // Show warning message with options
        const result = await vscode.window.showWarningMessage(message, { modal: true }, 'Approve', 'Deny', 'Approve with Justification');
        if (result === 'Approve') {
            return {
                approved: true,
                timestamp: new Date(),
            };
        }
        if (result === 'Deny') {
            return {
                approved: false,
                justification: 'Denied by user',
                timestamp: new Date(),
            };
        }
        // Approve with justification
        const justification = await vscode.window.showInputBox({
            prompt: 'Enter justification for this approval override',
            placeHolder: 'Reason for approving this action...',
        });
        return {
            approved: true,
            justification: justification || 'No justification provided',
            override: true,
            timestamp: new Date(),
        };
    }
    /**
     * Build the approval message
     */
    buildApprovalMessage(action, riskAssessment) {
        const lines = [];
        // Header
        lines.push(`${this.getRiskIcon(riskAssessment.level)} **Risk Level: ${riskAssessment.level.toUpperCase()}**`);
        lines.push('');
        // Action details
        lines.push(`**Tool:** ${action.toolName}`);
        lines.push(`**Action:** ${action.description}`);
        if (action.path) {
            lines.push(`**Path:** ${action.path}`);
        }
        lines.push('');
        // Risk factors
        if (riskAssessment.factors.length > 0) {
            lines.push('**Risk Factors:**');
            for (const factor of riskAssessment.factors) {
                lines.push(`  • ${factor.description}`);
            }
            lines.push('');
        }
        // Warning for high risk
        if (riskAssessment.level === 'high' || riskAssessment.level === 'critical') {
            lines.push(`⚠️ This action has **${riskAssessment.level}** risk. Do you want to proceed?`);
        }
        return lines.join('\n');
    }
    /**
     * Get risk icon for level
     */
    getRiskIcon(level) {
        switch (level) {
            case 'low':
                return '✅';
            case 'medium':
                return '⚠️';
            case 'high':
                return '🔴';
            case 'critical':
                return '🛑';
            default:
                return '❓';
        }
    }
    /**
     * Get risk color for level
     */
    getRiskColor(level) {
        return types_1.RISK_LEVEL_COLORS[level];
    }
    /**
     * Show notification for auto-approved action
     */
    showAutoApproved(action) {
        vscode.window.showInformationMessage(`✅ Auto-approved: ${action.toolName} - ${action.description}`, 'Configure').then(selection => {
            if (selection === 'Configure') {
                vscode.commands.executeCommand('morse.approval.configure');
            }
        });
    }
    /**
     * Show notification for auto-denied action
     */
    showAutoDenied(action, reason) {
        vscode.window.showWarningMessage(`🛑 Auto-denied: ${action.toolName} - ${reason}`, 'Configure').then(selection => {
            if (selection === 'Configure') {
                vscode.commands.executeCommand('morse.approval.configure');
            }
        });
    }
    /**
     * Show approval history panel
     */
    async showHistoryPanel(entries) {
        const items = entries.slice(0, 50).map(entry => {
            const icon = entry.status === 'approved' || entry.status === 'auto_approved' ? '✓' : '✗';
            return {
                label: `${icon} ${entry.action.toolName}: ${entry.action.description}`,
                description: `Risk: ${entry.riskAssessment.level} | ${entry.timestamp.toLocaleString()}`,
                detail: entry.justification || undefined,
            };
        });
        if (items.length === 0) {
            vscode.window.showInformationMessage('No approval history');
            return;
        }
        await vscode.window.showQuickPick(items, {
            placeHolder: 'Approval History (last 50 entries)',
            canPickMany: false,
        });
    }
    /**
     * Show risk indicator in editor
     */
    showRiskIndicator(document, riskLevel) {
        // This could be used to show inline decorations for high-risk files
        // For now, just update status bar
        this.updateStatusBar(riskLevel);
    }
    /**
     * Dispose the UI
     */
    dispose() {
        if (this.statusBarItem) {
            this.statusBarItem.dispose();
            this.statusBarItem = null;
        }
    }
    /**
     * Set status bar visibility
     */
    setStatusBarVisible(visible) {
        if (this.statusBarItem) {
            if (visible) {
                this.statusBarItem.show();
            }
            else {
                this.statusBarItem.hide();
            }
        }
    }
}
exports.ApprovalUI = ApprovalUI;
/**
 * Create a new ApprovalUI instance
 */
function createApprovalUI() {
    return new ApprovalUI();
}
//# sourceMappingURL=ui.js.map