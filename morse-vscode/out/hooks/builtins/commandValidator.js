"use strict";
/**
 * Command Validator Hook
 *
 * Built-in hook that validates commands before execution.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommandValidatorHook = void 0;
exports.createCommandValidatorHook = createCommandValidatorHook;
/**
 * Default dangerous command patterns
 */
const DANGEROUS_PATTERNS = [
    'rm -rf /',
    '> /dev/sda',
    'mkfs.',
    'dd if=',
    ':(){ :|:& };:',
    'curl .* | sh',
    'wget .* | sh',
];
/**
 * Command Validator Hook
 * Validates commands before execution
 */
class CommandValidatorHook {
    config;
    blockedCommands;
    allowedCommands;
    dangerousPatterns;
    constructor(config = {}) {
        this.config = config;
        this.blockedCommands = new Set(config.blockedCommands || []);
        this.allowedCommands = new Set(config.allowedCommands || []);
        this.dangerousPatterns = DANGEROUS_PATTERNS.map(p => new RegExp(p, 'i'));
    }
    /**
     * Execute the command validator hook
     */
    async execute(context) {
        const data = context.data;
        // Extract command from context
        const command = typeof data.command === 'string' ? data.command : '';
        const toolName = typeof data.toolName === 'string' ? data.toolName : '';
        if (!command && !toolName) {
            return {
                success: true,
                continue: true,
                modified: false,
            };
        }
        // Check blocked commands
        for (const blocked of this.blockedCommands) {
            if (command.toLowerCase().includes(blocked.toLowerCase())) {
                return {
                    success: false,
                    continue: false,
                    modified: false,
                    error: `Command blocked: "${blocked}"`,
                };
            }
        }
        // Check allowed commands list
        if (this.allowedCommands.size > 0) {
            let isAllowed = false;
            for (const allowed of this.allowedCommands) {
                if (command.toLowerCase().includes(allowed.toLowerCase())) {
                    isAllowed = true;
                    break;
                }
            }
            if (!isAllowed) {
                return {
                    success: false,
                    continue: false,
                    modified: false,
                    error: 'Command not in allowed list',
                };
            }
        }
        // Check dangerous patterns if enabled
        if (this.config.blockDangerous !== false) {
            for (const pattern of this.dangerousPatterns) {
                if (pattern.test(command)) {
                    return {
                        success: false,
                        continue: false,
                        modified: false,
                        error: `Dangerous command pattern detected: ${pattern.source}`,
                    };
                }
            }
        }
        return {
            success: true,
            continue: true,
            modified: false,
        };
    }
    /**
     * Update configuration
     */
    updateConfig(config) {
        this.config = { ...this.config, ...config };
        if (config.blockedCommands) {
            this.blockedCommands = new Set(config.blockedCommands);
        }
        if (config.allowedCommands) {
            this.allowedCommands = new Set(config.allowedCommands);
        }
    }
}
exports.CommandValidatorHook = CommandValidatorHook;
/**
 * Create a new command validator hook
 */
function createCommandValidatorHook(config) {
    return new CommandValidatorHook(config);
}
//# sourceMappingURL=commandValidator.js.map