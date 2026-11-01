"use strict";
/**
 * MCP Client Implementation
 * Connect to external MCP servers using stdio, SSE, or HTTP transport
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
exports.MCPClientManager = exports.MCPClient = void 0;
exports.getMCPClientManager = getMCPClientManager;
const cp = __importStar(require("child_process"));
const readline = __importStar(require("readline"));
const events_1 = require("events");
// Protocol constants
const LATEST_PROTOCOL_VERSION = '2024-11-05';
const JSONRPC_VERSION = '2.0';
/**
 * MCP Client for connecting to external MCP servers
 */
class MCPClient extends events_1.EventEmitter {
    config;
    process = null;
    rl = null;
    messageId = 0;
    pendingRequests = new Map();
    initialized = false;
    serverCapabilities = {};
    serverInfo = null;
    tools = [];
    status = 'disconnected';
    clientInfo;
    constructor(config, clientInfo) {
        super();
        this.config = config;
        this.clientInfo = clientInfo || { name: 'morse-vscode', version: '1.0.0' };
    }
    /**
     * Get current connection status
     */
    getStatus() {
        return this.status;
    }
    /**
     * Get server configuration
     */
    getConfig() {
        return this.config;
    }
    /**
     * Get list of available tools
     */
    getTools() {
        return this.tools;
    }
    /**
     * Get server info
     */
    getServerInfo() {
        return this.serverInfo;
    }
    /**
     * Connect to the MCP server
     */
    async connect() {
        if (this.status === 'connected' || this.status === 'connecting') {
            return;
        }
        this.status = 'connecting';
        this.emit('statusChange', this.status);
        try {
            switch (this.config.type) {
                case 'stdio':
                    await this.connectStdio();
                    break;
                case 'sse':
                    await this.connectSSE();
                    break;
                case 'http':
                    await this.connectHTTP();
                    break;
                default:
                    throw new Error(`Unknown server type: ${this.config.type}`);
            }
            this.status = 'connected';
            this.emit('statusChange', this.status);
        }
        catch (error) {
            this.status = 'error';
            this.emit('statusChange', this.status);
            throw error;
        }
    }
    /**
     * Connect via stdio transport
     */
    async connectStdio() {
        if (!this.config.command) {
            throw new Error('Command is required for stdio transport');
        }
        const cmdParts = this.config.command.split(' ');
        const cmd = cmdParts[0];
        const args = [...cmdParts.slice(1), ...(this.config.args || [])];
        // Prepare environment
        const env = { ...process.env, ...this.config.env };
        // Spawn the process
        this.process = cp.spawn(cmd, args, {
            stdio: ['pipe', 'pipe', 'pipe'],
            env,
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
                console.error(`[MCP ${this.config.name}] stderr: ${message}`);
                this.emit('stderr', message);
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
        });
        // Read messages from stdout
        this.rl.on('line', (line) => {
            this.handleMessage(line);
        });
        // Initialize the connection
        await this.initialize();
    }
    /**
     * Connect via SSE transport (placeholder)
     */
    async connectSSE() {
        // SSE transport implementation
        // For now, throw an error as it requires additional setup
        throw new Error('SSE transport not yet implemented');
    }
    /**
     * Connect via HTTP transport (placeholder)
     */
    async connectHTTP() {
        // HTTP transport implementation
        // For now, throw an error as it requires additional setup
        throw new Error('HTTP transport not yet implemented');
    }
    /**
     * Disconnect from the MCP server
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
                clientInfo: this.clientInfo,
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
            throw new Error('Client not initialized');
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
        this.emit('toolsChanged', this.tools);
    }
    /**
     * Call a tool on the MCP server
     */
    async callTool(name, arguments_ = {}) {
        if (!this.initialized) {
            throw new Error('Client not initialized');
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
            console.error(`[MCP ${this.config.name}] Failed to parse message:`, error);
        }
    }
    /**
     * Generate next message ID
     */
    nextId() {
        return ++this.messageId;
    }
    /**
     * Check if client is initialized
     */
    isInitialized() {
        return this.initialized;
    }
}
exports.MCPClient = MCPClient;
/**
 * MCP Client Manager - manages multiple MCP server connections
 */
class MCPClientManager extends events_1.EventEmitter {
    clients = new Map();
    /**
     * Add and connect to an MCP server
     */
    async addServer(config) {
        if (this.clients.has(config.name)) {
            throw new Error(`Server ${config.name} already exists`);
        }
        const client = new MCPClient(config);
        client.on('statusChange', (status) => {
            this.emit('serverStatusChange', config.name, status);
        });
        client.on('toolsChanged', (tools) => {
            this.emit('serverToolsChanged', config.name, tools);
        });
        client.on('error', (error) => {
            this.emit('serverError', config.name, error);
        });
        this.clients.set(config.name, client);
        await client.connect();
        return client;
    }
    /**
     * Remove and disconnect from an MCP server
     */
    removeServer(name) {
        const client = this.clients.get(name);
        if (client) {
            client.disconnect();
            this.clients.delete(name);
        }
    }
    /**
     * Get a client by name
     */
    getClient(name) {
        return this.clients.get(name);
    }
    /**
     * List all clients
     */
    listClients() {
        const result = [];
        for (const [name, client] of this.clients) {
            result.push({
                name,
                status: client.getStatus(),
                tools: client.getTools(),
            });
        }
        return result;
    }
    /**
     * Get all tools from all connected servers
     */
    getAllTools() {
        const allTools = [];
        for (const [serverName, client] of this.clients) {
            if (client.getStatus() === 'connected') {
                for (const tool of client.getTools()) {
                    allTools.push({ serverName, tool });
                }
            }
        }
        return allTools;
    }
    /**
     * Call a tool on a specific server
     */
    async callTool(serverName, toolName, args) {
        const client = this.clients.get(serverName);
        if (!client) {
            throw new Error(`Server ${serverName} not found`);
        }
        if (client.getStatus() !== 'connected') {
            throw new Error(`Server ${serverName} is not connected`);
        }
        return client.callTool(toolName, args);
    }
    /**
     * Connect to a server
     */
    async connect(name) {
        const client = this.clients.get(name);
        if (!client) {
            throw new Error(`Server ${name} not found`);
        }
        await client.connect();
    }
    /**
     * Disconnect from a server
     */
    disconnect(name) {
        const client = this.clients.get(name);
        if (client) {
            client.disconnect();
        }
    }
    /**
     * Disconnect all servers
     */
    disconnectAll() {
        for (const client of this.clients.values()) {
            client.disconnect();
        }
    }
}
exports.MCPClientManager = MCPClientManager;
// Default manager instance
let defaultManager = null;
function getMCPClientManager() {
    if (!defaultManager) {
        defaultManager = new MCPClientManager();
    }
    return defaultManager;
}
//# sourceMappingURL=client.js.map