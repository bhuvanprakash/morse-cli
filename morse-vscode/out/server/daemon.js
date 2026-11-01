"use strict";
/**
 * Daemon Server Implementation for Morse VS Code Extension
 * Manages background file indexing daemon
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
exports.DaemonServer = void 0;
const vscode = __importStar(require("vscode"));
const child_process = __importStar(require("child_process"));
const events_1 = require("events");
const config_1 = require("./config");
class DaemonServer extends events_1.EventEmitter {
    config;
    process = null;
    status = 'stopped';
    socketPath = '';
    pid = null;
    checkInterval = null;
    constructor() {
        super();
        this.config = (0, config_1.loadDaemonConfig)();
    }
    /**
     * Get current daemon status
     */
    async getStatus() {
        const info = {
            type: 'daemon',
            status: this.status,
            socketPath: this.socketPath,
            pid: this.pid ?? undefined,
        };
        if (this.status === 'running') {
            try {
                // Try to check if socket exists and is accessible
                const socketExists = await this.checkSocket();
                if (!socketExists) {
                    this.status = 'error';
                    info.status = 'error';
                    info.error = 'Socket not accessible';
                }
            }
            catch {
                info.error = 'Failed to check daemon status';
            }
        }
        return info;
    }
    /**
     * Check if daemon socket exists and is accessible
     */
    async checkSocket() {
        if (!this.socketPath) {
            return false;
        }
        try {
            const fs = await Promise.resolve().then(() => __importStar(require('fs')));
            return fs.existsSync(this.socketPath);
        }
        catch {
            return false;
        }
    }
    /**
     * Start the daemon
     */
    async start() {
        if (this.status === 'running') {
            return this.getStatus();
        }
        this.status = 'starting';
        this.emit('statusChange', { type: 'daemon', status: 'starting' });
        try {
            // Get workspace path
            const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (!workspacePath) {
                throw new Error('No workspace folder open');
            }
            // Set socket path
            this.socketPath = this.config.socketPath || (0, config_1.getDaemonSocketPath)();
            // Find morse CLI path
            const morsePath = await this.findMorsePath();
            if (!morsePath) {
                throw new Error('Morse CLI not found. Please ensure morse is installed.');
            }
            // Build arguments
            const args = ['daemon'];
            if (this.config.watch) {
                args.push('--watch');
            }
            if (this.config.port > 0) {
                args.push('--port', this.config.port.toString());
            }
            // Start daemon process
            this.process = child_process.spawn(morsePath, args, {
                cwd: workspacePath,
                detached: true,
                stdio: ['ignore', 'pipe', 'pipe'],
                env: {
                    ...process.env,
                    MORSE_DAEMON_SOCKET: this.socketPath,
                },
            });
            this.pid = this.process.pid ?? null;
            // Handle process output
            this.process.stdout?.on('data', (data) => {
                console.log(`[Morse Daemon] ${data.toString().trim()}`);
            });
            this.process.stderr?.on('data', (data) => {
                console.error(`[Morse Daemon Error] ${data.toString().trim()}`);
            });
            this.process.on('exit', (code) => {
                this.status = 'stopped';
                this.emit('statusChange', { type: 'daemon', status: 'stopped' });
                this.pid = null;
                this.process = null;
            });
            this.process.on('error', (err) => {
                this.status = 'error';
                this.emit('statusChange', {
                    type: 'daemon',
                    status: 'error',
                    info: { type: 'daemon', status: 'error', error: err.message }
                });
            });
            // Wait for daemon to start
            await this.waitForStart();
            this.status = 'running';
            this.emit('statusChange', { type: 'daemon', status: 'running' });
            return this.getStatus();
        }
        catch (error) {
            this.status = 'error';
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.emit('statusChange', {
                type: 'daemon',
                status: 'error',
                info: { type: 'daemon', status: 'error', error: errorMessage }
            });
            throw new Error(`Failed to start daemon: ${errorMessage}`);
        }
    }
    /**
     * Wait for daemon to start
     */
    async waitForStart(timeoutMs = 5000) {
        const startTime = Date.now();
        while (Date.now() - startTime < timeoutMs) {
            const socketExists = await this.checkSocket();
            if (socketExists) {
                return;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        // Give a bit more time
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    /**
     * Stop the daemon
     */
    async stop() {
        if (this.status !== 'running' && this.status !== 'starting') {
            return;
        }
        this.status = 'stopping';
        this.emit('statusChange', { type: 'daemon', status: 'stopping' });
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
            this.emit('statusChange', { type: 'daemon', status: 'stopped' });
        }
        catch (error) {
            this.status = 'error';
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`Failed to stop daemon: ${errorMessage}`);
        }
        finally {
            this.process = null;
            this.pid = null;
        }
    }
    /**
     * Restart the daemon
     */
    async restart() {
        await this.stop();
        // Wait a bit before restarting
        await new Promise(resolve => setTimeout(resolve, 500));
        return this.start();
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
     * Dispose resources
     */
    dispose() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
        this.stop();
        this.removeAllListeners();
    }
}
exports.DaemonServer = DaemonServer;
//# sourceMappingURL=daemon.js.map