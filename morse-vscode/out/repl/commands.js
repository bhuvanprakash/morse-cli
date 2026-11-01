"use strict";
/**
 * Slash Commands Definitions
 * Defines all available slash commands for the REPL
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
exports.getAllCommands = getAllCommands;
const vscode = __importStar(require("vscode"));
const ChatPanel_1 = require("../views/chat/ChatPanel");
// ============================================================================
// Command Handlers
// ============================================================================
/**
 * Handle /ask command - ask a question
 */
async function handleAsk(args, context) {
    if (!args.trim()) {
        return { success: false, error: 'Please provide a question' };
    }
    const panel = ChatPanel_1.ChatPanel.currentPanel;
    if (!panel) {
        return { success: false, error: 'Chat panel is not open. Use morse.chat command first.' };
    }
    panel.sendMessage(args);
    return { success: true, message: `Asking: ${args}` };
}
/**
 * Handle /edit command - edit selected code
 */
async function handleEdit(args, context) {
    if (!context.editor) {
        return { success: false, error: 'No active editor' };
    }
    const selection = context.editor.selection;
    const code = selection.isEmpty
        ? context.editor.document.getText()
        : context.editor.document.getText(selection);
    const panel = ChatPanel_1.ChatPanel.currentPanel;
    if (!panel) {
        return { success: false, error: 'Chat panel is not open. Use morse.chat command first.' };
    }
    const message = args.trim()
        ? `/edit ${args}`
        : `/edit: ${code}`;
    panel.sendMessage(message);
    return { success: true, message: 'Edit command sent to chat' };
}
/**
 * Handle /fix command - fix errors in selection
 */
async function handleFix(args, context) {
    const panel = ChatPanel_1.ChatPanel.currentPanel;
    if (!panel) {
        return { success: false, error: 'Chat panel is not open. Use morse.chat command first.' };
    }
    const message = args.trim() ? `/fix ${args}` : '/fix';
    panel.sendMessage(message);
    return { success: true, message: 'Fix command sent to chat' };
}
/**
 * Handle /explain command - explain selected code
 */
async function handleExplain(args, context) {
    const panel = ChatPanel_1.ChatPanel.currentPanel;
    if (!panel) {
        return { success: false, error: 'Chat panel is not open. Use morse.chat command first.' };
    }
    const message = args.trim() ? `/explain ${args}` : '/explain';
    panel.sendMessage(message);
    return { success: true, message: 'Explain command sent to chat' };
}
/**
 * Handle /test command - generate tests
 */
async function handleTest(args, context) {
    const panel = ChatPanel_1.ChatPanel.currentPanel;
    if (!panel) {
        return { success: false, error: 'Chat panel is not open. Use morse.chat command first.' };
    }
    const message = args.trim() ? `/test ${args}` : '/test';
    panel.sendMessage(message);
    return { success: true, message: 'Test command sent to chat' };
}
/**
 * Handle /commit command - generate commit message
 */
async function handleCommit(args, context) {
    const panel = ChatPanel_1.ChatPanel.currentPanel;
    if (!panel) {
        return { success: false, error: 'Chat panel is not open. Use morse.chat command first.' };
    }
    const message = args.trim() ? `/commit ${args}` : '/commit';
    panel.sendMessage(message);
    return { success: true, message: 'Commit command sent to chat' };
}
/**
 * Handle /review command - review code
 */
async function handleReview(args, context) {
    const panel = ChatPanel_1.ChatPanel.currentPanel;
    if (!panel) {
        return { success: false, error: 'Chat panel is not open. Use morse.chat command first.' };
    }
    const message = args.trim() ? `/review ${args}` : '/review';
    panel.sendMessage(message);
    return { success: true, message: 'Review command sent to chat' };
}
/**
 * Handle /mode command - switch mode
 */
async function handleMode(args, context) {
    const validModes = ['ask', 'code', 'debug', 'architect'];
    const mode = args.trim().toLowerCase();
    if (!mode) {
        return {
            success: true,
            message: `Current mode: code. Available modes: ${validModes.join(', ')}`,
        };
    }
    if (!validModes.includes(mode)) {
        return {
            success: false,
            error: `Invalid mode: ${mode}. Available modes: ${validModes.join(', ')}`,
        };
    }
    // Store the mode preference
    await context.extensionContext.workspaceState.update('morse.mode', mode);
    return { success: true, message: `Switched to ${mode} mode` };
}
/**
 * Handle /context command - show context info
 */
