"use strict";
/**
 * Morse VS Code Extension
 * Enhanced with streaming, session persistence, better error handling,
 * and native Chat API integration
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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const client_1 = require("./morse/client");
const ChatPanel_1 = require("./views/chat/ChatPanel");
const StatusBarItem_1 = require("./status/StatusBarItem");
const MorseCodeLensProvider_1 = require("./codelens/MorseCodeLensProvider");
const InlineCompletionProvider_1 = require("./completion/InlineCompletionProvider");
const index_1 = require("./commands/index");
const localOpen_1 = require("./commands/localOpen");
const provider_1 = require("./chat/provider");
let client;
let statusBar;
function activate(context) {
    console.log('Morse extension activated');
    // Validate settings before use
    const settingsValidation = validateSettings();
    if (!settingsValidation.valid) {
        vscode.window.showWarningMessage(`Morse: ${settingsValidation.message}`, 'Open Settings').then((selection) => {
            if (selection === 'Open Settings') {
                vscode.commands.executeCommand('workbench.action.openSettings', 'morse');
            }
        });
    }
    // Initialize client
    client = new client_1.MorseClient();
    // Initialize status bar
    statusBar = new StatusBarItem_1.StatusBarManager(client);
    context.subscriptions.push(statusBar);
    // Register commands
    (0, index_1.registerCommands)(context, client);
    // Register local open commands
    (0, localOpen_1.registerLocalOpenCommand)(context);
    // Register code lens provider
    const codeLensProvider = new MorseCodeLensProvider_1.MorseCodeLensProvider();
    context.subscriptions.push(vscode.languages.registerCodeLensProvider({ pattern: '**/*' }, codeLensProvider));
    // Register inline completion provider
    const completionProvider = new InlineCompletionProvider_1.InlineCompletionProvider(client);
    context.subscriptions.push(vscode.languages.registerInlineCompletionItemProvider({ pattern: '**/*' }, completionProvider));
    // Register native Chat API participant (if available in this VS Code version)
    try {
        // Check if chat namespace exists (VS Code 1.90+)
        if (vscode.chat?.createChatParticipant) {
            (0, provider_1.registerChatParticipant)(context, client);
            console.log('[Morse] Native Chat API participant registered');
        }
    }
    catch (error) {
        console.log('[Morse] Native Chat API not available in this version');
    }
    // Handle webview restoration
    context.subscriptions.push(vscode.window.registerWebviewPanelSerializer('morse.chat', {
        async deserializeWebviewPanel(webviewPanel) {
            ChatPanel_1.ChatPanel.revive(webviewPanel, context.extensionUri, client, context);
        },
    }));
    // Register additional commands that need ChatPanel access
    registerChatCommands(context);
    // Watch for configuration changes
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('morse')) {
            console.log('[Morse] Configuration changed, reloading...');
            // Re-validate settings
            const validation = validateSettings();
            if (!validation.valid && validation.showNotification) {
                vscode.window.showWarningMessage(`Morse: ${validation.message}`);
            }
        }
    }));
}
/**
 * Validate Morse settings
 */
function validateSettings() {
    const config = vscode.workspace.getConfiguration('morse');
    // Get settings with proper defaults
    const apiKey = config.get('apiKey') || '';
    const endpoint = config.get('endpoint') || 'http://localhost:8080';
    const model = config.get('model') || 'claude-3-5-sonnet-20241022';
    // Check API key
    if (!apiKey) {
        // Check for environment variable fallback
        const envApiKey = process.env.MORSE_API_KEY;
        if (!envApiKey) {
            return {
                valid: false,
                message: 'API key not configured. Set morse.apiKey or MORSE_API_KEY env var.',
                showNotification: true,
            };
        }
    }
    // Validate endpoint format
    try {
        new URL(endpoint);
    }
    catch {
        return {
            valid: false,
            message: `Invalid endpoint URL: ${endpoint}`,
            showNotification: true,
        };
    }
    // Validate model
    const validModels = [
        'claude-3-5-sonnet-20241022',
        'claude-3-opus-20240229',
        'gpt-4o',
        'gpt-4-turbo',
    ];
    if (!validModels.includes(model)) {
        console.warn(`[Morse] Unknown model: ${model}`);
    }
    return { valid: true, message: 'Settings valid' };
}
function registerChatCommands(context) {
    // Open Chat
    const openChat = vscode.commands.registerCommand('morse.chat', () => {
        if (ChatPanel_1.ChatPanel.currentPanel) {
            ChatPanel_1.ChatPanel.currentPanel.reveal();
        }
        else {
            ChatPanel_1.ChatPanel.create(context.extensionUri, client, context);
        }
    });
    // Clear Chat command
    const clearChat = vscode.commands.registerCommand('morse.clearChat', () => {
        if (ChatPanel_1.ChatPanel.currentPanel) {
            vscode.window.showInformationMessage('Use the clear button in the chat panel');
        }
    });
    // Export Chat command
    const exportChat = vscode.commands.registerCommand('morse.exportChat', async () => {
        if (ChatPanel_1.ChatPanel.currentPanel) {
            vscode.window.showInformationMessage('Use the export button in the chat panel');
        }
    });
    // Accept Hunk command
    const acceptHunk = vscode.commands.registerCommand('morse.acceptHunk', (hunkId) => {
        vscode.window.showInformationMessage(`Accepted changes for ${hunkId}`);
    });
    // Reject Hunk command
    const rejectHunk = vscode.commands.registerCommand('morse.rejectHunk', (hunkId) => {
        vscode.window.showInformationMessage(`Rejected changes for ${hunkId}`);
    });
    // Accept All Hunks command
    const acceptAllHunks = vscode.commands.registerCommand('morse.acceptAllHunks', () => {
        vscode.window.showInformationMessage('All changes accepted');
    });
    context.subscriptions.push(openChat, clearChat, exportChat, acceptHunk, rejectHunk, acceptAllHunks);
}
function deactivate() {
    console.log('Morse extension deactivated');
}
//# sourceMappingURL=extension.js.map