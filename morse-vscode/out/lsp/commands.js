"use strict";
/**
 * Morse LSP Server Commands
 * Registers LSP server commands with VS Code
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
exports.registerLSPCommands = registerLSPCommands;
const vscode = __importStar(require("vscode"));
const LSPServer_1 = require("./LSPServer");
/**
 * Register LSP commands
 */
function registerLSPCommands(context, server) {
    // Start LSP server
    const startCommand = vscode.commands.registerCommand('morse.lsp.start', async () => {
        try {
            await server.start();
            vscode.window.showInformationMessage('Morse LSP Server started');
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to start LSP Server: ${error}`);
        }
    });
    context.subscriptions.push(startCommand);
    // Stop LSP server
    const stopCommand = vscode.commands.registerCommand('morse.lsp.stop', async () => {
        try {
            await server.stop();
            vscode.window.showInformationMessage('Morse LSP Server stopped');
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to stop LSP Server: ${error}`);
        }
    });
    context.subscriptions.push(stopCommand);
    // Restart LSP server
    const restartCommand = vscode.commands.registerCommand('morse.lsp.restart', async () => {
        try {
            await server.restart();
            vscode.window.showInformationMessage('Morse LSP Server restarted');
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to restart LSP Server: ${error}`);
        }
    });
    context.subscriptions.push(restartCommand);
    // Show LSP server status
    const statusCommand = vscode.commands.registerCommand('morse.lsp.status', async () => {
        const status = server.getStatus();
        const stateMessages = {
            [LSPServer_1.LSPServerState.RUNNING]: 'Running',
            [LSPServer_1.LSPServerState.STARTING]: 'Starting...',
            [LSPServer_1.LSPServerState.STOPPING]: 'Stopping...',
            [LSPServer_1.LSPServerState.STOPPED]: 'Stopped',
            [LSPServer_1.LSPServerState.ERROR]: 'Error',
        };
        const message = `Morse LSP Server\n\n` +
            `Status: ${stateMessages[status.state]}\n` +
            `Port: ${status.config.port}\n` +
            `Host: ${status.config.host}\n` +
            `Transport: ${status.config.transport}\n` +
            `Enabled: ${status.config.enabled ? 'Yes' : 'No'}`;
        if (status.state === LSPServer_1.LSPServerState.RUNNING) {
            const action = await vscode.window.showInformationMessage(message, 'Stop', 'Restart');
            if (action === 'Stop') {
                await server.stop();
            }
            else if (action === 'Restart') {
                await server.restart();
            }
        }
        else if (status.state === LSPServer_1.LSPServerState.STOPPED || status.state === LSPServer_1.LSPServerState.ERROR) {
            const action = await vscode.window.showInformationMessage(message, 'Start');
            if (action === 'Start') {
                await server.start();
            }
        }
        else {
            vscode.window.showInformationMessage(message);
        }
    });
    context.subscriptions.push(statusCommand);
    console.log('[LSP] Commands registered');
}
//# sourceMappingURL=commands.js.map