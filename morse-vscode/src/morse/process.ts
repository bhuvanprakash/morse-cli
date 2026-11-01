/**
 * CLI process management for Morse JSON-RPC server
 */

import { spawn, ChildProcess } from 'child_process';
import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';

export interface ProcessOptions {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    timeout?: number;
}

export class MorseProcessManager {
    private process: ChildProcess | undefined;
    private readonly outputChannel: vscode.OutputChannel;
    private isReady = false;
    private readyCallbacks: Array<() => void> = [];
    private buffer = '';
    private messageCallback: ((message: unknown) => void) | undefined;

    constructor() {
        this.outputChannel = vscode.window.createOutputChannel('Morse CLI');
    }

    /**
     * Start the Morse CLI JSON-RPC server
     */
    async start(options: ProcessOptions = {}): Promise<void> {
        if (this.process && !this.process.killed) {
            return; // Already running
        }

        const morsePath = await this.findMorseCli();
        if (!morsePath) {
            throw new Error(
                'Morse CLI not found. Please install it: npm install -g @morse/cli'
            );
        }

        const args = ['lsp'];
        const cwd = options.cwd || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();

        this.outputChannel.appendLine(`Starting Morse CLI: ${morsePath} ${args.join(' ')}`);
        this.outputChannel.appendLine(`Working directory: ${cwd}`);

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Timeout waiting for Morse CLI to start'));
            }, options.timeout || 30000);

            this.process = spawn(morsePath, args, {
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
            this.process.stdout.on('data', (data: Buffer) => {
                this.handleStdout(data);
            });

            // Handle stderr (logs)
            this.process.stderr.on('data', (data: Buffer) => {
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
    stop(): void {
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
    sendMessage(message: unknown): void {
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
    onMessage(callback: (message: unknown) => void): void {
        this.messageCallback = callback;
    }

    /**
     * Check if the process is running and ready
     */
    isRunning(): boolean {
        return this.process !== undefined && !this.process.killed && this.isReady;
    }

    /**
     * Find the Morse CLI executable
     */
    private async findMorseCli(): Promise<string | undefined> {
        // Check config for custom path
        const config = vscode.workspace.getConfiguration('morse');
        const customPath = config.get<string>('cliPath');
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
            candidates.push(
                path.join(os.homedir(), 'AppData', 'Roaming', 'npm', 'morse.cmd'),
                path.join('C:', 'Program Files', 'nodejs', 'morse.cmd'),
                'morse.cmd'
            );
        }

        for (const candidate of candidates) {
            try {
                const result = await this.checkCommand(candidate);
                if (result) {
                    return candidate;
                }
            } catch {
                // Continue to next candidate
            }
        }

        return undefined;
    }

    private checkCommand(cmd: string): Promise<boolean> {
        return new Promise((resolve) => {
            const check = spawn(cmd, ['--version'], { shell: true });
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

    private handleStdout(data: Buffer): void {
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
            } catch (err) {
                this.outputChannel.appendLine(`[error] Failed to parse message: ${err}`);
            }
        }
    }

    private setReady(): void {
        if (!this.isReady) {
            this.isReady = true;
            this.readyCallbacks.forEach(cb => cb());
            this.readyCallbacks = [];
        }
    }

    private onReady(callback: () => void): void {
        if (this.isReady) {
            callback();
        } else {
            this.readyCallbacks.push(callback);
        }
    }

    /**
     * Get the output channel for logging
     */
    getOutputChannel(): vscode.OutputChannel {
        return this.outputChannel;
    }
}