async function handleContext(args, context) {
    const editor = context.editor;
    const document = editor?.document;
    if (!document) {
        return { success: true, message: 'No active file' };
    }
    const info = [
        `File: ${document.fileName}`,
        `Language: ${document.languageId}`,
        `Total Lines: ${document.lineCount}`,
    ];
    if (editor) {
        const position = editor.selection.active;
        info.push(`Cursor: Line ${position.line + 1}, Column ${position.character + 1}`);
    }
    return { success: true, message: info.join('\n') };
}
/**
 * Handle /agent command - run autonomous agent
 */
async function handleAgent(args, context) {
    if (!args.trim()) {
        return { success: false, error: 'Please provide instructions for the agent' };
    }
    const panel = ChatPanel_1.ChatPanel.currentPanel;
    if (!panel) {
        return { success: false, error: 'Chat panel is not open. Use morse.chat command first.' };
    }
    panel.sendMessage(`/agent ${args}`);
    return { success: true, message: `Running agent: ${args}` };
}
/**
 * Handle /swarm command - run swarm
 */
async function handleSwarm(args, context) {
    const panel = ChatPanel_1.ChatPanel.currentPanel;
    if (!panel) {
        return { success: false, error: 'Chat panel is not open. Use morse.chat command first.' };
    }
    const message = args.trim() ? `/swarm ${args}` : '/swarm';
    panel.sendMessage(message);
    return { success: true, message: 'Swarm command sent to chat' };
}
/**
 * Handle /memory command - memory operations
 */
async function handleMemory(args, context) {
    const subcommand = args.trim().split(/\s+/)[0]?.toLowerCase() || '';
    switch (subcommand) {
        case 'show':
            vscode.commands.executeCommand('morse.memory.show');
            return { success: true, message: 'Opening memory panel' };
        case 'list':
            vscode.commands.executeCommand('morse.memory.list');
            return { success: true, message: 'Listing memory entries' };
        case 'search':
            const searchTerm = args.trim().slice(6).trim();
            if (!searchTerm) {
                return { success: false, error: 'Please provide a search term' };
            }
            vscode.commands.executeCommand('morse.memory.search', searchTerm);
            return { success: true, message: `Searching memory for: ${searchTerm}` };
        case 'clear':
            vscode.commands.executeCommand('morse.memory.clear');
            return { success: true, message: 'Clearing memory' };
        default:
            return {
                success: true,
                message: 'Memory commands: show, list, search <term>, clear',
            };
    }
}
/**
 * Handle /rag command - RAG operations
 */
async function handleRag(args, context) {
    const subcommand = args.trim().split(/\s+/)[0]?.toLowerCase() || '';
    switch (subcommand) {
        case 'init':
        case 'initialize':
            vscode.commands.executeCommand('morse.rag.init');
            return { success: true, message: 'Initializing RAG' };
        case 'refresh':
            vscode.commands.executeCommand('morse.rag.refresh');
            return { success: true, message: 'Refreshing RAG index' };
        case 'search':
            const searchTerm = args.trim().slice(6).trim();
            if (!searchTerm) {
                return { success: false, error: 'Please provide a search term' };
            }
            vscode.commands.executeCommand('morse.rag.search', searchTerm);
            return { success: true, message: `Searching RAG for: ${searchTerm}` };
        case 'status':
            vscode.commands.executeCommand('morse.rag.status');
            return { success: true, message: 'Showing RAG status' };
        case 'show':
            vscode.commands.executeCommand('morse.rag.show');
            return { success: true, message: 'Opening RAG panel' };
        default:
            return {
                success: true,
                message: 'RAG commands: init, refresh, search <term>, status, show',
            };
    }
}
/**
 * Handle /mcp command - MCP operations
 */
async function handleMcp(args, context) {
    const subcommand = args.trim().split(/\s+/)[0]?.toLowerCase() || '';
    switch (subcommand) {
        case 'list':
            vscode.commands.executeCommand('morse.mcp.list');
            return { success: true, message: 'Listing MCP servers' };
        case 'add':
            vscode.commands.executeCommand('morse.mcp.add');
            return { success: true, message: 'Adding MCP server' };
        case 'remove':
            vscode.commands.executeCommand('morse.mcp.remove');
            return { success: true, message: 'Removing MCP server' };
        case 'status':
            vscode.commands.executeCommand('morse.mcp.server.status');
            return { success: true, message: 'Showing MCP server status' };
        default:
            return {
                success: true,
                message: 'MCP commands: list, add, remove, status',
            };
    }
}
/**
 * Handle /provider command - provider operations
 */
