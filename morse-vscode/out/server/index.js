"use strict";
/**
 * Server Module Index for Morse VS Code Extension
 * Manages daemon, HTTP serve, and JSON-RPC server modes
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
exports.ServerManager = exports.getDaemonSocketPath = exports.getJSONRPCUrl = exports.getServeUrl = exports.loadJSONRPCConfig = exports.loadServeConfig = exports.loadDaemonConfig = void 0;
exports.registerServerCommands = registerServerCommands;
exports.initializeServerSystem = initializeServerSystem;
const vscode = __importStar(require("vscode"));
const events_1 = require("events");
const daemon_1 = require("./daemon");
const serve_1 = require("./serve");
const jsonrpc_1 = require("./jsonrpc");
var config_1 = require("./config");
Object.defineProperty(exports, "loadDaemonConfig", { enumerable: true, get: function () { return config_1.loadDaemonConfig; } });
Object.defineProperty(exports, "loadServeConfig", { enumerable: true, get: function () { return config_1.loadServeConfig; } });
Object.defineProperty(exports, "loadJSONRPCConfig", { enumerable: true, get: function () { return config_1.loadJSONRPCConfig; } });
Object.defineProperty(exports, "getServeUrl", { enumerable: true, get: function () { return config_1.getServeUrl; } });
Object.defineProperty(exports, "getJSONRPCUrl", { enumerable: true, get: function () { return config_1.getJSONRPCUrl; } });
Object.defineProperty(exports, "getDaemonSocketPath", { enumerable: true, get: function () { return config_1.getDaemonSocketPath; } });
/**
 * Server Manager - orchestrates all server types
 */
class ServerManager extends events_1.EventEmitter {
    daemon;
    serve;
    jsonrpc;
    client;
    statusBarItem = null;
    constructor(client) {
        super();
        this.client = client;
        this.daemon = new daemon_1.DaemonServer();
        this.serve = new serve_1.ServeServer(client);
        this.jsonrpc = new jsonrpc_1.JSONRPCServer();
        // Listen to status changes
        this.daemon.on('statusChange', (event) => {
            this.emit('statusChange', event);
            this.updateStatusBar();
        });
        this.serve.on('statusChange', (event) => {
            this.emit('statusChange', event);
            this.updateStatusBar();
        });
        this.jsonrpc.on('statusChange', (event) => {
            this.emit('statusChange', event);
            this.updateStatusBar();
        });
        this.createStatusBarItem();
    }
    /**
     * Create status bar item for server status
     */
    createStatusBarItem() {
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 95);
        this.statusBarItem.command = 'morse.server.status';
        this.statusBarItem.text = '$(server) Server';
        this.statusBarItem.tooltip = 'Morse Server: Click for status';
        this.statusBarItem.show();
    }
    /**
     * Update status bar based on server states
     */
    async updateStatusBar() {
        if (!this.statusBarItem)
            return;
        const daemonStatus = await this.daemon.getStatus();
        const serveStatus = await this.serve.getStatus();
        const jsonrpcStatus = await this.jsonrpc.getStatus();
        // Check if any server is running
        const anyRunning = daemonStatus.status === 'running' ||
            serveStatus.status === 'running' ||
            jsonrpcStatus.status === 'running';
        if (anyRunning) {
            const ports = [];
            if (serveStatus.status === 'running' && serveStatus.port) {
                ports.push(`HTTP:${serveStatus.port}`);
            }
            if (jsonrpcStatus.status === 'running' && jsonrpcStatus.port) {
                ports.push(`RPC:${jsonrpcStatus.port}`);
            }
            if (daemonStatus.status === 'running' && daemonStatus.socketPath) {
                ports.push(`Socket`);
            }
            this.statusBarItem.text = ports.length > 0
                ? `$(server) ${ports.join(' ')}`
                : '$(server) Running';
            this.statusBarItem.tooltip = `Morse Server: Running\n${ports.join('\n')}`;
        }
        else {
            this.statusBarItem.text = '$(server) Server';
            this.statusBarItem.tooltip = 'Morse Server: Click for status';
        }
    }
    // ==================== Daemon Operations ====================
    /**
     * Start daemon server
     */
    async startDaemon() {
        return this.daemon.start();
    }
    /**
     * Stop daemon server
     */
    async stopDaemon() {
        return this.daemon.stop();
    }
    /**
     * Get daemon status
     */
    async getDaemonStatus() {
        return this.daemon.getStatus();
    }
    /**
     * Restart daemon server
     */
    async restartDaemon() {
        return this.daemon.restart();
    }
    // ==================== Serve Operations ====================
    /**
     * Start HTTP server
     */
    async startServe() {
        return this.serve.start();
    }
    /**
     * Stop HTTP server
     */
    async stopServe() {
        return this.serve.stop();
    }
    /**
     * Get HTTP server status
     */
    async getServeStatus() {
        return this.serve.getStatus();
    }
    /**
     * Restart HTTP server
     */
    async restartServe() {
        return this.serve.restart();
    }
    /**
     * Open server URL in browser
     */
    openServeBrowser() {
        this.serve.openBrowser();
    }
    // ==================== JSON-RPC Operations ====================
    /**
     * Start JSON-RPC server
     */
    async startJSONRPC() {
        return this.jsonrpc.start();
    }
    /**
     * Stop JSON-RPC server
     */
    async stopJSONRPC() {
        return this.jsonrpc.stop();
    }
    /**
     * Get JSON-RPC server status
     */
    async getJSONRPCStatus() {
        return this.jsonrpc.getStatus();
    }
    /**
     * Restart JSON-RPC server
     */
    async restartJSONRPC() {
        return this.jsonrpc.restart();
    }
    // ==================== Combined Operations ====================
    /**
     * Get status of all servers
     */
    async getAllStatus() {
        const [daemon, serve, jsonrpc] = await Promise.all([
            this.daemon.getStatus(),
            this.serve.getStatus(),
            this.jsonrpc.getStatus(),
        ]);
        return {
            daemon,
            serve,
            jsonrpc,
        };
    }
    /**
     * Start all servers
     */
    async startAll() {
        await Promise.all([
            this.daemon.start().catch(err => console.error('Daemon start error:', err)),
            this.serve.start().catch(err => console.error('Serve start error:', err)),
            this.jsonrpc.start().catch(err => console.error('JSONRPC start error:', err)),
        ]);
    }
    /**
     * Stop all servers
     */
    async stopAll() {
        await Promise.all([
            this.daemon.stop().catch(err => console.error('Daemon stop error:', err)),
            this.serve.stop().catch(err => console.error('Serve stop error:', err)),
            this.jsonrpc.stop().catch(err => console.error('JSONRPC stop error:', err)),
        ]);
    }
    /**
     * Reload configuration
     */
    reloadConfig() {
        // Reinitialize config by creating new server instances
        // The config is loaded at instantiation time
    }
    /**
     * Dispose all resources
     */
    dispose() {
        this.stopAll();
        this.statusBarItem?.dispose();
        this.daemon.dispose();
        this.serve.dispose();
        this.jsonrpc.dispose();
        this.removeAllListeners();
    }
}
exports.ServerManager = ServerManager;
/**
 * Create and register server commands
 */
