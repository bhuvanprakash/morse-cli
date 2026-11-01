"use strict";
/**
 * Command Registry
 * Registers and manages slash commands
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
exports.initializeRegistry = initializeRegistry;
exports.getCommandParser = getCommandParser;
exports.executeSlashCommand = executeSlashCommand;
exports.getRegisteredCommands = getRegisteredCommands;
exports.getCommandSuggestions = getCommandSuggestions;
exports.registerSlashCommands = registerSlashCommands;
exports.registerSlashCommandsWithArgs = registerSlashCommandsWithArgs;
const vscode = __importStar(require("vscode"));
const parser_1 = require("./parser");
const commands_1 = require("./commands");
/**
 * Global command parser instance
 */
let commandParser = null;
/**
 * Extension context for commands
 */
let extensionContext = null;
/**
 * Morse client for commands
 */
let morseClient = null;
/**
 * Initialize the command registry
 */
function initializeRegistry(context, client) {
    extensionContext = context;
    morseClient = client;
    // Create parser and register commands
    commandParser = new parser_1.CommandParser();
    const commands = (0, commands_1.getAllCommands)();
    commandParser.registerCommands(commands);
    return commandParser;
}
/**
 * Get the command parser
 */
function getCommandParser() {
    return commandParser;
}
/**
 * Execute a slash command
 */
async function executeSlashCommand(commandName, args) {
    if (!commandParser) {
        return { success: false, error: 'Command registry not initialized' };
    }
    const parsed = commandParser.parse(`/${commandName} ${args}`);
    if (!parsed.isCommand || !parsed.command) {
        return { success: false, error: `Unknown command: /${commandName}` };
    }
    // Validate args
    const validation = commandParser.validateArgs(parsed.command, args);
    if (!validation.valid) {
        return { success: false, error: validation.error };
    }
    // Build context
    const context = buildContext();
    // Execute command
    try {
        return await parsed.command.handler(args, context);
    }
    catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}
/**
 * Build the command context
 */
function buildContext() {
    const editor = vscode.window.activeTextEditor;
    return {
        client: morseClient,
        extensionContext: extensionContext,
        editor,
        selection: editor?.selection,
    };
}
/**
 * Get all registered commands
 */
function getRegisteredCommands() {
    if (!commandParser) {
        return [];
    }
    return commandParser.getCommands();
}
/**
 * Get command suggestions for autocomplete
 */
function getCommandSuggestions(partial) {
    if (!commandParser) {
        return [];
    }
    return commandParser.getSuggestions(partial);
}
/**
 * Register slash commands in VS Code command palette
 */
function registerSlashCommands(context) {
    const commands = (0, commands_1.getAllCommands)();
    for (const cmd of commands) {
        // Register each slash command as a VS Code command
        const commandId = `morse.slash.${cmd.name}`;
        context.subscriptions.push(vscode.commands.registerCommand(commandId, async (...cmdArgs) => {
            const args = cmdArgs.join(' ');
            const result = await executeSlashCommand(cmd.name, args);
            if (result.success) {
                if (result.message) {
                    vscode.window.showInformationMessage(result.message);
                }
            }
            else if (result.error) {
                vscode.window.showErrorMessage(result.error);
            }
        }));
    }
}
/**
 * Register slash command with arguments (for command palette)
 */
function registerSlashCommandsWithArgs(context) {
    const commands = (0, commands_1.getAllCommands)();
    // Register commands that take arguments
    for (const cmd of commands) {
        if (cmd.maxArgs !== 0) {
            const commandId = `morse.slash.${cmd.name}.withArgs`;
            context.subscriptions.push(vscode.commands.registerCommand(commandId, async () => {
                // Show input box for arguments
                const input = await vscode.window.showInputBox({
                    prompt: cmd.description,
                    placeHolder: cmd.argsPlaceholder || 'Enter arguments...',
                });
                if (input !== undefined) {
                    const result = await executeSlashCommand(cmd.name, input);
                    if (result.success) {
                        if (result.message) {
                            vscode.window.showInformationMessage(result.message);
                        }
                    }
                    else if (result.error) {
                        vscode.window.showErrorMessage(result.error);
                    }
                }
            }));
        }
    }
}
//# sourceMappingURL=registry.js.map