"use strict";
/**
 * JSON-RPC Server Implementation for Morse VS Code Extension
 * Manages JSON-RPC 2.0 server for IDE integration
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
exports.JSONRPCServer = void 0;
const vscode = __importStar(require("vscode"));
const child_process = __importStar(require("child_process"));
const events_1 = require("events");
const net = __importStar(require("net"));
const config_1 = require("./config");
class JSONRPCServer extends events_1.EventEmitter {
    config;
    process = null;
    status = 'stopped';
    port = 0;
    pid = null;
    server = null;
    clients = new Set();
    constructor() {
        super();
        this.config = (0, config_1.loadJSONRPCConfig)();
    }
    /**
     * Reload configuration
     */
    reloadConfig() {
        this.config = (0, config_1.loadJSONRPCConfig)();
    }
    /**
     * Get current server status
     */
    async getStatus() {
        const info = {
            type: 'jsonrpc',
            status: this.status,
            port: this.port,
            pid: this.pid ?? undefined,
        };
        if (this.status === 'running') {
            try {
                // Try to check if port is listening
                const reachable = await this.checkPortReachable();
                if (!reachable) {
                    this.status = 'error';
                    info.status = 'error';
                    info.error = 'Server not responding';
                }
            }
            catch {
                info.error = 'Failed to check server status';
            }
        }
        return info;
    }
    /**
     * Check if port is listening
     */
    async checkPortReachable() {
        return new Promise((resolve) => {
            const socket = new net.Socket();
            socket.setTimeout(1000);
            socket.on('connect', () => {
                socket.destroy();
                resolve(true);
            });
            socket.on('timeout', () => {
                socket.destroy();
                resolve(false);
            });
            socket.on('error', () => {
                resolve(false);
            });
            socket.connect(this.port, this.config.host);
        });
    }
    /**
     * Start the JSON-RPC server
     */
    async start() {
        if (this.status === 'running') {
            return this.getStatus();
        }
        this.status = 'starting';
        this.emit('statusChange', { type: 'jsonrpc', status: 'starting' });
        try {
            // Get workspace path
            const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (!workspacePath) {
                throw new Error('No workspace folder open');
            }
            // Set port from config
            this.port = this.config.port;
            // Find morse CLI path
            const morsePath = await this.findMorsePath();
            if (!morsePath) {
                throw new Error('Morse CLI not found. Please ensure morse is installed.');
            }
            // Start embedded JSON-RPC server
            await this.startEmbeddedServer();
            this.status = 'running';
            this.emit('statusChange', { type: 'jsonrpc', status: 'running' });
            return this.getStatus();
        }
        catch (error) {
            this.status = 'error';
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.emit('statusChange', {
                type: 'jsonrpc',
                status: 'error',
                info: { type: 'jsonrpc', status: 'error', error: errorMessage }
            });
            throw new Error(`Failed to start JSON-RPC server: ${errorMessage}`);
        }
    }
    /**
     * Start embedded JSON-RPC server
     */
    async startEmbeddedServer() {
        return new Promise((resolve, reject) => {
            this.server = net.createServer((socket) => {
                this.clients.add(socket);
                let buffer = '';
                socket.on('data', (data) => {
                    buffer += data.toString();
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';
                    for (const line of lines) {
                        if (line.trim()) {
                            this.handleRequest(line, socket);
                        }
                    }
                });
                socket.on('close', () => {
                    this.clients.delete(socket);
                });
                socket.on('error', (err) => {
                    console.error('[Morse JSON-RPC] Socket error:', err.message);
                    this.clients.delete(socket);
                });
            });
            this.server.on('error', (err) => {
                reject(err);
            });
            this.server.listen(this.port, this.config.host, () => {
                resolve();
            });
        });
    }
    /**
     * Handle JSON-RPC request
     */
    handleRequest(line, socket) {
        try {
            const request = JSON.parse(line);
            const response = this.processRequest(request);
            socket.write(JSON.stringify(response) + '\n');
        }
        catch (err) {
            const error = {
                code: -32700,
                message: 'Parse error',
            };
            const response = {
                jsonrpc: '2.0',
                id: 0,
                error,
            };
            socket.write(JSON.stringify(response) + '\n');
        }
    }
    /**
     * Process JSON-RPC request
     */
    processRequest(request) {
        const id = request.id ?? 0;
        // Validate JSON-RPC version
        if (request.jsonrpc !== '2.0') {
            return {
                jsonrpc: '2.0',
                id,
                error: {
                    code: -32600,
                    message: 'Invalid JSON-RPC version',
                },
            };
        }
        // Check authentication
        const authHeader = request.params?.['auth'];
        if (!(0, config_1.validateApiKey)(this.config, authHeader || '')) {
            return {
                jsonrpc: '2.0',
                id,
                error: {
                    code: -32601,
                    message: 'Unauthorized',
                },
            };
        }
        // Route to handler
        switch (request.method) {
            case 'initialize':
                return this.handleInitialize(request, id);
            case 'ping':
                return this.handlePing(request, id);
            case 'chat.complete':
                return this.handleChatComplete(request, id);
            case 'session.create':
                return this.handleSessionCreate(request, id);
            case 'session.send':
                return this.handleSessionSend(request, id);
            case 'tool.execute':
                return this.handleToolExecute(request, id);
            default:
                return {
                    jsonrpc: '2.0',
                    id,
                    error: {
                        code: -32601,
                        message: `Method not found: ${request.method}`,
                    },
                };
        }
    }
    /**
     * Handle initialize method
     */
    handleInitialize(request, id) {
        return {
            jsonrpc: '2.0',
            id,
            result: {
                capabilities: {
                    streaming: true,
                    tools: true,
                    call: true,
                },
                version: '1.0.0',
            },
        };
    }
    /**
     * Handle ping method
     */
    handlePing(request, id) {
        return {
            jsonrpc: '2.0',
            id,
            result: 'pong',
        };
    }
    /**
     * Handle chat.complete method
     */
    handleChatComplete(request, id) {
        const params = request.params;
        const message = params?.['message'];
        const sessionId = params?.['session_id'];
        const model = params?.['model'];
        if (!message) {
            return {
                jsonrpc: '2.0',
                id,
                error: {
                    code: -32602,
                    message: 'Missing required parameter: message',
                },
            };
        }
        // TODO: Implement actual chat completion via MorseClient
        return {
            jsonrpc: '2.0',
            id,
            result: {
                sessionId: sessionId || 'new-session',
                message: `Echo: ${message}`,
                model: model || 'default',
            },
        };
    }
    /**
     * Handle session.create method
     */
    handleSessionCreate(request, id) {
        const params = request.params;
        const name = params?.['name'];
        // TODO: Implement actual session creation
        return {
            jsonrpc: '2.0',
            id,
            result: {
                id: `session-${Date.now()}`,
                name: name || 'New Session',
                createdAt: new Date().toISOString(),
            },
        };
    }
    /**
     * Handle session.send method
     */
    handleSessionSend(request, id) {
        const params = request.params;
        const sessionId = params?.['session_id'];
        const message = params?.['message'];
        if (!sessionId || !message) {
            return {
                jsonrpc: '2.0',
                id,
                error: {
                    code: -32602,
                    message: 'Missing required parameters: session_id, message',
                },
            };
        }
        // TODO: Implement actual session message sending
        return {
            jsonrpc: '2.0',
            id,
            result: {
                sessionId,
                messageId: `msg-${Date.now()}`,
                status: 'sent',
            },
        };
    }
    /**
     * Handle tool.execute method
     */
    handleToolExecute(request, id) {
        const params = request.params;
        const toolName = params?.['name'];
        const args = params?.['args'];
        if (!toolName) {
            return {
                jsonrpc: '2.0',
                id,
                error: {
                    code: -32602,
                    message: 'Missing required parameter: name',
                },
            };
        }
        // TODO: Implement actual tool execution
        return {
            jsonrpc: '2.0',
            id,
            result: {
                tool: toolName,
                args: args || {},
                result: `Tool ${toolName} executed`,
            },
        };
    }
    /**
     * Stop the server
     */
    async stop() {
        if (this.status !== 'running' && this.status !== 'starting') {
            return;
        }
        this.status = 'stopping';
        this.emit('statusChange', { type: 'jsonrpc', status: 'stopping' });
        try {
            // Close all client connections
            for (const client of this.clients) {
                client.destroy();
            }
            this.clients.clear();
            // Close server
            if (this.server) {
                await new Promise((resolve) => {
                    this.server?.close(() => resolve());
                });
            }
            this.status = 'stopped';
            this.emit('statusChange', { type: 'jsonrpc', status: 'stopped' });
        }
        catch (error) {
            this.status = 'error';
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`Failed to stop JSON-RPC server: ${errorMessage}`);
        }
        finally {
            this.server = null;
            this.process = null;
            this.pid = null;
        }
    }
    /**
     * Restart the server
     */
    async restart() {
        await this.stop();
        await new Promise(resolve => setTimeout(resolve, 500));
        return this.start();
    }
    /**
     * Find morse CLI path
     */
    async findMorsePath() {
        const checkPath = (cmd) => {
            return new Promise((resolve) => {
                child_process.exec(cmd, (err, stdout) => {
                    if (err || !stdout.toString().trim()) {
                        resolve(null);
                    }
                    else {
                        resolve(stdout.toString().trim());
                    }
                });
            });
        };
        const possiblePaths = ['which morse', 'npm list -g morse-cli'];
        for (const cmd of possiblePaths) {
            const result = await checkPath(cmd);
            if (result) {
                return result;
            }
        }
        return 'morse';
    }
    /**
     * Dispose resources
     */
    dispose() {
        this.stop();
        this.removeAllListeners();
    }
}
exports.JSONRPCServer = JSONRPCServer;
//# sourceMappingURL=jsonrpc.js.map