function registerServerCommands(context, manager) {
    // Daemon commands
    context.subscriptions.push(vscode.commands.registerCommand('morse.daemon.start', async () => {
        try {
            const info = await manager.startDaemon();
            vscode.window.showInformationMessage(`Daemon started: ${info.socketPath}`);
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to start daemon: ${error}`);
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('morse.daemon.stop', async () => {
        try {
            await manager.stopDaemon();
            vscode.window.showInformationMessage('Daemon stopped');
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to stop daemon: ${error}`);
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('morse.daemon.status', async () => {
        const status = await manager.getDaemonStatus();
        vscode.window.showInformationMessage(`Daemon Status: ${status.status}${status.socketPath ? ` (${status.socketPath})` : ''}`);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('morse.daemon.restart', async () => {
        try {
            const info = await manager.restartDaemon();
            vscode.window.showInformationMessage(`Daemon restarted: ${info.socketPath}`);
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to restart daemon: ${error}`);
        }
    }));
    // Serve commands
    context.subscriptions.push(vscode.commands.registerCommand('morse.serve.start', async () => {
        try {
            const info = await manager.startServe();
            vscode.window.showInformationMessage(`HTTP Server started on port ${info.port}`);
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to start server: ${error}`);
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('morse.serve.stop', async () => {
        try {
            await manager.stopServe();
            vscode.window.showInformationMessage('HTTP Server stopped');
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to stop server: ${error}`);
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('morse.serve.status', async () => {
        const status = await manager.getServeStatus();
        vscode.window.showInformationMessage(`Server Status: ${status.status}${status.port ? ` (port ${status.port})` : ''}`);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('morse.serve.open', () => {
        manager.openServeBrowser();
    }));
    context.subscriptions.push(vscode.commands.registerCommand('morse.serve.restart', async () => {
        try {
            const info = await manager.restartServe();
            vscode.window.showInformationMessage(`Server restarted on port ${info.port}`);
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to restart server: ${error}`);
        }
    }));
    // JSON-RPC commands
    context.subscriptions.push(vscode.commands.registerCommand('morse.jsonrpc.start', async () => {
        try {
            const info = await manager.startJSONRPC();
            vscode.window.showInformationMessage(`JSON-RPC Server started on port ${info.port}`);
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to start JSON-RPC server: ${error}`);
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('morse.jsonrpc.stop', async () => {
        try {
            await manager.stopJSONRPC();
            vscode.window.showInformationMessage('JSON-RPC Server stopped');
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to stop JSON-RPC server: ${error}`);
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('morse.jsonrpc.status', async () => {
        const status = await manager.getJSONRPCStatus();
        vscode.window.showInformationMessage(`JSON-RPC Status: ${status.status}${status.port ? ` (port ${status.port})` : ''}`);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('morse.jsonrpc.restart', async () => {
        try {
            const info = await manager.restartJSONRPC();
            vscode.window.showInformationMessage(`JSON-RPC Server restarted on port ${info.port}`);
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to restart JSON-RPC server: ${error}`);
        }
    }));
    // Combined server commands
    context.subscriptions.push(vscode.commands.registerCommand('morse.server.status', async () => {
        const status = await manager.getAllStatus();
        const lines = [
            `Daemon: ${status.daemon.status}`,
            `HTTP Serve: ${status.serve.status}${status.serve.port ? ` (${status.serve.port})` : ''}`,
            `JSON-RPC: ${status.jsonrpc.status}${status.jsonrpc.port ? ` (${status.jsonrpc.port})` : ''}`,
        ];
        vscode.window.showInformationMessage(lines.join('\n'));
    }));
    context.subscriptions.push(vscode.commands.registerCommand('morse.server.startAll', async () => {
        try {
            await manager.startAll();
            vscode.window.showInformationMessage('All servers started');
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to start servers: ${error}`);
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('morse.server.stopAll', async () => {
        try {
            await manager.stopAll();
            vscode.window.showInformationMessage('All servers stopped');
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to stop servers: ${error}`);
        }
    }));
}
/**
 * Initialize server system
 */
function initializeServerSystem(context, client) {
    const manager = new ServerManager(client);
    registerServerCommands(context, manager);
    context.subscriptions.push(manager);
    return manager;
}
//# sourceMappingURL=index.js.map