"use strict";
/**
 * CLI process management for Morse JSON-RPC server
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
exports.MorseProcessManager = void 0;
const child_process_1 = require("child_process");
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
class MorseProcessManager {
    process;
    outputChannel;
    isReady = false;
    readyCallbacks = [];
    buffer = '';
    messageCallback;
    constructor() {
        this.outputChannel = vscode.window.createOutputChannel('Morse CLI');
    }
    /**
     * Start the Morse CLI JSON-RPC server
     */
    async start(options = {}) {
        if (this.process && !this.process.killed) {
            return; // Already running
        }
        const morsePath = await this.findMorseCli();
        if (!morsePath) {
            throw new Error('Morse CLI not found. Please install it: npm install -g @morse/cli');
        }
        const args = ['lsp'];
        const cwd = options.cwd || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();
        this.outputChannel.appendLine(`Starting Morse CLI: ${morsePath} ${args.join(' ')}`);
        this.outputChannel.appendLine(`Working directory: ${cwd}`);
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Timeout waiting for Morse CLI to start'));
            }, options.timeout || 30000);
            this.process = (0, child_process_1.spawn)(morsePath, args, {
                cwd,
                env: { ...process.env, ...options.env },
                stdio: ['pipe', 'pipe', 'pipe'],
            });
            if (!this.process.stdin || !this.process.stdout || !this.process.stderr) {
                clearTimeout(timeout);
                reject(new Error('Failed to create process pipes'));
                return;
            }
            // Handle stdout (JSON-RPC messages)
            this.process.stdout.on('data', (data) => {
                this.handleStdout(data);
            });
            // Handle stderr (logs)
            this.process.stderr.on('data', (data) => {
                const message = data.toString().trim();
                this.outputChannel.appendLine(`[stderr] ${message}`);
                // Check for ready signal
                if (message.includes('Morse LSP server ready') || message.includes('Listening on stdio')) {
                    this.setReady();
                    clearTimeout(timeout);
                    resolve();
                }
            });
            // Handle process exit
            this.process.on('exit', (code) => {
                this.outputChannel.appendLine(`Morse CLI exited with code ${code}`);
                this.isReady = false;
                this.process = undefined;
            });
            this.process.on('error', (err) => {
                this.outputChannel.appendLine(`Morse CLI error: ${err.message}`);
                clearTimeout(timeout);
                reject(err);
            });
            // Wait for ready signal
            this.onReady(() => {
                clearTimeout(timeout);
                resolve();
            });
        });
    }
    /**
     * Stop the Morse CLI process
     */
    stop() {
        if (this.process && !this.process.killed) {
            this.outputChannel.appendLine('Stopping Morse CLI...');
            // Send shutdown request
            this.sendMessage({
                jsonrpc: '2.0',
                id: 'shutdown',
                method: 'shutdown',
            });
            // Give it a moment to clean up
            setTimeout(() => {
                this.process?.kill('SIGTERM');
                // Force kill after 5 seconds
                setTimeout(() => {
                    if (this.process && !this.process.killed) {
                        this.process.kill('SIGKILL');
                    }
                }, 5000);
            }, 1000);
        }
    }
    /**
     * Send a JSON-RPC message to the CLI
     */
    sendMessage(message) {
        if (!this.process?.stdin || this.process.killed) {
            throw new Error('Morse CLI not running');
        }
        const json = JSON.stringify(message);
        const data = `Content-Length: ${Buffer.byteLength(json)}\r\n\r\n${json}`;
        this.outputChannel.appendLine(`[send] ${json.substring(0, 200)}...`);
        this.process.stdin.write(data);
    }
    /**
     * Register callback for messages from CLI
     */
    onMessage(callback) {
        this.messageCallback = callback;
    }
    /**
     * Check if the process is running and ready
     */
    isRunning() {
        return this.process !== undefined && !this.process.killed && this.isReady;
    }
    /**
     * Find the Morse CLI executable
     */
    async findMorseCli() {
        // Check config for custom path
        const config = vscode.workspace.getConfiguration('morse');
        const customPath = config.get('cliPath');
        if (customPath) {
            return customPath;
        }
        // Try common locations
        const candidates = [
            'morse',
            'morse-cli',
            path.join(os.homedir(), '.npm', 'global', 'bin', 'morse'),
            path.join(os.homedir(), '.local', 'bin', 'morse'),
            '/usr/local/bin/morse',
            '/usr/bin/morse',
        ];
        if (os.platform() === 'win32') {
            candidates.push(path.join(os.homedir(), 'AppData', 'Roaming', 'npm', 'morse.cmd'), path.join('C:', 'Program Files', 'nodejs', 'morse.cmd'), 'morse.cmd');
        }
        for (const candidate of candidates) {
            try {
                const result = await this.checkCommand(candidate);
                if (result) {
                    return candidate;
                }
            }
            catch {
                // Continue to next candidate
            }
        }
        return undefined;
    }
    checkCommand(cmd) {
        return new Promise((resolve) => {
            const check = (0, child_process_1.spawn)(cmd, ['--version'], { shell: true });
            let output = '';
            check.stdout.on('data', (data) => {
                output += data.toString();
            });
            check.on('close', (code) => {
                resolve(code === 0 && output.includes('morse'));
            });
            check.on('error', () => {
                resolve(false);
            });
            // Timeout after 2 seconds
            setTimeout(() => {
                check.kill();
                resolve(false);
            }, 2000);
        });
    }
    handleStdout(data) {
        this.buffer += data.toString();
        // Parse LSP-style messages (Content-Length header)
        while (this.buffer.length > 0) {
            const headerMatch = this.buffer.match(/Content-Length: (\d+)\r\n\r\n/);
            if (!headerMatch) {
                break;
            }
            const contentLength = parseInt(headerMatch[1], 10);
            const headerLength = headerMatch[0].length;
            const totalLength = headerLength + contentLength;
            if (this.buffer.length < totalLength) {
                break; // Wait for more data
            }
            const messageJson = this.buffer.substring(headerLength, totalLength);
            this.buffer = this.buffer.substring(totalLength);
            try {
                const message = JSON.parse(messageJson);
                this.outputChannel.appendLine(`[recv] ${messageJson.substring(0, 200)}...`);
                this.messageCallback?.(message);
            }
            catch (err) {
                this.outputChannel.appendLine(`[error] Failed to parse message: ${err}`);
            }
        }
    }
    setReady() {
        if (!this.isReady) {
            this.isReady = true;
            this.readyCallbacks.forEach(cb => cb());
            this.readyCallbacks = [];
        }
    }
    onReady(callback) {
        if (this.isReady) {
            callback();
        }
        else {
            this.readyCallbacks.push(callback);
        }
    }
    /**
     * Get the output channel for logging
     */
    getOutputChannel() {
        return this.outputChannel;
    }
}
exports.MorseProcessManager = MorseProcessManager;
//# sourceMappingURL=process.js.map