"use strict";
/**
 * Morse LSP Server Implementation
 * Provides AI-powered code assistance via Language Server Protocol
 * Supports stdio and TCP connections
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
exports.LSPServer = exports.LSPServerState = exports.DEFAULT_LSP_SERVER_CONFIG = void 0;
exports.createLSPServer = createLSPServer;
const vscode = __importStar(require("vscode"));
const net = __importStar(require("net"));
const readline = __importStar(require("readline"));
/**
 * LSP method names
 */
const LSP_METHODS = {
    INITIALIZE: 'initialize',
    INITIALIZED: 'initialized',
    SHUTDOWN: 'shutdown',
    EXIT: 'exit',
    TEXT_DOCUMENT_COMPLETION: 'textDocument/completion',
    TEXT_DOCUMENT_HOVER: 'textDocument/hover',
    TEXT_DOCUMENT_DID_CHANGE: 'textDocument/didChange',
    TEXT_DOCUMENT_DID_OPEN: 'textDocument/didOpen',
    TEXT_DOCUMENT_DID_CLOSE: 'textDocument/didClose',
    TEXT_DOCUMENT_PUBLISH_DIAGNOSTICS: 'textDocument/publishDiagnostics',
    TEXT_DOCUMENT_CODE_ACTION: 'textDocument/codeAction',
    TEXT_DOCUMENT_DEFINITION: 'textDocument/definition',
    TEXT_DOCUMENT_REFERENCES: 'textDocument/references',
    WORKSPACE_SYMBOL: 'workspace/symbol',
    WINDOW_SHOW_MESSAGE: 'window/showMessage',
    WINDOW_LOG_MESSAGE: 'window/logMessage',
};
/**
 * LSP error codes
 */
const LSP_ERROR_CODES = {
    PARSE_ERROR: -32700,
    INVALID_REQUEST: -32600,
    METHOD_NOT_FOUND: -32601,
    INVALID_PARAMS: -32602,
    INTERNAL_ERROR: -32603,
    SERVER_ERROR_START: -32000,
    SERVER_ERROR_END: -32099,
    REQUEST_CANCELLED: -32800,
    CONTENT_MODIFIED: -32801,
    REQUEST_TIMEOUT: -32802,
};
/**
 * Default LSP server configuration
 */
exports.DEFAULT_LSP_SERVER_CONFIG = {
    port: 9310,
    host: '127.0.0.1',
    enabled: true,
    transport: 'tcp',
};
/**
 * Server state
 */
var LSPServerState;
(function (LSPServerState) {
    LSPServerState["STOPPED"] = "stopped";
    LSPServerState["STARTING"] = "starting";
    LSPServerState["RUNNING"] = "running";
    LSPServerState["STOPPING"] = "stopping";
    LSPServerState["ERROR"] = "error";
})(LSPServerState || (exports.LSPServerState = LSPServerState = {}));
/**
 * Morse LSP Server
 * Implements the Language Server Protocol for AI-powered code assistance
 */
