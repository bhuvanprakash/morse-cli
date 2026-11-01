"use strict";
/**
 * HTTP Server Implementation for Morse VS Code Extension
 * Manages HTTP API server for IDE integration
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
exports.ServeServer = void 0;
const vscode = __importStar(require("vscode"));
const child_process = __importStar(require("child_process"));
const events_1 = require("events");
const http = __importStar(require("http"));
const config_1 = require("./config");
class ServeServer extends events_1.EventEmitter {
    config;
    process = null;
    status = 'stopped';
    port = 0;
    pid = null;
    server = null;
    client;
    constructor(client) {
        super();
        this.config = (0, config_1.loadServeConfig)();
        this.client = client;
    }
    /**
     * Reload configuration
     */
    reloadConfig() {
        this.config = (0, config_1.loadServeConfig)();
    }
    /**
     * Get current server status
     */
    async getStatus() {
        const info = {
            type: 'serve',
            status: this.status,
            port: this.port,
            pid: this.pid ?? undefined,
        };
        if (this.status === 'running') {
            try {
                // Try to ping the server
                const reachable = await this.checkServerReachable();
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
     * Check if server is reachable
     */
    async checkServerReachable() {
        return new Promise((resolve) => {
            const req = http.get(`http://${this.config.host}:${this.port}/health`, (res) => {
                resolve(res.statusCode === 200);
            });
            req.on('error', () => resolve(false));
            req.setTimeout(1000, () => {
                req.destroy();
                resolve(false);
            });
        });
    }
    /**
     * Start the HTTP server
     */
    async start() {
        if (this.status === 'running') {
            return this.getStatus();
        }
        this.status = 'starting';
        this.emit('statusChange', { type: 'serve', status: 'starting' });
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
            // Build arguments
            const args = ['serve'];
            args.push('--port', this.port.toString());
            if (this.config.host !== 'localhost') {
                args.push('--host', this.config.host);
            }
            // Start serve process
            this.process = child_process.spawn(morsePath, args, {
                cwd: workspacePath,
                detached: true,
                stdio: ['ignore', 'pipe', 'pipe'],
            });
            this.pid = this.process.pid ?? null;
            // Handle process output
            this.process.stdout?.on('data', (data) => {
                console.log(`[Morse Serve] ${data.toString().trim()}`);
            });
            this.process.stderr?.on('data', (data) => {
                console.error(`[Morse Serve Error] ${data.toString().trim()}`);
            });
            this.process.on('exit', (code) => {
                this.status = 'stopped';
                this.emit('statusChange', { type: 'serve', status: 'stopped' });
                this.pid = null;
                this.process = null;
            });
            this.process.on('error', (err) => {
                this.status = 'error';
                this.emit('statusChange', {
                    type: 'serve',
                    status: 'error',
                    info: { type: 'serve', status: 'error', error: err.message }
                });
            });
            // Wait for server to start
            await this.waitForStart();
            this.status = 'running';
            this.emit('statusChange', { type: 'serve', status: 'running' });
            // Open browser if configured
            if (this.config.openBrowser) {
                this.openBrowser();
            }
            return this.getStatus();
        }
        catch (error) {
            this.status = 'error';
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.emit('statusChange', {
                type: 'serve',
                status: 'error',
                info: { type: 'serve', status: 'error', error: errorMessage }
            });
            throw new Error(`Failed to start server: ${errorMessage}`);
        }
    }
    /**
     * Wait for server to start
     */
    async waitForStart(timeoutMs = 10000) {
        const startTime = Date.now();
        while (Date.now() - startTime < timeoutMs) {
            const reachable = await this.checkServerReachable();
            if (reachable) {
                return;
            }
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        throw new Error('Server failed to start within timeout');
    }
    /**
     * Stop the server
     */
    async stop() {
        if (this.status !== 'running' && this.status !== 'starting') {
            return;
        }
        this.status = 'stopping';
        this.emit('statusChange', { type: 'serve', status: 'stopping' });
        try {
            if (this.process) {
                // Try graceful shutdown first
                this.process.kill('SIGTERM');
                // Wait for process to exit
                await new Promise((resolve) => {
                    const timeout = setTimeout(() => {
                        // Force kill if still running
                        if (this.process) {
                            this.process.kill('SIGKILL');
                        }
                        resolve();
                    }, 3000);
                    this.process?.on('exit', () => {
                        clearTimeout(timeout);
                        resolve();
                    });
                });
            }
            this.status = 'stopped';
            this.emit('statusChange', { type: 'serve', status: 'stopped' });
        }
        catch (error) {
            this.status = 'error';
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`Failed to stop server: ${errorMessage}`);
        }
        finally {
            this.process = null;
            this.pid = null;
        }
    }
    /**
     * Restart the server
     */
    async restart() {
        await this.stop();
        // Wait a bit before restarting
        await new Promise(resolve => setTimeout(resolve, 500));
        return this.start();
    }
    /**
     * Open server URL in browser
     */
    openBrowser() {
        const url = (0, config_1.getServeUrl)();
        vscode.env.openExternal(vscode.Uri.parse(url));
    }
    /**
     * Find morse CLI path
     */
    async findMorsePath() {
        // Check if morse is available in PATH
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
        // Try different possible locations
        const possiblePaths = [
            'which morse',
            'npm list -g morse-cli',
        ];
        for (const cmd of possiblePaths) {
            const result = await checkPath(cmd);
            if (result) {
                return result;
            }
        }
        // Fallback: assume morse is in PATH
        return 'morse';
    }
    /**
     * Make API request to the server
     */
    async chat(request) {
        const url = `${(0, config_1.getServeUrl)()}/api/v1/chat`;
        return new Promise((resolve, reject) => {
            const data = JSON.stringify(request);
            const req = http.request(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': this.config.apiKey ? `Bearer ${this.config.apiKey}` : '',
                },
            }, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(body));
                    }
                    catch {
                        resolve(body);
                    }
                });
            });
            req.on('error', reject);
            req.write(data);
            req.end();
        });
    }
    /**
     * Get sessions from server
     */
    async getSessions() {
        const url = `${(0, config_1.getServeUrl)()}/api/v1/sessions`;
        return new Promise((resolve, reject) => {
            const req = http.request(url, {
                method: 'GET',
                headers: {
                    'Authorization': this.config.apiKey ? `Bearer ${this.config.apiKey}` : '',
                },
            }, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(body));
                    }
                    catch {
                        resolve([]);
                    }
                });
            });
            req.on('error', reject);
            req.end();
        });
    }
    /**
     * Get providers from server
     */
    async getProviders() {
        const url = `${(0, config_1.getServeUrl)()}/api/v1/providers`;
        return new Promise((resolve, reject) => {
            const req = http.request(url, {
                method: 'GET',
                headers: {
                    'Authorization': this.config.apiKey ? `Bearer ${this.config.apiKey}` : '',
                },
            }, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(body));
                    }
                    catch {
                        resolve([]);
                    }
                });
            });
            req.on('error', reject);
            req.end();
        });
    }
    /**
     * Dispose resources
     */
    dispose() {
        this.stop();
        this.removeAllListeners();
    }
}
exports.ServeServer = ServeServer;
//# sourceMappingURL=serve.js.map