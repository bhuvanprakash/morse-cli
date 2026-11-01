"use strict";
/**
 * Auto-Approval System Types
 *
 * Defines types for risk assessment and approval management.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RISK_LEVEL_ICONS = exports.RISK_LEVEL_COLORS = exports.RISK_LEVEL_SCORES = exports.DEFAULT_APPROVAL_SETTINGS = exports.DEFAULT_APPROVAL_CONFIG = void 0;
exports.scoreToRiskLevel = scoreToRiskLevel;
exports.requiresApproval = requiresApproval;
/**
 * Default approval configuration
 */
exports.DEFAULT_APPROVAL_CONFIG = {
    enabled: true,
    autoApproveLowRisk: true,
    autoDenyCritical: true,
    defaultLevel: 'ask',
    toolOverrides: {
        'read_file': 'allow',
        'list_files': 'allow',
        'search_files': 'allow',
        'glob': 'allow',
        'bash': 'ask',
        'write_file': 'ask',
        'edit_file': 'ask',
        'delete_file': 'ask',
        'execute_command': 'ask',
        'fetch': 'ask',
    },
    customRules: [],
    dangerPatterns: {
        enabled: true,
        categories: ['destructive', 'git_force', 'sql_destructive', 'pipe_to_shell', 'system_paths', 'fork_bomb'],
        customPatterns: [],
        excludePatterns: [],
    },
    autoApproveDuration: 5,
    showNotifications: true,
    showStatusBarIndicator: true,
};
/**
 * Default approval settings
 */
exports.DEFAULT_APPROVAL_SETTINGS = {
    enabled: true,
    autoApproveLowRisk: true,
    autoDenyCritical: true,
    defaultLevel: 'ask',
    showStatusBarIndicator: true,
    showNotifications: true,
    autoApproveDuration: 5,
};
/**
 * Risk level to score mapping
 */
exports.RISK_LEVEL_SCORES = {
    low: 0,
    medium: 25,
    high: 50,
    critical: 100,
};
/**
 * Risk level colors for UI
 */
exports.RISK_LEVEL_COLORS = {
    low: '#4CAF50', // Green
    medium: '#FF9800', // Orange
    high: '#F44336', // Red
    critical: '#9C27B0', // Purple
};
/**
 * Risk level icons for UI
 */
exports.RISK_LEVEL_ICONS = {
    low: 'check',
    medium: 'alert',
    high: 'warning',
    critical: 'stop',
};
/**
 * Convert numeric score to risk level
 */
function scoreToRiskLevel(score) {
    if (score >= 75)
        return 'critical';
    if (score >= 50)
        return 'high';
    if (score >= 25)
        return 'medium';
    return 'low';
}
/**
 * Check if a risk level requires approval
 */
function requiresApproval(level, config) {
    if (level === 'critical' && config.autoDenyCritical) {
        return false; // Auto-denied, not approved
    }
    if (level === 'low' && config.autoApproveLowRisk) {
        return false; // Auto-approved
    }
    return true;
}
//# sourceMappingURL=types.js.map