class LSPServer {
    client;
    config;
    state = LSPServerState.STOPPED;
    server = null;
    connections = new Set();
    requestId = 0;
    pendingRequests = new Map();
    documents = new Map();
    statusBarItem = null;
    context = null;
    // Server capabilities
    capabilities = {
        textDocumentSync: 1, // Full document sync
        completionProvider: {
            triggerCharacters: ['.', '(', '[', '"', "'", '@', '/'],
            resolveProvider: true,
        },
        hoverProvider: true,
        definitionProvider: true,
        referencesProvider: true,
        codeActionProvider: true,
        documentSymbolProvider: true,
        workspaceSymbolProvider: true,
    };
    constructor(client, config) {
        this.client = client;
        this.config = { ...exports.DEFAULT_LSP_SERVER_CONFIG, ...config };
    }
    /**
     * Initialize the LSP server
     */
    async initialize(context) {
        this.context = context;
        // Load configuration
        this.loadConfiguration();
        // Create status bar item
        this.createStatusBarItem();
        // Listen for configuration changes
        context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(() => {
            this.loadConfiguration();
        }));
        console.log('Morse LSP Server initialized');
    }
    /**
     * Load configuration from workspace settings
     */
    loadConfiguration() {
        const config = vscode.workspace.getConfiguration('morse');
        this.config.enabled = config.get('lspServer.enabled', exports.DEFAULT_LSP_SERVER_CONFIG.enabled);
        this.config.port = config.get('lspServer.port', exports.DEFAULT_LSP_SERVER_CONFIG.port);
        this.config.host = config.get('lspServer.host', exports.DEFAULT_LSP_SERVER_CONFIG.host);
        this.config.transport = config.get('lspServer.transport', exports.DEFAULT_LSP_SERVER_CONFIG.transport);
        console.log('[LSP Server] Configuration loaded:', this.config);
    }
    /**
     * Create status bar item for LSP server
     */
    createStatusBarItem() {
        if (!this.context)
            return;
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 95);
        this.statusBarItem.command = 'morse.lsp.status';
        this.statusBarItem.text = '$(symbol-property) LSP: Off';
        this.statusBarItem.tooltip = 'Morse LSP Server: Click to see status';
        this.statusBarItem.show();
        this.context.subscriptions.push(this.statusBarItem);
        this.updateStatusBar();
    }
    /**
     * Update status bar item
     */
    updateStatusBar() {
        if (!this.statusBarItem)
            return;
        switch (this.state) {
            case LSPServerState.RUNNING:
                this.statusBarItem.text = `$(symbol-property) LSP: ${this.config.port}`;
                this.statusBarItem.tooltip = `Morse LSP Server running on ${this.config.host}:${this.config.port}`;
                this.statusBarItem.color = new vscode.ThemeColor('extensionHostStartupProblemForeground');
                break;
            case LSPServerState.STARTING:
                this.statusBarItem.text = '$(sync) LSP: Starting';
                this.statusBarItem.tooltip = 'Morse LSP Server is starting...';
                break;
            case LSPServerState.STOPPING:
                this.statusBarItem.text = '$(sync) LSP: Stopping';
                this.statusBarItem.tooltip = 'Morse LSP Server is stopping...';
                break;
            case LSPServerState.ERROR:
                this.statusBarItem.text = '$(error) LSP: Error';
                this.statusBarItem.tooltip = 'Morse LSP Server encountered an error';
                this.statusBarItem.color = new vscode.ThemeColor('editorError.foreground');
                break;
            case LSPServerState.STOPPED:
            default:
                this.statusBarItem.text = '$(symbol-property) LSP: Off';
                this.statusBarItem.tooltip = 'Morse LSP Server is stopped. Click to start.';
                break;
        }
    }
    /**
     * Start the LSP server
     */
    async start() {
        if (this.state === LSPServerState.RUNNING) {
            console.log('[LSP Server] Already running');
            return;
        }
        if (!this.config.enabled) {
            console.log('[LSP Server] Disabled in configuration');
            this.state = LSPServerState.STOPPED;
            this.updateStatusBar();
            return;
        }
        this.state = LSPServerState.STARTING;
        this.updateStatusBar();
        try {
            if (this.config.transport === 'tcp') {
                await this.startTCPServer();
            }
            else {
                await this.startStdioServer();
            }
            this.state = LSPServerState.RUNNING;
            this.updateStatusBar();
            vscode.window.showInformationMessage(`Morse LSP Server started on port ${this.config.port}`);
        }
        catch (error) {
            this.state = LSPServerState.ERROR;
            this.updateStatusBar();
            console.error('[LSP Server] Failed to start:', error);
            vscode.window.showErrorMessage(`Failed to start LSP Server: ${error}`);
            throw error;
        }
    }
    /**
     * Start TCP server
     */
    startTCPServer() {
        return new Promise((resolve, reject) => {
            this.server = net.createServer((socket) => {
                this.handleConnection(socket);
            });
            this.server.on('error', (err) => {
                console.error('[LSP Server] TCP Server error:', err);
                reject(err);
            });
            this.server.listen(this.config.port, this.config.host, () => {
                console.log(`[LSP Server] Listening on ${this.config.host}:${this.config.port}`);
                resolve();
            });
        });
    }
    /**
     * Start stdio server (for subprocess mode)
     */
    startStdioServer() {
        return new Promise((resolve) => {
            console.log('[LSP Server] Starting stdio server');
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout,
                terminal: false,
            });
            rl.on('line', (line) => {
                this.handleMessage(line, null);
            });
            process.stdin.on('end', () => {
                this.stop();
            });
            resolve();
        });
    }
    /**
     * Handle incoming connection
     */
    handleConnection(socket) {
        this.connections.add(socket);
        console.log('[LSP Server] New connection');
        let buffer = '';
        socket.on('data', (data) => {
            buffer += data.toString();
            // Process complete JSON-RPC messages
            let newlineIndex;
            while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
                const message = buffer.substring(0, newlineIndex);
                buffer = buffer.substring(newlineIndex + 1);
                if (message.trim()) {
                    this.handleMessage(message, socket);
                }
            }
        });
        socket.on('close', () => {
            this.connections.delete(socket);
            console.log('[LSP Server] Connection closed');
        });
        socket.on('error', (err) => {
            console.error('[LSP Server] Socket error:', err);
            this.connections.delete(socket);
        });
    }
    /**
     * Handle incoming LSP message
     */
    handleMessage(messageStr, socket) {
        try {
            const message = JSON.parse(messageStr);
            if (message.method) {
                this.handleRequest(message, socket);
            }
            else if (message.id !== undefined) {
                this.handleResponse(message, socket);
            }
        }
        catch (error) {
            console.error('[LSP Server] Failed to parse message:', error);
            this.sendErrorResponse(0, LSP_ERROR_CODES.PARSE_ERROR, 'Parse error', error, socket);
        }
    }
    /**
     * Handle LSP request
     */
    async handleRequest(message, socket) {
        const { method, id, params } = message;
        console.log('[LSP Server] Received request:', method);
        try {
            let result;
            switch (method) {
                case LSP_METHODS.INITIALIZE:
                    result = await this.handleInitialize(params);
                    break;
                case LSP_METHODS.INITIALIZED:
                    // Client initialized - no response needed
                    return;
                case LSP_METHODS.SHUTDOWN:
                    result = null;
                    break;
                case LSP_METHODS.TEXT_DOCUMENT_COMPLETION:
                    result = await this.handleCompletion(params);
                    break;
                case LSP_METHODS.TEXT_DOCUMENT_HOVER:
                    result = await this.handleHover(params);
                    break;
                case LSP_METHODS.TEXT_DOCUMENT_DEFINITION:
                    result = await this.handleDefinition(params);
                    break;
                case LSP_METHODS.TEXT_DOCUMENT_REFERENCES:
                    result = await this.handleReferences(params);
                    break;
                case LSP_METHODS.TEXT_DOCUMENT_CODE_ACTION:
                    result = await this.handleCodeAction(params);
                    break;
                case LSP_METHODS.WORKSPACE_SYMBOL:
                    result = await this.handleWorkspaceSymbol(params);
                    break;
                default:
                    this.sendErrorResponse(id, LSP_ERROR_CODES.METHOD_NOT_FOUND, `Method not found: ${method}`, null, socket);
                    return;
            }
            // Send response
            this.sendResponse(id, result, socket);
        }
        catch (error) {
            console.error('[LSP Server] Error handling request:', error);
            this.sendErrorResponse(id, LSP_ERROR_CODES.INTERNAL_ERROR, 'Internal error', error, socket);
        }
    }
    /**
     * Handle response message
     */
    handleResponse(message, socket) {
        const { id, result, error } = message;
        if (id !== undefined) {
            const pending = this.pendingRequests.get(typeof id === 'number' ? id : parseInt(id));
            if (pending) {
                if (error) {
                    pending.reject(error);
                }
                else {
                    pending.resolve(result);
                }
                this.pendingRequests.delete(typeof id === 'number' ? id : parseInt(id));
            }
        }
    }
    /**
     * Send response
     */
    sendResponse(id, result, socket) {
        const response = {
            jsonrpc: '2.0',
            id,
            result,
        };
        this.sendMessage(response, socket);
    }
    /**
     * Send error response
     */
    sendErrorResponse(id, code, message, data, socket) {
        const response = {
            jsonrpc: '2.0',
            id,
            error: {
                code,
                message,
                data,
            },
        };
        this.sendMessage(response, socket);
    }
    /**
     * Send notification
     */
    sendNotification(method, params, socket) {
        const notification = {
            jsonrpc: '2.0',
            method,
            params,
        };
        this.sendMessage(notification, socket);
    }
    /**
     * Send message
     */
    sendMessage(message, socket) {
        const messageStr = JSON.stringify(message) + '\n';
        if (socket) {
            socket.write(messageStr);
        }
        else {
            process.stdout.write(messageStr);
        }
    }
    /**
     * Handle initialize request
     */
    handleInitialize(params) {
        console.log('[LSP Server] Initialize request:', params);
        return {
            capabilities: this.capabilities,
            serverInfo: {
                name: 'Morse LSP Server',
                version: '1.0.0',
            },
        };
    }
    /**
     * Handle completion request
     */
    async handleCompletion(params) {
        const { textDocument, position } = params;
        const document = this.documents.get(textDocument.uri);
        if (!document) {
            return [];
        }
        const completions = [];
        try {
            // Get AI-powered completions from Morse
            const line = document.text.split('\n')[position.line] || '';
            const beforeCursor = line.substring(0, position.character);
            const wordMatch = line.match(/(\w+)$/);
            const word = wordMatch ? wordMatch[1] : '';
            // Get context for completion
            const request = {
                type: 'completion',
                fileType: document.languageId,
                context: beforeCursor.slice(-200),
                cursorWord: word,
                line: position.line + 1,
                column: position.character + 1,
            };
            // Add Morse-specific completions
            completions.push({
                label: '// morse:explain',
                kind: vscode.CompletionItemKind.Text,
                detail: 'Explain the selected code using Morse AI',
                documentation: 'Use Morse AI to explain the selected code',
                insertText: '// morse:explain ',
                sortText: '0',
            }, {
                label: '// morse:fix',
                kind: vscode.CompletionItemKind.Text,
                detail: 'Fix issues in the selected code',
                documentation: 'Use Morse AI to fix issues in the selected code',
                insertText: '// morse:fix ',
                sortText: '1',
            }, {
                label: '// morse:refactor',
                kind: vscode.CompletionItemKind.Text,
                detail: 'Refactor the selected code',
                documentation: 'Use Morse AI to refactor the selected code',
                insertText: '// morse:refactor ',
                sortText: '2',
            }, {
                label: '// morse:test',
                kind: vscode.CompletionItemKind.Text,
                detail: 'Generate tests for the selected code',
                documentation: 'Use Morse AI to generate tests',
                insertText: '// morse:test ',
                sortText: '3',
            }, {
                label: '// morse:doc',
                kind: vscode.CompletionItemKind.Text,
                detail: 'Generate documentation',
                documentation: 'Use Morse AI to generate documentation',
                insertText: '// morse:doc ',
                sortText: '4',
            });
        }
        catch (error) {
            console.error('[LSP Server] Error getting completions:', error);
        }
        return completions;
    }
    /**
     * Handle hover request
     */
    async handleHover(params) {
        const { textDocument, position } = params;
        const document = this.documents.get(textDocument.uri);
        if (!document) {
            return null;
        }
        // Get word at position
        const lines = document.text.split('\n');
        const line = lines[position.line] || '';
        const wordMatch = line.match(/\b(\w+)\b/);
        if (!wordMatch) {
            return null;
        }
        const word = wordMatch[1];
        // Return hover information
        return {
            contents: {
                kind: 'markdown',
                value: `**${word}**\n\nHover information powered by Morse AI`,
            },
        };
    }
    /**
     * Handle definition request
     */
    async handleDefinition(params) {
        // AI-powered go to definition - for now return null to use client defaults
        return null;
    }
    /**
     * Handle references request
     */
    async handleReferences(params) {
        // AI-powered find references - for now return empty
        return [];
    }
    /**
     * Handle code action request
     */
    async handleCodeAction(params) {
        const actions = [];
        // Add Morse AI-powered code actions
        actions.push({
            title: 'Explain with Morse AI',
            command: {
                title: 'Explain',
                command: 'morse.explain',
            },
            kind: vscode.CodeActionKind.QuickFix,
        });
        actions.push({
            title: 'Fix with Morse AI',
            command: {
                title: 'Fix',
                command: 'morse.fix',
            },
            kind: vscode.CodeActionKind.QuickFix,
        });
        return actions;
    }
    /**
     * Handle workspace symbol request
     */
    async handleWorkspaceSymbol(params) {
        // Search workspace for symbols - for now return empty
        return [];
    }
    /**
     * Handle document did change notification
     */
    handleDidChange(params) {
        const { textDocument, contentChanges } = params;
        const document = this.documents.get(textDocument.uri);
        if (document) {
            document.text = contentChanges[0]?.text || '';
            document.version = textDocument.version;
        }
    }
    /**
     * Handle document did open notification
     */
    handleDidOpen(params) {
        const { textDocument } = params;
        this.documents.set(textDocument.uri, {
            uri: textDocument.uri,
            text: textDocument.text,
            version: textDocument.version,
            languageId: textDocument.languageId,
        });
    }
    /**
     * Handle document did close notification
     */
    handleDidClose(params) {
        this.documents.delete(params.textDocument.uri);
    }
    /**
     * Stop the LSP server
     */
    async stop() {
        if (this.state !== LSPServerState.RUNNING && this.state !== LSPServerState.STARTING) {
            console.log('[LSP Server] Not running');
            return;
        }
        this.state = LSPServerState.STOPPING;
        this.updateStatusBar();
        // Close all connections
        for (const socket of this.connections) {
            socket.destroy();
        }
        this.connections.clear();
        // Close server
        if (this.server) {
            await new Promise((resolve) => {
                this.server.close(() => {
                    resolve();
                });
            });
            this.server = null;
        }
        this.state = LSPServerState.STOPPED;
        this.updateStatusBar();
        console.log('[LSP Server] Stopped');
    }
    /**
     * Restart the LSP server
     */
    async restart() {
        console.log('[LSP Server] Restarting...');
        await this.stop();
        await this.start();
    }
    /**
     * Get server status
     */
    getStatus() {
        return {
            state: this.state,
            config: this.config,
        };
    }
    /**
     * Dispose
     */
    dispose() {
        this.stop();
        if (this.statusBarItem) {
            this.statusBarItem.dispose();
            this.statusBarItem = null;
        }
    }
}
exports.LSPServer = LSPServer;
/**
 * Create and register the Morse LSP server
 */
function createLSPServer(context, client) {
    const server = new LSPServer(client);
    server.initialize(context);
    return server;
}
//# sourceMappingURL=LSPServer.js.map