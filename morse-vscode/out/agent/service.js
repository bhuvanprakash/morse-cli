"use strict";
/**
 * Agent Service for Morse VS Code Extension
 * Manages agent lifecycle, task execution, and events
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
exports.AgentService = void 0;
exports.getAgentService = getAgentService;
exports.getAgentClient = getAgentService;
const vscode = __importStar(require("vscode"));
const child_process_1 = require("child_process");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const types_1 = require("./types");
// ==================== Singleton Instance ====================
let agentServiceInstance = null;
/**
 * Gets the singleton agent service instance
 */
function getAgentService() {
    if (!agentServiceInstance) {
        agentServiceInstance = new AgentService();
    }
    return agentServiceInstance;
}
// ==================== Agent Service ====================
/**
 * AgentService manages all agent operations
 */
class AgentService {
    outputChannel;
    agents = new Map();
    tasks = new Map();
    taskQueue = [];
    eventListeners = new Map();
    currentProcess = null;
    config;
    statusPollingInterval = null;
    constructor() {
        this.outputChannel = vscode.window.createOutputChannel('Morse Agent');
        this.config = this.loadConfig();
    }
    // ==================== Configuration ====================
    /**
     * Load agent configuration from VS Code settings
     */
    loadConfig() {
        const agentConfig = vscode.workspace.getConfiguration('morse').get('agent') || {};
        return {
            defaultMaxIterations: agentConfig.defaultMaxIterations ?? 20,
            defaultTimeout: agentConfig.defaultTimeout ?? 300000,
            defaultAutoApprove: agentConfig.defaultAutoApprove ?? false,
            defaultModel: agentConfig.defaultModel,
            defaultTemperature: agentConfig.defaultTemperature ?? 0.7,
            showPanelByDefault: agentConfig.showPanelByDefault ?? true,
            maxConcurrency: agentConfig.maxConcurrency ?? 3,
        };
    }
    /**
     * Get the morse CLI path from configuration
     */
    getMorsePath() {
        const config = vscode.workspace.getConfiguration('morse');
        const cliPath = config.get('cliPath');
        if (cliPath && fs.existsSync(cliPath)) {
            return cliPath;
        }
        // Try to find morse in PATH
        const isWindows = process.platform === 'win32';
        const morseName = isWindows ? 'morse.exe' : 'morse';
        // Check common locations
        const possiblePaths = [
            path.join(process.env.HOME || '', '.local', 'bin', morseName),
            path.join('/usr', 'local', 'bin', morseName),
            path.join('/usr', 'bin', morseName),
        ];
        for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
                return p;
            }
        }
        return morseName; // Fall back to PATH lookup
    }
    // ==================== Agent Management ====================
    /**
     * Creates a new agent
     */
    async createAgent(name, type, config) {
        // Merge with default config
        const fullConfig = {
            ...{
                maxIterations: this.config.defaultMaxIterations,
                timeout: this.config.defaultTimeout,
                autoApprove: this.config.defaultAutoApprove,
                temperature: this.config.defaultTemperature,
                model: this.config.defaultModel,
            },
            ...config,
        };
        const agent = (0, types_1.createAgent)(name, type, fullConfig);
        this.agents.set(agent.id, agent);
        this.emitEvent({
            type: 'agent:created',
            agentId: agent.id,
            timestamp: new Date().toISOString(),
            data: { agent },
        });
        return agent;
    }
    /**
     * Gets an agent by ID
     */
    getAgent(agentId) {
        return this.agents.get(agentId);
    }
    /**
     * Gets all agents
     */
    getAllAgents() {
        return Array.from(this.agents.values());
    }
    /**
     * Updates an agent
     */
    updateAgent(agentId, updates) {
        const agent = this.agents.get(agentId);
        if (!agent) {
            return undefined;
        }
        const updatedAgent = {
            ...agent,
            ...updates,
            updatedAt: new Date().toISOString(),
        };
        this.agents.set(agentId, updatedAgent);
        return updatedAgent;
    }
    /**
     * Deletes an agent
     */
    deleteAgent(agentId) {
        const agent = this.agents.get(agentId);
        if (!agent) {
            return false;
        }
        this.agents.delete(agentId);
        return true;
    }
    // ==================== Task Management ====================
    /**
     * Creates and queues a new task
     */
    async createTask(task, agentId, priority = 0) {
        const agentTask = (0, types_1.createTask)(task, agentId, priority);
        this.tasks.set(agentTask.id, agentTask);
        // Add to queue based on priority
        this.addToQueue(agentTask);
        this.emitEvent({
            type: 'task:queued',
            agentId,
            taskId: agentTask.id,
            timestamp: new Date().toISOString(),
            data: { task: agentTask },
        });
        return agentTask;
    }
    /**
     * Adds task to queue based on priority
     */
    addToQueue(task) {
        // Insert based on priority (higher priority first)
        const index = this.taskQueue.findIndex(t => t.priority < task.priority);
        if (index === -1) {
            this.taskQueue.push(task);
        }
        else {
            this.taskQueue.splice(index, 0, task);
        }
    }
    /**
     * Gets next task from queue
     */
    getNextTask() {
        return this.taskQueue.shift();
    }
    /**
     * Gets a task by ID
     */
    getTask(taskId) {
        return this.tasks.get(taskId);
    }
    /**
     * Gets all tasks
     */
    getAllTasks() {
        return Array.from(this.tasks.values());
    }
    /**
     * Gets pending tasks for an agent
     */
    getPendingTasks(agentId) {
        return this.taskQueue.filter(t => t.agentId === agentId && t.status === 'pending');
    }
    // ==================== Agent Execution ====================
    /**
     * Starts an agent with a task
     */
    async startAgent(agentId, task) {
        const agent = this.agents.get(agentId);
        if (!agent) {
            throw new Error(`Agent not found: ${agentId}`);
        }
        // Create task
        const agentTask = await this.createTask(task, agentId);
        // Update agent status
        this.updateAgent(agentId, {
            status: 'initializing',
            currentTask: task,
            startedAt: new Date().toISOString(),
            progress: 0,
        });
        this.emitEvent({
            type: 'agent:started',
            agentId,
            taskId: agentTask.id,
            timestamp: new Date().toISOString(),
        });
        // Execute the agent
        this.executeAgent(agent, agentTask);
        return agentTask;
    }
    /**
     * Executes an agent with the morse CLI
     */
    async executeAgent(agent, task) {
        const morsePath = this.getMorsePath();
        // Build agent command arguments
        const args = ['agent', task.task];
        // Add configuration flags
        if (agent.config.maxIterations) {
            args.push('--max-steps', agent.config.maxIterations.toString());
        }
        if (agent.config.model) {
            args.push('--model', agent.config.model);
        }
        if (agent.config.autoApprove) {
            args.push('--auto');
        }
        if (agent.config.maxBudget) {
            args.push('--max-budget', agent.config.maxBudget.toString());
        }
        this.outputChannel.appendLine(`[Agent] Starting agent: ${agent.name}`);
        this.outputChannel.appendLine(`[Agent] Command: ${morsePath} ${args.join(' ')}`);
        this.outputChannel.show();
        // Update task status
        task.status = 'running';
        task.startedAt = new Date().toISOString();
        this.updateAgent(agent.id, { status: 'running' });
        this.emitEvent({
            type: 'task:started',
            agentId: agent.id,
            taskId: task.id,
            timestamp: new Date().toISOString(),
        });
        return new Promise((resolve, reject) => {
            // Spawn morse agent process
            this.currentProcess = (0, child_process_1.spawn)(morsePath, args, {
                cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd(),
                env: { ...process.env },
            });
            let output = '';
            let errorOutput = '';
            this.currentProcess.stdout?.on('data', (data) => {
                const text = data.toString();
                output += text;
                this.outputChannel.append(text);
                // Parse step progress
                this.parseAgentProgress(agent.id, text);
            });
            this.currentProcess.stderr?.on('data', (data) => {
                const text = data.toString();
                errorOutput += text;
                this.outputChannel.append(`[stderr] ${text}`);
            });
            this.currentProcess.on('close', (code) => {
                this.currentProcess = null;
                if (code === 0) {
                    // Success
                    const result = {
                        success: true,
                        output: output,
                        steps: this.getAgentSteps(output),
                        tokensUsed: this.estimateTokens(output),
                        duration: task.startedAt ? Date.now() - new Date(task.startedAt).getTime() : 0,
                    };
                    task.status = 'completed';
                    task.completedAt = new Date().toISOString();
                    task.result = result;
                    this.updateAgent(agent.id, {
                        status: 'completed',
                        completedAt: new Date().toISOString(),
                        progress: 100,
                    });
                    this.emitEvent({
                        type: 'task:completed',
                        agentId: agent.id,
                        taskId: task.id,
                        timestamp: new Date().toISOString(),
                        data: { result },
                    });
                    this.emitEvent({
                        type: 'agent:completed',
                        agentId: agent.id,
                        timestamp: new Date().toISOString(),
                        data: { result },
                    });
                    resolve();
                }
                else {
                    // Failure
                    const errorMsg = errorOutput || `Process exited with code ${code}`;
                    task.status = 'failed';
                    task.completedAt = new Date().toISOString();
                    task.error = errorMsg;
                    const result = {
                        success: false,
                        output: output,
                        steps: this.getAgentSteps(output),
                        tokensUsed: this.estimateTokens(output),
                        duration: task.startedAt ? Date.now() - new Date(task.startedAt).getTime() : 0,
                        error: errorMsg,
                    };
                    task.result = result;
                    this.updateAgent(agent.id, {
                        status: 'failed',
                        completedAt: new Date().toISOString(),
                        error: errorMsg,
                    });
                    this.emitEvent({
                        type: 'task:failed',
                        agentId: agent.id,
                        taskId: task.id,
                        timestamp: new Date().toISOString(),
                        data: { error: errorMsg },
                    });
                    this.emitEvent({
                        type: 'agent:failed',
                        agentId: agent.id,
                        timestamp: new Date().toISOString(),
                        data: { error: errorMsg },
                    });
                    reject(new Error(errorMsg));
                }
            });
            this.currentProcess.on('error', (error) => {
                this.currentProcess = null;
                this.outputChannel.appendLine(`[Agent] Error: ${error.message}`);
                task.status = 'failed';
                task.error = error.message;
                this.updateAgent(agent.id, {
                    status: 'failed',
                    error: error.message,
                });
                reject(error);
            });
        });
    }
    /**
     * Stops a running agent
     */
    async stopAgent(agentId) {
        const agent = this.agents.get(agentId);
        if (!agent) {
            throw new Error(`Agent not found: ${agentId}`);
        }
        if (this.currentProcess) {
            this.currentProcess.kill();
            this.currentProcess = null;
        }
        // Cancel pending tasks for this agent
        const pendingTasks = this.getPendingTasks(agentId);
        for (const task of pendingTasks) {
            task.status = 'cancelled';
            this.emitEvent({
                type: 'task:failed',
                agentId,
                taskId: task.id,
                timestamp: new Date().toISOString(),
                data: { error: 'Agent stopped' },
            });
        }
        this.updateAgent(agentId, {
            status: 'cancelled',
            completedAt: new Date().toISOString(),
        });
        this.emitEvent({
            type: 'agent:cancelled',
            agentId,
            timestamp: new Date().toISOString(),
        });
    }
    /**
     * Pauses a running agent
     */
    async pauseAgent(agentId) {
        const agent = this.agents.get(agentId);
        if (!agent) {
            throw new Error(`Agent not found: ${agentId}`);
        }
        if (agent.status !== 'running') {
            throw new Error('Agent is not running');
        }
        // Send pause signal (if supported)
        // For now, just update status
        this.updateAgent(agentId, { status: 'paused' });
        this.emitEvent({
            type: 'agent:paused',
            agentId,
            timestamp: new Date().toISOString(),
        });
    }
    /**
     * Resumes a paused agent
     */
    async resumeAgent(agentId) {
        const agent = this.agents.get(agentId);
        if (!agent) {
            throw new Error(`Agent not found: ${agentId}`);
        }
        if (agent.status !== 'paused') {
            throw new Error('Agent is not paused');
        }
        this.updateAgent(agentId, { status: 'running' });
        this.emitEvent({
            type: 'agent:resumed',
            agentId,
            timestamp: new Date().toISOString(),
        });
    }
    // ==================== Agent Pool ====================
    /**
     * Creates an agent pool
     */
    async createAgentPool(name, maxConcurrency) {
        const agent = await this.createAgent(name, 'agent-pool', {
            maxIterations: this.config.defaultMaxIterations,
        });
        agent.maxConcurrency = maxConcurrency;
        agent.activeAgents = [];
        agent.queuedAgents = [];
        agent.stats = {
            totalTasks: 0,
            completedTasks: 0,
            failedTasks: 0,
            averageDuration: 0,
        };
        return agent;
    }
    /**
     * Adds an agent to the pool
     */
    async addToPool(poolId, agentType = 'autonomous') {
        const pool = this.agents.get(poolId);
        if (!pool || pool.type !== 'agent-pool') {
            throw new Error('Invalid pool ID');
        }
        const agent = await this.createAgent(`pool-${pool.id}-agent-${pool.activeAgents.length + pool.queuedAgents.length + 1}`, agentType);
        pool.queuedAgents.push(agent.id);
        this.updateAgent(poolId, { activeAgents: pool.activeAgents, queuedAgents: pool.queuedAgents });
        return agent;
    }
    // ==================== Status & Events ====================
    /**
     * Gets the current agent system status
     */
    getSystemStatus() {
        const agents = this.getAllAgents();
        const tasks = this.getAllTasks();
        const runningAgents = agents.filter(a => a.status === 'running').length;
        const completedAgents = agents.filter(a => a.status === 'completed').length;
        const failedAgents = agents.filter(a => a.status === 'failed').length;
        const runningTasks = tasks.filter(t => t.status === 'running').length;
        const completedTasks = tasks.filter(t => t.status === 'completed').length;
        const failedTasks = tasks.filter(t => t.status === 'failed').length;
        const activeAgent = agents.find(a => a.status === 'running');
        return {
            active: runningAgents > 0 || runningTasks > 0,
            currentAgentId: activeAgent?.id,
            totalAgents: agents.length,
            runningAgents,
            completedAgents,
            failedAgents,
            totalTasks: tasks.length,
            completedTasks,
            failedTasks,
        };
    }
    /**
     * Registers an event listener
     */
    onEvent(eventType, callback) {
        if (!this.eventListeners.has(eventType)) {
            this.eventListeners.set(eventType, []);
        }
        this.eventListeners.get(eventType).push(callback);
    }
    /**
     * Removes an event listener
     */
    offEvent(eventType, callback) {
        const listeners = this.eventListeners.get(eventType);
        if (listeners) {
            const index = listeners.indexOf(callback);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        }
    }
    /**
     * Emits an event to all listeners
     */
    emitEvent(event) {
        const listeners = this.eventListeners.get(event.type);
        if (listeners) {
            for (const callback of listeners) {
                try {
                    callback(event);
                }
                catch (error) {
                    console.error('[Agent] Event callback error:', error);
                }
            }
        }
        // Also emit to wildcard listeners
        const wildcardListeners = this.eventListeners.get('*');
        if (wildcardListeners) {
            for (const callback of wildcardListeners) {
                try {
                    callback(event);
                }
                catch (error) {
                    console.error('[Agent] Event callback error:', error);
                }
            }
        }
    }
    /**
     * Gets the output channel
     */
    getOutputChannel() {
        return this.outputChannel;
    }
    // ==================== Helper Methods ====================
    /**
     * Parses agent progress from output
     */
    parseAgentProgress(agentId, output) {
        // Try to extract progress from output
        const stepMatch = output.match(/Step (\d+)\/(\d+)/);
        if (stepMatch) {
            const currentStep = parseInt(stepMatch[1]);
            const totalSteps = parseInt(stepMatch[2]);
            const progress = Math.round((currentStep / totalSteps) * 100);
            this.updateAgent(agentId, {
                progress,
                currentTask: `Step ${currentStep}/${totalSteps}`,
            });
            this.emitEvent({
                type: 'agent:progress',
                agentId,
                timestamp: new Date().toISOString(),
                data: { currentStep, totalSteps, progress },
            });
        }
    }
    /**
     * Estimates the number of tokens from output
     */
    estimateTokens(output) {
        // Rough estimate: 1 token ≈ 4 characters
        return Math.ceil(output.length / 4);
    }
    /**
     * Gets the number of steps from output
     */
    getAgentSteps(output) {
        const stepMatches = output.match(/Step \d+\/\d+/g);
        return stepMatches ? stepMatches.length : 0;
    }
    /**
     * Disposes of the agent service
     */
    dispose() {
        // Stop all running agents
        const agentsArray = Array.from(this.agents.values());
        for (const agent of agentsArray) {
            if (agent.status === 'running') {
                this.stopAgent(agent.id).catch(console.error);
            }
        }
        // Clear intervals
        if (this.statusPollingInterval) {
            clearInterval(this.statusPollingInterval);
        }
        // Dispose output channel
        this.outputChannel.dispose();
        // Clear maps
        this.agents.clear();
        this.tasks.clear();
        this.taskQueue = [];
        this.eventListeners.clear();
    }
}
exports.AgentService = AgentService;
//# sourceMappingURL=service.js.map