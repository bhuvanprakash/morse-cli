"use strict";
/**
 * Auto-Approval Risk Rules
 *
 * Defines rules for assessing risk levels based on file types, commands, and paths.
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
exports.RiskRules = void 0;
exports.checkDangerPatterns = checkDangerPatterns;
exports.getDangerPatternCategories = getDangerPatternCategories;
exports.getDefaultPatternsForCategory = getDefaultPatternsForCategory;
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const types_1 = require("./types");
/**
 * High-risk file extensions
 */
const HIGH_RISK_EXTENSIONS = new Set([
    '.env', '.pem', '.key', '.p12', '.pfx', '.keystore',
    '.sql', '.db', '.sqlite', '.mdb',
    '.bak', '.backup', '.old',
    '.sh', '.bash', '.zsh', '.bat', '.cmd', '.ps1',
]);
/**
 * Configuration file extensions
 */
const CONFIG_EXTENSIONS = new Set([
    '.json', '.yaml', '.yml', '.toml', '.ini', '.conf',
    '.config', '.xml', '.properties', '.env',
]);
/**
 * System directories that are high risk
 */
const SYSTEM_PATHS = [
    '/etc', '/usr', '/bin', '/sbin', '/boot', '/sys', '/proc',
    '/var', '/lib', '/lib64', '/opt', '/srv',
    'C:\\Windows', 'C:\\Program Files', 'C:\\Program Files (x86)',
    'C:\\System32', 'C:\\SysWOW64',
];
/**
 * Default danger patterns for commands
 */
const DEFAULT_DANGER_PATTERNS = {
    destructive: [
        /\brm\s+-[a-zA-Z]*r[a-zA-Z]*f\s+/i,
        /\brm\s+-[a-zA-Z]*f[a-zA-Z]*r\s+/i,
        /\brm\s+-rf\s+\//i,
        /\brm\s+-rf\s+~\//i,
        /\brm\s+-rf\s+\./i,
        /\bdel\s+\/[sq]\s+/i,
        /\brmdir\s+\/[s]\s+/i,
        /\bformat\s+[a-z]:/i,
    ],
    git_force: [
        /\bgit\s+push\s+--force\b/i,
        /\bgit\s+push\s+-f\b/i,
        /\bgit\s+push\s+.*\s+--force\b/i,
        /\bgit\s+push\s+.*\s+-f\b/i,
        /\bgit\s+push\s+--force-with-lease\b/i,
        /\bgit\s+push\s+--force-if-includes\b/i,
    ],
    sql_destructive: [
        /\bDROP\s+TABLE\b/i,
        /\bDROP\s+DATABASE\b/i,
        /\bTRUNCATE\s+TABLE\b/i,
        /\bDELETE\s+FROM\b/i,
        /\bALTER\s+TABLE\s+.*\s+DROP\b/i,
        /\bDROP\s+INDEX\b/i,
    ],
    pipe_to_shell: [
        /(?:curl|wget)\s+.*\|\s*(?:ba)?sh/i,
        /(?:curl|wget)\s+.*\|\s*bash/i,
        /\bcurl\s+.*\|\s*/i,
        /\bwget\s+.*\|\s*/i,
        /\bcurl\s+.*install/i,
        /\bpython\s+.*\|\s*(?:ba)?sh/i,
        /\bruby\s+.*\|\s*(?:ba)?sh/i,
    ],
    system_paths: [
        /\b(?:cat|rm|mv|cp|dd|chmod|chown)\s+\/etc\//i,
        /\b(?:cat|rm|mv|cp|dd|chmod|chown)\s+\/usr\//i,
        /\b(?:cat|rm|mv|cp|dd|chmod|chown)\s+\/bin\//i,
        /\b(?:cat|rm|mv|cp|dd|chmod|chown)\s+\/sbin\//i,
        /\b(?:cat|rm|mv|cp|dd|chmod|chown)\s+\/boot\//i,
        /\b(?:cat|rm|mv|cp|dd|chmod|chown)\s+C:\\Windows\\/i,
        /\b(?:cat|rm|mv|cp|dd|chmod|chown)\s+C:\\System32\\/i,
    ],
    fork_bomb: [
        /:\(\)\s*\{\s*:\|\s*:\s*&\s*\}/,
        /\bfor\s+.*\s+in\s+.*;\s+do\s+.*done\s*&.*done/i,
    ],
    network: [
        /\bwget\s+-O\s+/i,
        /\bcurl\s+-o\s+/i,
        /\bnetcat\s+/i,
        /\bnc\s+-e\s+/i,
        /\bsocat\s+/i,
    ],
};
/**
 * Risk rules for file operations
 */