async function handleProvider(args, context) {
    const subcommand = args.trim().split(/\s+/)[0]?.toLowerCase() || '';
    switch (subcommand) {
        case 'select':
            vscode.commands.executeCommand('morse.selectProvider');
            return { success: true, message: 'Selecting provider' };
        case 'show':
            vscode.commands.executeCommand('morse.showProviders');
            return { success: true, message: 'Showing available providers' };
        case 'configure':
            vscode.commands.executeCommand('morse.configureProvider');
            return { success: true, message: 'Configuring provider' };
        case 'validate':
            vscode.commands.executeCommand('morse.validateProvider');
            return { success: true, message: 'Validating provider' };
        default:
            return {
                success: true,
                message: 'Provider commands: select, show, configure, validate',
            };
    }
}
/**
 * Handle /clear command - clear chat
 */
async function handleClear(args, context) {
    vscode.commands.executeCommand('morse.clearChat');
    return { success: true, message: 'Chat cleared' };
}
/**
 * Handle /undo command - undo last action
 */
async function handleUndo(args, context) {
    // For now, just show a message - undo is handled by the chat panel
    return { success: true, message: 'Undo requested - use Ctrl+Z in the chat panel' };
}
/**
 * Handle /redo command - redo
 */
async function handleRedo(args, context) {
    // For now, just show a message - redo is handled by the chat panel
    return { success: true, message: 'Redo requested - use Ctrl+Y in the chat panel' };
}
/**
 * Handle /save command - save session
 */
async function handleSave(args, context) {
    if (!args.trim()) {
        return { success: false, error: 'Please provide a session name' };
    }
    const sessionName = args.trim();
    try {
        // Create a new session with the given name as title
        await context.client.createSession(sessionName);
        return { success: true, message: `Session saved as: ${sessionName}` };
    }
    catch (error) {
        return { success: false, error: `Failed to save session: ${error}` };
    }
}
/**
 * Handle /load command - load session
 */
async function handleLoad(args, context) {
    if (!args.trim()) {
        return { success: false, error: 'Please provide a session name' };
    }
    try {
        context.client.setCurrentSession(args.trim());
        return { success: true, message: `Loaded session: ${args.trim()}` };
    }
    catch (error) {
        return { success: false, error: `Failed to load session: ${error}` };
    }
}
/**
 * Handle /export command - export conversation
 */
async function handleExport(args, context) {
    vscode.commands.executeCommand('morse.exportChat');
    return { success: true, message: 'Exporting conversation' };
}
/**
 * Handle /settings command - open settings
 */
async function handleSettings(args, context) {
    if (args.trim()) {
        vscode.commands.executeCommand('workbench.action.openSettings', args.trim());
    }
    else {
        vscode.commands.executeCommand('workbench.action.openSettings', 'morse');
    }
    return { success: true, message: 'Opening settings' };
}
/**
 * Handle /help command - show help
 */
async function handleHelp(args, context) {
    const commandName = args.trim().toLowerCase();
    if (commandName) {
        // Show help for specific command
        const command = getAllCommands().find(c => c.name === commandName || c.aliases?.includes(commandName));
        if (command) {
            return {
                success: true,
                message: `/${command.name}: ${command.description}`,
            };
        }
        return { success: false, error: `Unknown command: /${commandName}` };
    }
    // Show general help
    return {
        success: true,
        message: generateHelpText(),
    };
}
// ============================================================================
// Command Registry
// ============================================================================
/**
 * Get all available slash commands
 */
