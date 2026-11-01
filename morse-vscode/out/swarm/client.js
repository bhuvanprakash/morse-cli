"use strict";
/**
 * Swarm Client for Morse VS Code Extension
 * Provides multi-agent swarm functionality by interfacing with morse-cli swarm commands
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
exports.SwarmClient = void 0;
exports.getSwarmClient = getSwarmClient;
exports.createSwarmClient = createSwarmClient;
const vscode = __importStar(require("vscode"));
const child_process_1 = require("child_process");
/**
 * SwarmClient manages multi-agent swarm operations
 */
class SwarmClient {
    outputChannel;
    currentProcess = null;
    currentSession = null;
    statusUpdateCallback = null;
    resultCallback = null;
    pollingInterval = null;
    statusCache = {
        active: false,
        agents: 0,
        runningAgents: 0,
        completedAgents: 0,
        failedAgents: 0,
        tasks: 0,
        completed: 0,
        failed: 0,
    };
    constructor() {
        this.outputChannel = vscode.window.createOutputChannel('Morse Swarm');
    }
    // ==================== Configuration ====================
    /**
     * Get the morse CLI path from configuration
     */
    getMorsePath() {
        const config = vscode.workspace.getConfiguration('morse');
        return config.get('cliPath', 'morse');
    }
    /**
     * Set status update callback for real-time updates
     */
    onStatusUpdate(callback) {
        this.statusUpdateCallback = callback;
    }
    /**
     * Set result callback for agent results
     */
    onResult(callback) {
        this.resultCallback = callback;
    }
    // ==================== Core Operations ====================
    /**
     * Create and start a new swarm session
     */
    async create(task, agents = 3, config) {
        this.outputChannel.show();
        this.outputChannel.appendLine(`[Swarm] Starting swarm with ${agents} agents...`);
        this.outputChannel.appendLine(`[Swarm] Task: ${task}`);
        const fullConfig = {
            maxWorkers: agents,
            maxSteps: config?.maxSteps || 30,
            maxBudget: config?.maxBudget,
            autoApprove: config?.autoApprove || false,
            model: config?.model,
            maxSubtasks: config?.maxSubtasks || 10,
            dryRun: config?.dryRun || false,
        };
        // Create session
        const session = {
            id: `swarm-${Date.now()}`,
            task,
            agents,
            status: 'pending',
            createdAt: new Date().toISOString(),
        };
        this.currentSession = session;
        this.statusCache = {
            active: true,
            sessionId: session.id,
            task,
            agents,
            runningAgents: 0,
            completedAgents: 0,
            failedAgents: 0,
            tasks: 0,
            completed: 0,
            failed: 0,
        };
        // Build command arguments
        const args = ['swarm', task, '--max-workers', String(agents)];
        if (fullConfig.maxSteps) {
            args.push('--max-steps', String(fullConfig.maxSteps));
        }
        if (fullConfig.maxBudget) {
            args.push('--max-budget', String(fullConfig.maxBudget));
        }
        if (fullConfig.autoApprove) {
            args.push('--auto');
        }
        if (fullConfig.model) {
            args.push('--model', fullConfig.model);
        }
        if (fullConfig.maxSubtasks) {
            args.push('--max-subtasks', String(fullConfig.maxSubtasks));
        }
        if (fullConfig.dryRun) {
            args.push('--dry-run');
        }
        // Execute swarm command
        try {
            await this.executeSwarmCommand(args, session);
        }
        catch (error) {
            this.outputChannel.appendLine(`[Swarm] Error: ${error}`);
            if (this.currentSession) {
                this.currentSession.status = 'failed';
            }
            this.statusCache.active = false;
            throw error;
        }
        return session;
    }
    /**
     * Execute the swarm CLI command
     */
    executeSwarmCommand(args, session) {
        return new Promise((resolve, reject) => {
            const morsePath = this.getMorsePath();
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            const cwd = workspaceFolder?.uri.fsPath || process.cwd();
            this.outputChannel.appendLine(`[Swarm] Executing: ${morsePath} ${args.join(' ')}`);
            this.outputChannel.appendLine(`[Swarm] Working directory: ${cwd}`);
            this.currentProcess = (0, child_process_1.spawn)(morsePath, args, {
                cwd,
                shell: true,
                env: { ...process.env },
            });
            let stdout = '';
            let stderr = '';
            if (this.currentProcess.stdout) {
                this.currentProcess.stdout.on('data', (data) => {
                    const text = data.toString();
                    stdout += text;
                    this.outputChannel.append(text);
                    // Parse output for status updates
                    this.parseOutput(text);
                });
            }
            if (this.currentProcess.stderr) {
                this.currentProcess.stderr.on('data', (data) => {
                    const text = data.toString();
                    stderr += text;
                    this.outputChannel.appendLine(`[Swarm Error] ${text}`);
                });
            }
            this.currentProcess.on('error', (error) => {
                this.outputChannel.appendLine(`[Swarm] Process error: ${error.message}`);
                this.statusCache.active = false;
                this.stopPolling();
                reject(error);
            });
            this.currentProcess.on('close', (code) => {
                this.outputChannel.appendLine(`[Swarm] Process exited with code ${code}`);
                if (this.currentSession) {
                    this.currentSession.status = code === 0 ? 'completed' : 'failed';
                    this.currentSession.completedAt = new Date().toISOString();
                    if (this.statusCache.duration === undefined) {
                        const start = new Date(this.currentSession.createdAt).getTime();
                        const end = Date.now();
                        this.currentSession.duration = Math.round((end - start) / 1000);
                        this.statusCache.duration = this.currentSession.duration;
                    }
                }
                this.statusCache.active = false;
                this.stopPolling();
                if (code === 0) {
                    resolve();
                }
                else {
                    reject(new Error(`Swarm exited with code ${code}`));
                }
            });
            // Update session status
            if (this.currentSession) {
                this.currentSession.status = 'running';
            }
            this.statusCache.active = true;
            // Start polling for status updates
            this.startPolling();
        });
    }
    /**
     * Parse CLI output for status updates
     */
    parseOutput(output) {
        // Look for agent completion patterns
        const workerMatch = output.match(/Worker\s+(\w+)\s+completed/i);
        if (workerMatch) {
            this.statusCache.completedAgents++;
            this.statusCache.completed++;
            this.emitStatusUpdate();
        }
        // Look for error patterns
        const errorMatch = output.match(/error|failed|exception/i);
        if (errorMatch) {
            this.statusCache.failedAgents++;
            this.statusCache.failed++;
            this.emitStatusUpdate();
        }
    }
    /**
     * Start polling for swarm status
     */
    startPolling() {
        this.stopPolling();
        this.pollingInterval = setInterval(() => {
            this.emitStatusUpdate();
        }, 2000);
    }
    /**
     * Stop polling for status updates
     */
    stopPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
    }
    /**
     * Emit status update
     */
    emitStatusUpdate() {
        if (this.statusUpdateCallback) {
            this.statusUpdateCallback({ ...this.statusCache });
        }
    }
    // ==================== Status Operations ====================
    /**
     * Get current swarm status
     */
    async status() {
        return { ...this.statusCache };
    }
    /**
     * Get detailed session information
     */
    async getSession() {
        return this.currentSession ? { ...this.currentSession } : null;
    }
    /**
     * Get list of all swarm sessions
     */
    async getSessions() {
        // Return current session if active
        if (this.currentSession) {
            return [{ ...this.currentSession }];
        }
        return [];
    }
    // ==================== Control Operations ====================
    /**
     * Pause the current swarm
     */
    async pause() {
        if (!this.currentSession || this.currentSession.status !== 'running') {
            throw new Error('No active swarm to pause');
        }
        this.outputChannel.appendLine('[Swarm] Pausing swarm...');
        // Send SIGSTOP to pause the process
        if (this.currentProcess && this.currentProcess.pid) {
            process.kill(this.currentProcess.pid, 'SIGSTOP');
        }
        this.currentSession.status = 'paused';
        this.statusCache.active = false;
        this.emitStatusUpdate();
        this.outputChannel.appendLine('[Swarm] Swarm paused');
    }
    /**
     * Resume a paused swarm
     */
    async resume() {
        if (!this.currentSession || this.currentSession.status !== 'paused') {
            throw new Error('No paused swarm to resume');
        }
        this.outputChannel.appendLine('[Swarm] Resuming swarm...');
        // Send SIGCONT to resume the process
        if (this.currentProcess && this.currentProcess.pid) {
            process.kill(this.currentProcess.pid, 'SIGCONT');
        }
        this.currentSession.status = 'running';
        this.statusCache.active = true;
        this.emitStatusUpdate();
        this.outputChannel.appendLine('[Swarm] Swarm resumed');
    }
    /**
     * Cancel the current swarm
     */
    async cancel() {
        this.outputChannel.appendLine('[Swarm] Cancelling swarm...');
        // Kill the process
        if (this.currentProcess) {
            this.currentProcess.kill('SIGTERM');
            this.currentProcess = null;
        }
        if (this.currentSession) {
            this.currentSession.status = 'cancelled';
            this.currentSession.completedAt = new Date().toISOString();
        }
        this.statusCache.active = false;
        this.stopPolling();
        this.emitStatusUpdate();
        this.outputChannel.appendLine('[Swarm] Swarm cancelled');
    }
    // ==================== Agent Operations ====================
    /**
     * Get all results from the swarm
     */
    async results() {
        if (!this.currentSession?.results) {
            return [];
        }
        return [...this.currentSession.results];
    }
    /**
     * Get a specific agent by ID
     */
    async getAgent(agentId) {
        if (!this.currentSession?.agentsList) {
            return null;
        }
        return this.currentSession.agentsList.find(a => a.id === agentId) || null;
    }
    /**
     * Get all agents
     */
    async getAgents() {
        if (!this.currentSession?.agentsList) {
            return [];
        }
        return [...this.currentSession.agentsList];
    }
    // ==================== Utility Methods ====================
    /**
     * Check if a swarm is currently active
     */
    isActive() {
        return this.statusCache.active;
    }
    /**
     * Get output channel for logs
     */
    getOutputChannel() {
        return this.outputChannel;
    }
    /**
     * Clear the current session
     */
    clearSession() {
        this.currentSession = null;
        this.statusCache = {
            active: false,
            agents: 0,
            runningAgents: 0,
            completedAgents: 0,
            failedAgents: 0,
            tasks: 0,
            completed: 0,
            failed: 0,
        };
        this.stopPolling();
    }
    /**
     * Dispose of the client
     */
    dispose() {
        this.cancel();
        this.outputChannel.dispose();
        this.stopPolling();
    }
}
exports.SwarmClient = SwarmClient;
// Singleton instance
let swarmClientInstance = null;
/**
 * Get the singleton SwarmClient instance
 */
function getSwarmClient() {
    if (!swarmClientInstance) {
        swarmClientInstance = new SwarmClient();
    }
    return swarmClientInstance;
}
/**
 * Create a new SwarmClient instance
 */
function createSwarmClient() {
    return new SwarmClient();
}
//# sourceMappingURL=client.js.map