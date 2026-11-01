"use strict";
/**
 * Server Configuration for Morse VS Code Extension
 * Loads and manages configuration for daemon, serve, and JSON-RPC modes
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
exports.loadDaemonConfig = loadDaemonConfig;
exports.loadServeConfig = loadServeConfig;
exports.loadJSONRPCConfig = loadJSONRPCConfig;
exports.getDaemonSocketPath = getDaemonSocketPath;
exports.getServeUrl = getServeUrl;
exports.getJSONRPCUrl = getJSONRPCUrl;
exports.validateApiKey = validateApiKey;
const vscode = __importStar(require("vscode"));
/**
 * Default configurations
 */
const DEFAULT_DAEMON_CONFIG = {
    watch: true,
    port: 0,
    socketPath: '',
    autoStart: false,
};
const DEFAULT_SERVE_CONFIG = {
    port: 8080,
    host: 'localhost',
    apiKey: '',
    autoStart: false,
    openBrowser: false,
};
const DEFAULT_JSONRPC_CONFIG = {
    port: 8081,
    host: 'localhost',
    apiKey: '',
    autoStart: false,
};
/**
 * Load daemon configuration from VS Code settings
 */
function loadDaemonConfig() {
    const config = vscode.workspace.getConfiguration('morse');
    const serverConfig = config.get('server.daemon') || {};
    return {
        watch: serverConfig.watch ?? DEFAULT_DAEMON_CONFIG.watch,
        port: serverConfig.port ?? DEFAULT_DAEMON_CONFIG.port,
        socketPath: serverConfig.socketPath ?? DEFAULT_DAEMON_CONFIG.socketPath,
        autoStart: serverConfig.autoStart ?? DEFAULT_DAEMON_CONFIG.autoStart,
    };
}
/**
 * Load HTTP serve configuration from VS Code settings
 */
function loadServeConfig() {
    const config = vscode.workspace.getConfiguration('morse');
    const serverConfig = config.get('server.serve') || {};
    return {
        port: serverConfig.port ?? DEFAULT_SERVE_CONFIG.port,
        host: serverConfig.host ?? DEFAULT_SERVE_CONFIG.host,
        apiKey: serverConfig.apiKey ?? DEFAULT_SERVE_CONFIG.apiKey,
        autoStart: serverConfig.autoStart ?? DEFAULT_SERVE_CONFIG.autoStart,
        openBrowser: serverConfig.openBrowser ?? DEFAULT_SERVE_CONFIG.openBrowser,
    };
}
/**
 * Load JSON-RPC configuration from VS Code settings
 */
function loadJSONRPCConfig() {
    const config = vscode.workspace.getConfiguration('morse');
    const serverConfig = config.get('server.jsonrpc') || {};
    return {
        port: serverConfig.port ?? DEFAULT_JSONRPC_CONFIG.port,
        host: serverConfig.host ?? DEFAULT_JSONRPC_CONFIG.host,
        apiKey: serverConfig.apiKey ?? DEFAULT_JSONRPC_CONFIG.apiKey,
        autoStart: serverConfig.autoStart ?? DEFAULT_JSONRPC_CONFIG.autoStart,
    };
}
/**
 * Get socket path for daemon
 */
function getDaemonSocketPath() {
    const config = loadDaemonConfig();
    if (config.socketPath) {
        return config.socketPath;
    }
    // Default socket path in .morse directory
    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (workspacePath) {
        return `${workspacePath}/.morse/daemon.sock`;
    }
    return '';
}
/**
 * Get HTTP server URL
 */
function getServeUrl() {
    const config = loadServeConfig();
    return `http://${config.host}:${config.port}`;
}
/**
 * Get JSON-RPC server URL
 */
function getJSONRPCUrl() {
    const config = loadJSONRPCConfig();
    return `http://${config.host}:${config.port}`;
}
/**
 * Validate API key for server authentication
 */
function validateApiKey(config, providedKey) {
    if (!config.apiKey) {
        return true; // No API key required
    }
    return config.apiKey === providedKey;
}
//# sourceMappingURL=config.js.map