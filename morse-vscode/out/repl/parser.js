"use strict";
/**
 * Slash Command Parser
 * Parses slash commands from user input in the chat
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommandParser = void 0;
exports.createDefaultParser = createDefaultParser;
/**
 * Command parser for slash commands
 */
class CommandParser {
    commands = new Map();
    /**
     * Register a command
     */
    registerCommand(command) {
        this.commands.set(command.name, command);
    }
    /**
     * Register multiple commands
     */
    registerCommands(commands) {
        for (const cmd of commands) {
            this.registerCommand(cmd);
        }
    }
    /**
     * Get all registered commands
     */
    getCommands() {
        return Array.from(this.commands.values());
    }
    /**
     * Get a command by name
     */
    getCommand(name) {
        return this.commands.get(name);
    }
    /**
     * Parse a line and return the command and args
     */
    parse(line) {
        const trimmed = line.trim();
        // Check if it starts with a slash
        if (!trimmed.startsWith('/')) {
            return {
                command: null,
                args: trimmed,
                rawInput: line,
                isCommand: false,
            };
        }
        // Extract command name and args
        const spaceIndex = trimmed.indexOf(' ');
        let commandName;
        let args;
        if (spaceIndex === -1) {
            commandName = trimmed.slice(1).toLowerCase();
            args = '';
        }
        else {
            commandName = trimmed.slice(1, spaceIndex).toLowerCase();
            args = trimmed.slice(spaceIndex + 1).trim();
        }
        // Find the command
        const command = this.commands.get(commandName);
        if (!command) {
            return {
                command: null,
                args: trimmed,
                rawInput: line,
                isCommand: false,
            };
        }
        return {
            command,
            args,
            rawInput: line,
            isCommand: true,
        };
    }
    /**
     * Validate command arguments
     */
    validateArgs(command, args) {
        const argCount = args.trim() === '' ? 0 : args.trim().split(/\s+/).length;
        if (command.minArgs > 0 && argCount < command.minArgs) {
            return {
                valid: false,
                error: `${command.name} requires at least ${command.minArgs} argument(s)`,
            };
        }
        if (command.maxArgs >= 0 && argCount > command.maxArgs) {
            return {
                valid: false,
                error: `${command.name} accepts at most ${command.maxArgs} argument(s)`,
            };
        }
        return { valid: true };
    }
    /**
     * Get autocomplete suggestions for a partial input
     */
    getSuggestions(partial) {
        const trimmed = partial.trim().toLowerCase();
        if (!trimmed.startsWith('/')) {
            return [];
        }
        const cmdPart = trimmed.slice(1);
        const suggestions = [];
        for (const [, cmd] of this.commands) {
            if (cmd.name.startsWith(cmdPart) || cmd.aliases?.some((a) => a.toLowerCase().startsWith(cmdPart))) {
                suggestions.push(cmd);
            }
        }
        return suggestions;
    }
    /**
     * Generate help text for all commands
     */
    generateHelp() {
        const lines = [];
        lines.push('## Available Slash Commands\n');
        // Group commands by category
        const categories = new Map();
        for (const cmd of this.commands.values()) {
            const category = cmd.category || 'General';
            if (!categories.has(category)) {
                categories.set(category, []);
            }
            categories.get(category).push(cmd);
        }
        // Output by category
        for (const [category, cmds] of categories) {
            lines.push(`### ${category}\n`);
            for (const cmd of cmds) {
                const argsSpec = cmd.argsPlaceholder ? ` ${cmd.argsPlaceholder}` : '';
                lines.push(`- **/${cmd.name}${argsSpec}** - ${cmd.description}`);
                if (cmd.aliases && cmd.aliases.length > 0) {
                    lines.push(`  - Aliases: ${cmd.aliases.map((a) => `/${a}`).join(', ')}`);
                }
            }
            lines.push('');
        }
        return lines.join('\n');
    }
}
exports.CommandParser = CommandParser;
/**
 * Create the default parser with all commands
 */
function createDefaultParser() {
    const parser = new CommandParser();
    // Commands will be registered by the registry
    return parser;
}
//# sourceMappingURL=parser.js.map