class RiskRules {
    customRules;
    dangerPatterns;
    compiledCustomPatterns = [];
    constructor(customRules = [], dangerPatterns) {
        this.customRules = customRules;
        this.dangerPatterns = dangerPatterns;
        this.compileCustomPatterns();
    }
    /**
     * Compile custom patterns from configuration
     */
    compileCustomPatterns() {
        if (!this.dangerPatterns.enabled) {
            return;
        }
        // Compile custom patterns
        for (const pattern of this.dangerPatterns.customPatterns) {
            try {
                this.compiledCustomPatterns.push(new RegExp(pattern, 'i'));
            }
            catch {
                // Invalid regex, skip
            }
        }
    }
    /**
     * Assess risk for a file operation
     */
    assessFileOperation(filePath, operation) {
        const factors = [];
        let totalScore = 0;
        // Check file extension
        const ext = path.extname(filePath).toLowerCase();
        if (HIGH_RISK_EXTENSIONS.has(ext)) {
            const factor = {
                category: 'file_operation',
                score: types_1.RISK_LEVEL_SCORES.high,
                description: `High-risk file type: ${ext}`,
            };
            factors.push(factor);
            totalScore += factor.score;
        }
        else if (CONFIG_EXTENSIONS.has(ext)) {
            const factor = {
                category: 'file_operation',
                score: types_1.RISK_LEVEL_SCORES.medium,
                description: `Configuration file: ${ext}`,
            };
            factors.push(factor);
            totalScore += factor.score;
        }
        // Check path for system directories
        const normalizedPath = path.normalize(filePath).toLowerCase();
        const homeDir = os.homedir().toLowerCase();
        if (normalizedPath.startsWith(homeDir)) {
            // Files in home directory are lower risk
            const factor = {
                category: 'file_operation',
                score: types_1.RISK_LEVEL_SCORES.low,
                description: 'File in user home directory',
            };
            factors.push(factor);
            totalScore += factor.score;
        }
        // Check for system directories
        for (const sysPath of SYSTEM_PATHS) {
            if (normalizedPath.includes(sysPath.toLowerCase())) {
                const factor = {
                    category: 'system_change',
                    score: types_1.RISK_LEVEL_SCORES.critical,
                    description: `System directory access: ${sysPath}`,
                };
                factors.push(factor);
                totalScore += factor.score;
                break;
            }
        }
        // Check operation type
        if (operation === 'delete') {
            const factor = {
                category: 'file_operation',
                score: types_1.RISK_LEVEL_SCORES.high,
                description: 'File deletion operation',
            };
            factors.push(factor);
            totalScore += factor.score;
        }
        else if (operation === 'execute') {
            const factor = {
                category: 'command_execution',
                score: types_1.RISK_LEVEL_SCORES.high,
                description: 'File execution operation',
            };
            factors.push(factor);
            totalScore += factor.score;
        }
        // Apply custom rules
        const customFactors = this.applyCustomRules(filePath);
        factors.push(...customFactors);
        for (const f of customFactors) {
            totalScore += f.score;
        }
        const level = (0, types_1.scoreToRiskLevel)(totalScore);
        return {
            level,
            factors,
            requiresApproval: level !== 'low',
            message: this.generateMessage(level, factors),
        };
    }
    /**
     * Assess risk for a command execution
     */
    assessCommand(command) {
        const factors = [];
        let totalScore = 0;
        const normalizedCommand = command.toLowerCase().trim();
        // Check against danger patterns
        if (this.dangerPatterns.enabled) {
            for (const category of this.dangerPatterns.categories) {
                const patterns = DEFAULT_DANGER_PATTERNS[category];
                if (!patterns)
                    continue;
                for (const pattern of patterns) {
                    if (pattern.test(normalizedCommand)) {
                        let score;
                        let description;
                        if (category === 'destructive' || category === 'fork_bomb') {
                            score = types_1.RISK_LEVEL_SCORES.critical;
                            description = `Critical: ${category} pattern detected`;
                        }
                        else if (category === 'git_force' || category === 'sql_destructive') {
                            score = types_1.RISK_LEVEL_SCORES.high;
                            description = `High risk: ${category} pattern detected`;
                        }
                        else {
                            score = types_1.RISK_LEVEL_SCORES.medium;
                            description = `Medium risk: ${category} pattern detected`;
                        }
                        const factor = {
                            category: 'command_execution',
                            score,
                            description,
                        };
                        factors.push(factor);
                        totalScore += score;
                        break;
                    }
                }
            }
            // Check custom patterns
            for (const pattern of this.compiledCustomPatterns) {
                if (pattern.test(normalizedCommand)) {
                    const factor = {
                        category: 'command_execution',
                        score: types_1.RISK_LEVEL_SCORES.high,
                        description: 'Custom danger pattern detected',
                    };
                    factors.push(factor);
                    totalScore += factor.score;
                    break;
                }
            }
        }
        // Check for network-related commands
        const networkCommands = ['curl', 'wget', 'fetch', 'http', 'https', 'ssh', 'scp', 'rsync'];
        for (const cmd of networkCommands) {
            if (normalizedCommand.startsWith(cmd) || normalizedCommand.includes(` ${cmd} `)) {
                const factor = {
                    category: 'network_access',
                    score: types_1.RISK_LEVEL_SCORES.medium,
                    description: `Network access: ${cmd}`,
                };
                factors.push(factor);
                totalScore += factor.score;
                break;
            }
        }
        // Check for system modification commands
        const systemCommands = ['chmod', 'chown', 'chgrp', 'sudo', 'su', 'kill', 'pkill'];
        for (const cmd of systemCommands) {
            if (normalizedCommand.includes(` ${cmd} `) || normalizedCommand.startsWith(cmd)) {
                const factor = {
                    category: 'system_change',
                    score: types_1.RISK_LEVEL_SCORES.medium,
                    description: `System modification: ${cmd}`,
                };
                factors.push(factor);
                totalScore += factor.score;
                break;
            }
        }
        // Apply custom rules
        const customFactors = this.applyCustomRules(command);
        factors.push(...customFactors);
        for (const f of customFactors) {
            totalScore += f.score;
        }
        const level = (0, types_1.scoreToRiskLevel)(totalScore);
        return {
            level,
            factors,
            requiresApproval: level !== 'low',
            message: this.generateMessage(level, factors),
        };
    }
    /**
     * Assess risk for network access
     */
    assessNetworkAccess(url, method = 'GET') {
        const factors = [];
        let totalScore = 0;
        const normalizedUrl = url.toLowerCase();
        // Check for HTTPS
        if (!normalizedUrl.startsWith('https://')) {
            const factor = {
                category: 'network_access',
                score: types_1.RISK_LEVEL_SCORES.medium,
                description: 'Insecure HTTP connection (not HTTPS)',
            };
            factors.push(factor);
            totalScore += factor.score;
        }
        // Check for sensitive domains
        const sensitiveDomains = [
            'localhost', '127.0.0.1', '0.0.0.0',
            'aws.amazon.com', 'cloud.google.com', 'azure.microsoft.com',
            'github.com', 'gitlab.com', 'bitbucket.org',
        ];
        for (const domain of sensitiveDomains) {
            if (normalizedUrl.includes(domain)) {
                const factor = {
                    category: 'network_access',
                    score: types_1.RISK_LEVEL_SCORES.low,
                    description: `Accessing sensitive service: ${domain}`,
                };
                factors.push(factor);
                totalScore += factor.score;
                break;
            }
        }
        // Check HTTP method
        const riskyMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
        if (riskyMethods.includes(method.toUpperCase())) {
            const factor = {
                category: 'network_access',
                score: types_1.RISK_LEVEL_SCORES.medium,
                description: `Modifying HTTP method: ${method}`,
            };
            factors.push(factor);
            totalScore += factor.score;
        }
        // Check for IP addresses
        const ipPattern = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        if (ipPattern.test(new URL(url).hostname)) {
            const factor = {
                category: 'network_access',
                score: types_1.RISK_LEVEL_SCORES.medium,
                description: 'Direct IP address access',
            };
            factors.push(factor);
            totalScore += factor.score;
        }
        const level = (0, types_1.scoreToRiskLevel)(totalScore);
        return {
            level,
            factors,
            requiresApproval: level !== 'low',
            message: this.generateMessage(level, factors),
        };
    }
    /**
     * Apply custom rules to assess risk
     */
    applyCustomRules(target) {
        const factors = [];
        for (const rule of this.customRules) {
            if (!rule.enabled)
                continue;
            try {
                const pattern = new RegExp(rule.pattern, 'i');
                if (pattern.test(target)) {
                    const factor = {
                        category: 'file_operation',
                        score: types_1.RISK_LEVEL_SCORES[rule.riskLevel],
                        description: `Custom rule matched: ${rule.name}`,
                    };
                    factors.push(factor);
                }
            }
            catch {
                // Invalid regex, skip
            }
        }
        return factors;
    }
    /**
     * Generate a human-readable message for the risk assessment
     */
    generateMessage(level, factors) {
        if (factors.length === 0) {
            return `Risk level: ${level} (no specific factors identified)`;
        }
        const factorDescriptions = factors.map(f => f.description).join(', ');
        return `Risk level: ${level} - ${factorDescriptions}`;
    }
    /**
     * Create risk rules from configuration
     */
    static fromConfig(config) {
        return new RiskRules(config.customRules || [], config.dangerPatterns || {
            enabled: true,
            categories: ['destructive', 'git_force', 'sql_destructive', 'pipe_to_shell', 'system_paths', 'fork_bomb'],
            customPatterns: [],
            excludePatterns: [],
        });
    }
}
exports.RiskRules = RiskRules;
/**
 * Check if a command matches any danger pattern
 */
function checkDangerPatterns(command, config) {
    if (!config.enabled) {
        return { matches: false, level: 'low' };
    }
    const normalizedCommand = command.toLowerCase().trim();
    for (const category of config.categories) {
        const patterns = DEFAULT_DANGER_PATTERNS[category];
        if (!patterns)
            continue;
        for (const pattern of patterns) {
            if (pattern.test(normalizedCommand)) {
                let level;
                if (category === 'destructive' || category === 'fork_bomb') {
                    level = 'critical';
                }
                else if (category === 'git_force' || category === 'sql_destructive') {
                    level = 'high';
                }
                else {
                    level = 'medium';
                }
                return { matches: true, level };
            }
        }
    }
    return { matches: false, level: 'low' };
}
/**
 * Get all available danger pattern categories
 */
function getDangerPatternCategories() {
    return Object.keys(DEFAULT_DANGER_PATTERNS);
}
/**
 * Get default danger patterns for a category
 */
function getDefaultPatternsForCategory(category) {
    const patterns = DEFAULT_DANGER_PATTERNS[category];
    if (!patterns)
        return [];
    return patterns.map(p => p.source);
}
//# sourceMappingURL=rules.js.map