function getAllCommands() {
    return [
        {
            name: 'ask',
            description: 'Ask a question',
            category: 'AI',
            minArgs: 1,
            maxArgs: -1,
            argsPlaceholder: '<question>',
            aliases: ['a'],
            handler: handleAsk,
        },
        {
            name: 'edit',
            description: 'Edit selected code',
            category: 'Code',
            minArgs: 0,
            maxArgs: -1,
            argsPlaceholder: '<instruction>',
            aliases: ['e'],
            handler: handleEdit,
            shortcut: 'Ctrl+Shift+E',
        },
        {
            name: 'fix',
            description: 'Fix errors in selection',
            category: 'Code',
            minArgs: 0,
            maxArgs: -1,
            argsPlaceholder: '<instruction>',
            aliases: ['f'],
            handler: handleFix,
            shortcut: 'Ctrl+Shift+F',
        },
        {
            name: 'explain',
            description: 'Explain selected code',
            category: 'Code',
            minArgs: 0,
            maxArgs: -1,
            argsPlaceholder: '<question>',
            aliases: ['x'],
            handler: handleExplain,
        },
        {
            name: 'test',
            description: 'Generate tests for selected code',
            category: 'Code',
            minArgs: 0,
            maxArgs: -1,
            argsPlaceholder: '<instruction>',
            aliases: ['t'],
            handler: handleTest,
        },
        {
            name: 'commit',
            description: 'Generate commit message',
            category: 'Git',
            minArgs: 0,
            maxArgs: -1,
            argsPlaceholder: '<scope>',
            aliases: ['c'],
            handler: handleCommit,
        },
        {
            name: 'review',
            description: 'Review code',
            category: 'Code',
            minArgs: 0,
            maxArgs: -1,
            argsPlaceholder: '<focus>',
            aliases: ['r'],
            handler: handleReview,
        },
        {
            name: 'mode',
            description: 'Switch mode (ask/code/debug/architect)',
            category: 'Settings',
            minArgs: 0,
            maxArgs: 1,
            argsPlaceholder: '<name>',
            aliases: ['m'],
            handler: handleMode,
        },
        {
            name: 'context',
            description: 'Show context info',
            category: 'Info',
            minArgs: 0,
            maxArgs: 0,
            aliases: ['ctx', 'info'],
            handler: handleContext,
        },
        {
            name: 'agent',
            description: 'Run autonomous agent',
            category: 'Advanced',
            minArgs: 1,
            maxArgs: -1,
            argsPlaceholder: '<instruction>',
            aliases: ['ag'],
            handler: handleAgent,
        },
        {
            name: 'swarm',
            description: 'Run swarm',
            category: 'Advanced',
            minArgs: 0,
            maxArgs: -1,
            argsPlaceholder: '<instruction>',
            aliases: ['s'],
            handler: handleSwarm,
        },
        {
            name: 'memory',
            description: 'Memory operations',
            category: 'Data',
            minArgs: 0,
            maxArgs: -1,
            argsPlaceholder: '<subcommand>',
            aliases: ['mem'],
            handler: handleMemory,
        },
        {
            name: 'rag',
            description: 'RAG operations',
            category: 'Data',
            minArgs: 0,
            maxArgs: -1,
            argsPlaceholder: '<subcommand>',
            aliases: ['knowledge'],
            handler: handleRag,
        },
        {
            name: 'mcp',
            description: 'MCP operations',
            category: 'Data',
            minArgs: 0,
            maxArgs: -1,
            argsPlaceholder: '<subcommand>',
            aliases: ['tools'],
            handler: handleMcp,
        },
        {
            name: 'provider',
            description: 'Provider operations',
            category: 'Settings',
            minArgs: 0,
            maxArgs: -1,
            argsPlaceholder: '<subcommand>',
            aliases: ['prov', 'model'],
            handler: handleProvider,
        },
        {
            name: 'clear',
            description: 'Clear chat',
            category: 'Chat',
            minArgs: 0,
            maxArgs: 0,
            aliases: ['cl'],
            handler: handleClear,
        },
        {
            name: 'undo',
            description: 'Undo last action',
            category: 'Chat',
            minArgs: 0,
            maxArgs: 0,
            aliases: ['u'],
            handler: handleUndo,
        },
        {
            name: 'redo',
            description: 'Redo last action',
            category: 'Chat',
            minArgs: 0,
            maxArgs: 0,
            aliases: ['re'],
            handler: handleRedo,
        },
        {
            name: 'save',
            description: 'Save session',
            category: 'Session',
            minArgs: 1,
            maxArgs: 1,
            argsPlaceholder: '<name>',
            aliases: ['sv'],
            handler: handleSave,
        },
        {
            name: 'load',
            description: 'Load session',
            category: 'Session',
            minArgs: 1,
            maxArgs: 1,
            argsPlaceholder: '<name>',
            aliases: ['ld'],
            handler: handleLoad,
        },
        {
            name: 'export',
            description: 'Export conversation',
            category: 'Chat',
            minArgs: 0,
            maxArgs: 0,
            aliases: ['exp'],
            handler: handleExport,
        },
        {
            name: 'settings',
            description: 'Open settings',
            category: 'Settings',
            minArgs: 0,
            maxArgs: 1,
            argsPlaceholder: '<section>',
            aliases: ['config', 'pref'],
            handler: handleSettings,
        },
        {
            name: 'help',
            description: 'Show help',
            category: 'General',
            minArgs: 0,
            maxArgs: 1,
            argsPlaceholder: '<command>',
            aliases: ['h', '?'],
            handler: handleHelp,
        },
    ];
}
/**
 * Generate help text for all commands
 */
function generateHelpText() {
    const commands = getAllCommands();
    const lines = [
        '## Available Slash Commands',
        '',
        '| Command | Description |',
        '|---------|-------------|',
    ];
    for (const cmd of commands) {
        lines.push(`| /${cmd.name} | ${cmd.description} |`);
    }
    lines.push('');
    lines.push('Use `/help <command>` for more details on a specific command.');
    return lines.join('\n');
}
//# sourceMappingURL=commands.js.map