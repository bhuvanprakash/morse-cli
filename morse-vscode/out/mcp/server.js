"use strict";
/**
 * MCP Server Implementation
 * Exposes morse-cli tools as MCP server tools using stdio transport
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
exports.MCPServerManager = exports.MCPServer = void 0;
exports.getMCPServerManager = getMCPServerManager;
exports.initializeMCPServer = initializeMCPServer;
const vscode = __importStar(require("vscode"));
const cp = __importStar(require("child_process"));
const readline = __importStar(require("readline"));
const events_1 = require("events");
// Protocol constants
const LATEST_PROTOCOL_VERSION = '2024-11-05';
const JSONRPC_VERSION = '2.0';
/**
 * MCP Server that exposes morse-cli tools
 */
class MCPServer extends events_1.EventEmitter {
    process = null;
    rl = null;
    messageId = 0;
    pendingRequests = new Map();
    initialized = false;
    serverCapabilities = {};
    serverInfo = null;
    tools = [];
    status = 'disconnected';
    morsePath;
    constructor(morsePath = 'morse') {
        super();
        this.morsePath = morsePath;
    }
    /**
     * Get current server status
     */
    getStatus() {
        return this.status;
    }
    /**
     * Get list of available tools
     */
    getTools() {
        return this.tools;
    }
    /**
     * Connect to morse-cli via stdio
     */
    async connect() {
        if (this.status === 'connected' || this.status === 'connecting') {
            return;
        }
        this.status = 'connecting';
        this.emit('statusChange', this.status);
        return new Promise((resolve, reject) => {
            try {
                // Start morse process with mcp serve mode
                this.process = cp.spawn(this.morsePath, ['mcp', 'serve'], {
                    stdio: ['pipe', 'pipe', 'pipe'],
                    env: { ...process.env },
                });
                // Create readline interface for stdout
                this.rl = readline.createInterface({
                    input: this.process.stdout,
                    crlfDelay: Infinity,
                });
                // Handle stderr
                this.process.stderr?.on('data', (data) => {
                    const message = data.toString().trim();
                    if (message) {
                        console.error(`[MCP Server] stderr: ${message}`);
                    }
                });
                // Handle process exit
                this.process.on('exit', (code, signal) => {
                    this.status = 'disconnected';
                    this.emit('statusChange', this.status);
                    this.emit('exit', code, signal);
                });
                // Handle process errors
                this.process.on('error', (error) => {
                    this.status = 'error';
                    this.emit('statusChange', this.status);
                    this.emit('error', error);
                    reject(error);
                });
                // Read messages from stdout
                this.rl.on('line', (line) => {
                    this.handleMessage(line);
                });
                // Initialize the connection
                this.initialize().then(() => {
                    this.status = 'connected';
                    this.emit('statusChange', this.status);
                    resolve();
                }).catch(reject);
            }
            catch (error) {
                this.status = 'error';
                this.emit('statusChange', this.status);
                reject(error);
            }
        });
    }
    /**
     * Disconnect from morse-cli
     */
    disconnect() {
        if (this.process) {
            this.process.kill();
            this.process = null;
        }
        if (this.rl) {
            this.rl.close();
            this.rl = null;
        }
        this.initialized = false;
        this.status = 'disconnected';
        this.emit('statusChange', this.status);
    }
    /**
     * Initialize the MCP connection
     */
    async initialize() {
        const id = this.nextId();
        const request = {
            id,
            jsonrpc: JSONRPC_VERSION,
            method: 'initialize',
            params: {
                protocolVersion: LATEST_PROTOCOL_VERSION,
                capabilities: {},
                clientInfo: {
                    name: 'morse-vscode',
                    version: '1.0.0',
                },
            },
        };
        const response = await this.sendRequest(request);
        if (response.error) {
            throw new Error(`Initialize error: ${response.error.message}`);
        }
        this.serverCapabilities = response.result?.capabilities || {};
        this.serverInfo = response.result?.serverInfo || null;
        this.initialized = true;
        // Send initialized notification
        this.sendNotification('notifications/initialized', {});
        // Fetch available tools
        await this.refreshTools();
    }
    /**
     * Refresh the list of available tools
     */
    async refreshTools() {
        if (!this.initialized) {
            throw new Error('Server not initialized');
        }
        const id = this.nextId();
        const request = {
            id,
            jsonrpc: JSONRPC_VERSION,
            method: 'tools/list',
            params: {},
        };
        const response = await this.sendRequest(request);
        if (response.error) {
            throw new Error(`List tools error: ${response.error.message}`);
        }
        this.tools = response.result?.tools || [];
    }
    /**
     * Call a tool on the MCP server
     */
    async callTool(name, arguments_ = {}) {
        if (!this.initialized) {
            throw new Error('Server not initialized');
        }
        const id = this.nextId();
        const request = {
            id,
            jsonrpc: JSONRPC_VERSION,
            method: 'tools/call',
            params: {
                name,
                arguments: arguments_,
            },
        };
        const response = await this.sendRequest(request);
        if (response.error) {
            throw new Error(`Tool call error: ${response.error.message}`);
        }
        return response.result;
    }
    /**
     * Send a request and wait for response
     */
    sendRequest(message) {
        return new Promise((resolve, reject) => {
            const id = message.id;
            if (id === undefined) {
                reject(new Error('Message must have an id'));
                return;
            }
            this.pendingRequests.set(id, { resolve, reject });
            this.send(message);
            // Timeout after 30 seconds
            setTimeout(() => {
                if (this.pendingRequests.has(id)) {
                    this.pendingRequests.delete(id);
                    reject(new Error(`Request ${id} timed out`));
                }
            }, 30000);
        });
    }
    /**
     * Send a JSON-RPC message
     */
    send(message) {
        if (!this.process || !this.process.stdin) {
            throw new Error('Process not connected');
        }
        const data = JSON.stringify(message) + '\n';
        this.process.stdin.write(data);
    }
    /**
     * Send a notification (no response expected)
     */
    sendNotification(method, params) {
        const message = {
            jsonrpc: JSONRPC_VERSION,
            method,
            params,
        };
        this.send(message);
    }
    /**
     * Handle incoming JSON-RPC message
     */
    handleMessage(line) {
        try {
            const message = JSON.parse(line);
            // Handle response
            if (message.id !== undefined && message.result !== undefined) {
                const pending = this.pendingRequests.get(message.id);
                if (pending) {
                    this.pendingRequests.delete(message.id);
                    pending.resolve(message);
                }
                return;
            }
            // Handle error response
            if (message.id !== undefined && message.error) {
                const pending = this.pendingRequests.get(message.id);
                if (pending) {
                    this.pendingRequests.delete(message.id);
                    pending.reject(new Error(message.error.message));
                }
                return;
            }
            // Handle notification
            if (message.id === undefined && message.method) {
                this.emit('notification', message.method, message.params);
                return;
            }
        }
        catch (error) {
            console.error('[MCP Server] Failed to parse message:', error);
        }
    }
    /**
     * Generate next message ID
     */
    nextId() {
        return ++this.messageId;
    }
}
exports.MCPServer = MCPServer;
// Extend EventEmitter for MCPServerManager
class MCPServerManager extends events_1.EventEmitter {
    servers = new Map();
    morsePath;
    constructor(morsePath = 'morse') {
        super();
        this.morsePath = morsePath;
    }
    /**
     * Get or create a server by name
     */
    async getServer(name) {
        let server = this.servers.get(name);
        if (!server) {
            server = new MCPServer(this.morsePath);
            this.servers.set(name, server);
            server.on('statusChange', (status) => {
                this.emit('serverStatusChange', name, status);
            });
            server.on('error', (error) => {
                this.emit('serverError', name, error);
            });
        }
        return server;
    }
    /**
     * Connect to a server
     */
    async connect(name) {
        const server = await this.getServer(name);
        await server.connect();
    }
    /**
     * Disconnect from a server
     */
    disconnect(name) {
        const server = this.servers.get(name);
        if (server) {
            server.disconnect();
        }
    }
    /**
     * Remove a server
     */
    removeServer(name) {
        const server = this.servers.get(name);
        if (server) {
            server.disconnect();
            this.servers.delete(name);
        }
    }
    /**
     * List all servers
     */
    listServers() {
        const result = [];
        for (const [name, server] of this.servers) {
            result.push({
                name,
                status: server.getStatus(),
                tools: server.getTools(),
            });
        }
        return result;
    }
    /**
     * Get all tools from all connected servers
     */
    getAllTools() {
        const allTools = [];
        for (const server of this.servers.values()) {
            if (server.getStatus() === 'connected') {
                const tools = server.getTools();
                // Prefix tool names with server name to avoid collisions
                for (const tool of tools) {
                    allTools.push({
                        ...tool,
                        name: `${server}_${tool.name}`,
                    });
                }
            }
        }
        return allTools;
    }
    /**
     * Call a tool on a specific server
     */
    async callTool(serverName, toolName, args) {
        const server = this.servers.get(serverName);
        if (!server) {
            throw new Error(`Server ${serverName} not found`);
        }
        if (server.getStatus() !== 'connected') {
            throw new Error(`Server ${serverName} is not connected`);
        }
        return server.callTool(toolName, args);
    }
}
exports.MCPServerManager = MCPServerManager;
// Extend EventEmitter for MCPServerManager
const events_2 = require("events");
Object.setPrototypeOf(MCPServerManager.prototype, events_2.EventEmitter.prototype);
/**
 * Create a default MCP server manager instance
 */
let defaultManager = null;
function getMCPServerManager(morsePath) {
    if (!defaultManager) {
        defaultManager = new MCPServerManager(morsePath);
    }
    return defaultManager;
}
/**
 * Initialize MCP server with morse-cli tools
 */
async function initializeMCPServer(context) {
    const config = vscode.workspace.getConfiguration('morse');
    const morsePath = config.get('morsePath', 'morse');
    const manager = new MCPServerManager(morsePath);
    // Listen for server status changes
    manager.on('serverStatusChange', (name, status) => {
        console.log(`[MCP] Server ${name} status: ${status}`);
    });
    manager.on('serverError', (name, error) => {
        console.error(`[MCP] Server ${name} error:`, error);
    });
    return manager;
}
//# sourceMappingURL=server.js.map