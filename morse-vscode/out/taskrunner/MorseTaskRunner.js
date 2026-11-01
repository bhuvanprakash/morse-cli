"use strict";
/**
 * Morse Task Runner
 * Custom task automation for Morse AI workflows
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
exports.MorseTaskRunner = void 0;
const vscode = __importStar(require("vscode"));
const child_process = __importStar(require("child_process"));
class MorseTaskRunner {
    context;
    client;
    tasks = new Map();
    workflows = new Map();
    runningTasks = new Map();
    executions = [];
    _onDidExecuteTask = new vscode.EventEmitter();
    onDidExecuteTask = this._onDidExecuteTask.event;
    constructor(context, client) {
        this.context = context;
        this.client = client;
        this.loadTasks();
        this.loadWorkflows();
    }
    /**
     * Load saved tasks from workspace state
     */
    async loadTasks() {
        const stored = this.context.workspaceState.get('morseTasks', []);
        stored.forEach(task => {
            this.tasks.set(task.id, task);
        });
    }
    /**
     * Load saved workflows from workspace state
     */
    async loadWorkflows() {
        const stored = this.context.workspaceState.get('morseWorkflows', []);
        stored.forEach(workflow => {
            this.workflows.set(workflow.id, workflow);
        });
    }
    /**
     * Save tasks to workspace state
     */
    async saveTasks() {
        const tasksArray = Array.from(this.tasks.values());
        await this.context.workspaceState.update('morseTasks', tasksArray);
    }
    /**
     * Save workflows to workspace state
     */
    async saveWorkflows() {
        const workflowsArray = Array.from(this.workflows.values());
        await this.context.workspaceState.update('morseWorkflows', workflowsArray);
    }
    /**
     * VSCode Task Provider implementation
     */
    provideTasks(token) {
        const taskList = [];
        // Add custom Morse tasks
        this.tasks.forEach((taskDef) => {
            const args = taskDef.args ?? [];
            const execution = args.length > 0
                ? new vscode.ShellExecution(taskDef.command, args, { cwd: taskDef.cwd })
                : new vscode.ShellExecution(taskDef.command, { cwd: taskDef.cwd });
            const vscodeTask = new vscode.Task({ type: 'morse', task: taskDef.id }, vscode.TaskScope.Workspace, taskDef.name, 'morse', execution, ['$morse']);
            vscodeTask.detail = taskDef.description;
            taskList.push(vscodeTask);
        });
        // Add workflow tasks
        this.workflows.forEach((workflow) => {
            const execution = new vscode.ShellExecution(`echo "Running Morse Workflow: ${workflow.name}"`);
            const workflowTask = new vscode.Task({ type: 'morse-workflow', workflow: workflow.id }, vscode.TaskScope.Workspace, workflow.name, 'morse', execution);
            workflowTask.detail = workflow.description;
            taskList.push(workflowTask);
        });
        return taskList;
    }
    /**
     * Resolve a task
     */
    resolveTask(task, token) {
        return task;
    }
    /**
     * Register a new task
     */
    async registerTask(definition) {
        this.tasks.set(definition.id, definition);
        await this.saveTasks();
    }
    /**
     * Create a task from AI suggestion
     */
    async createAITask(description) {
        try {
            const prompt = `Create a shell command for this task: ${description}\n\nProvide the command in JSON format with fields: command (string), args (array), description (string).`;
            const response = await this.client.generate({
                messages: [{ role: 'user', content: prompt }]
            });
            if (response && response.content) {
                // Try to parse JSON from response
                const jsonMatch = response.content.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const data = JSON.parse(jsonMatch[0]);
                    const task = {
                        id: `ai-task-${Date.now()}`,
                        name: description,
                        description: data.description || description,
                        command: data.command,
                        args: data.args || [],
                        type: 'shell'
                    };
                    this.tasks.set(task.id, task);
                    await this.saveTasks();
                    return task;
                }
            }
        }
        catch (error) {
            console.error('Failed to create AI task:', error);
        }
        return null;
    }
    /**
     * Execute a specific task
     */
    async executeTask(taskId) {
        const task = this.tasks.get(taskId);
        if (!task) {
            throw new Error(`Task not found: ${taskId}`);
        }
        return this.runTask(task);
    }
    /**
     * Run a task definition
     */
    runTask(task) {
        const execution = {
            id: `exec-${Date.now()}-${Math.random().toString(36).substring(7)}`,
            taskId: task.id,
            status: 'running',
            startTime: new Date(),
            output: '',
            waitForComplete() {
                return new Promise((resolve) => {
                    const check = () => {
                        if (this.status !== 'running')
                            resolve(this);
                        else
                            setTimeout(check, 100);
                    };
                    check();
                });
            }
        };
        this.executions.push(execution);
        this._onDidExecuteTask.fire(execution);
        const workspaceFolders = vscode.workspace.workspaceFolders;
        const cwd = task.cwd || workspaceFolders?.[0]?.uri.fsPath || process.cwd();
        const env = {
            ...process.env,
            ...task.env
        };
        if (task.type === 'shell') {
            const proc = child_process.spawn(task.command, task.args || [], { cwd, env, shell: true });
            this.runningTasks.set(execution.id, proc);
            proc.stdout?.on('data', (data) => {
                execution.output += data.toString();
            });
            proc.stderr?.on('data', (data) => {
                execution.output += data.toString();
            });
            proc.on('close', (code) => {
                execution.exitCode = code || undefined;
                execution.endTime = new Date();
                execution.status = code === 0 ? 'success' : 'failed';
                this.runningTasks.delete(execution.id);
                this._onDidExecuteTask.fire(execution);
            });
            proc.on('error', (error) => {
                execution.status = 'failed';
                execution.error = error.message;
                execution.endTime = new Date();
                this.runningTasks.delete(execution.id);
                this._onDidExecuteTask.fire(execution);
            });
            // Handle timeout
            if (task.timeout) {
                setTimeout(() => {
                    if (execution.status === 'running') {
                        proc.kill();
                        execution.status = 'failed';
                        execution.error = 'Task timed out';
                        execution.endTime = new Date();
                        this._onDidExecuteTask.fire(execution);
                    }
                }, task.timeout);
            }
        }
        else if (task.type === 'morse') {
            // Execute via Morse CLI
            const proc = child_process.spawn('morse', ['task', 'run', task.id], { cwd, env });
            this.runningTasks.set(execution.id, proc);
            proc.stdout?.on('data', (data) => {
                execution.output += data.toString();
            });
            proc.stderr?.on('data', (data) => {
                execution.output += data.toString();
            });
            proc.on('close', (code) => {
                execution.exitCode = code || undefined;
                execution.endTime = new Date();
                execution.status = code === 0 ? 'success' : 'failed';
                this.runningTasks.delete(execution.id);
                this._onDidExecuteTask.fire(execution);
            });
        }
        return execution;
    }
    /**
     * Execute a workflow
     */
    async executeWorkflow(workflowId) {
        const workflow = this.workflows.get(workflowId);
        if (!workflow) {
            throw new Error(`Workflow not found: ${workflowId}`);
        }
        const results = [];
        if (workflow.parallel) {
            // Run all tasks in parallel
            const promises = workflow.tasks.map(task => this.runTask(task));
            results.push(...promises);
        }
        else {
            // Run tasks sequentially
            for (const task of workflow.tasks) {
                const exec = this.runTask(task);
                if (exec.waitForComplete)
                    await exec.waitForComplete();
                results.push(exec);
                if (exec.status === 'failed' && workflow.onFailure) {
                    // Run failure handlers
                    break;
                }
            }
        }
        return results;
    }
    /**
     * Create a workflow from tasks
     */
    async createWorkflow(workflow) {
        this.workflows.set(workflow.id, workflow);
        await this.saveWorkflows();
    }
    /**
     * Generate workflow from AI
     */
    async generateWorkflow(description) {
        try {
            const prompt = `Create a task workflow for: ${description}\n\nReturn JSON with: name, description, tasks (array with id, name, command, type), parallel (boolean).`;
            const response = await this.client.generate({
                messages: [{ role: 'user', content: prompt }]
            });
            if (response && response.content) {
                const jsonMatch = response.content.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const data = JSON.parse(jsonMatch[0]);
                    const workflow = {
                        id: `workflow-${Date.now()}`,
                        name: data.name || description,
                        description: data.description || description,
                        tasks: data.tasks || [],
                        parallel: data.parallel || false
                    };
                    this.workflows.set(workflow.id, workflow);
                    await this.saveWorkflows();
                    return workflow;
                }
            }
        }
        catch (error) {
            console.error('Failed to generate workflow:', error);
        }
        return null;
    }
    /**
     * Cancel a running task
     */
    cancelTask(executionId) {
        const proc = this.runningTasks.get(executionId);
        if (proc) {
            proc.kill();
            const execution = this.executions.find(e => e.id === executionId);
            if (execution) {
                execution.status = 'cancelled';
                execution.endTime = new Date();
                this._onDidExecuteTask.fire(execution);
            }
            this.runningTasks.delete(executionId);
            return true;
        }
        return false;
    }
    /**
     * Get all tasks
     */
    getAllTasks() {
        return Array.from(this.tasks.values());
    }
    /**
     * Get all workflows
     */
    getAllWorkflows() {
        return Array.from(this.workflows.values());
    }
    /**
     * Get task by ID
     */
    getTask(id) {
        return this.tasks.get(id);
    }
    /**
     * Get workflow by ID
     */
    getWorkflow(id) {
        return this.workflows.get(id);
    }
    /**
     * Delete a task
     */
    async deleteTask(id) {
        const deleted = this.tasks.delete(id);
        if (deleted) {
            await this.saveTasks();
        }
        return deleted;
    }
    /**
     * Delete a workflow
     */
    async deleteWorkflow(id) {
        const deleted = this.workflows.delete(id);
        if (deleted) {
            await this.saveWorkflows();
        }
        return deleted;
    }
    /**
     * Get execution history
     */
    getExecutionHistory(limit) {
        if (limit) {
            return this.executions.slice(-limit);
        }
        return this.executions;
    }
    /**
     * Get statistics
     */
    getStatistics() {
        const totalExecutions = this.executions.length;
        const successfulExecutions = this.executions.filter(e => e.status === 'success').length;
        return {
            totalTasks: this.tasks.size,
            totalWorkflows: this.workflows.size,
            totalExecutions,
            successRate: totalExecutions > 0 ? (successfulExecutions / totalExecutions) * 100 : 0
        };
    }
    /**
     * Dispose of the task runner
     */
    dispose() {
        // Cancel all running tasks
        this.runningTasks.forEach((proc) => {
            proc.kill();
        });
        this.runningTasks.clear();
        this._onDidExecuteTask.dispose();
    }
}
exports.MorseTaskRunner = MorseTaskRunner;
//# sourceMappingURL=MorseTaskRunner.js.map