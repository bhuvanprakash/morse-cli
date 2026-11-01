"use strict";
/**
 * REPL/Slash Commands Module
 * Main entry point for the slash commands system
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeREPL = initializeREPL;
exports.executeREPLCommand = executeREPLCommand;
exports.getSlashCommands = getSlashCommands;
const registry_1 = require("./registry");
const autocomplete_1 = require("./autocomplete");
const registry_2 = require("./registry");
/**
 * Initialize the REPL/slash commands system
 */
function initializeREPL(context, client) {
    // Initialize the command registry
    const parser = (0, registry_1.initializeRegistry)(context, client);
    // Register slash commands in VS Code command palette
    (0, registry_1.registerSlashCommands)(context);
    (0, registry_1.registerSlashCommandsWithArgs)(context);
    // Register autocomplete and hover providers
    (0, autocomplete_1.registerSlashCommandAutocomplete)(context);
    console.log('[Morse] Slash commands system initialized');
    return parser;
}
/**
 * Execute a slash command from a string input
 */
async function executeREPLCommand(input) {
    // Parse the command
    const parts = input.trim().split(/\s+/);
    if (parts.length === 0 || !parts[0].startsWith('/')) {
        return { success: false, error: 'Not a slash command' };
    }
    const commandName = parts[0].slice(1);
    const args = parts.slice(1).join(' ');
    try {
        const result = await (0, registry_2.executeSlashCommand)(commandName, args);
        return result;
    }
    catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}
/**
 * Get all available slash commands
 */
function getSlashCommands() {
    return (0, registry_2.getRegisteredCommands)();
}
//# sourceMappingURL=index.js.map