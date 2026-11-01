"use strict";
/**
 * Agent Commands for Morse VS Code Extension
 * Registers all agent-related VS Code commands
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
exports.registerAgentCommands = registerAgentCommands;
const vscode = __importStar(require("vscode"));
const service_1 = require("./service");
const panel_1 = require("./panel");
/**
 * Registers all agent commands with the extension context
 */
function registerAgentCommands(context) {
    const agentService = (0, service_1.getAgentService)();
    // ==================== morse.agent.start ====================
    // Start a new autonomous agent
    context.subscriptions.push(vscode.commands.registerCommand('morse.agent.start', async () => {
        try {
            // Get task description from user
            const task = await vscode.window.showInputBox({
                prompt: 'Enter task for agent',
                placeHolder: 'What do you want the agent to do?',
                validateInput: (value) => {
                    return value.trim().length > 0 ? null : 'Task description is required';
                },
            });
            if (!task) {
                return;
            }
            // Get agent name
            const name = await vscode.window.showInputBox({
                prompt: 'Agent name (optional)',
                placeHolder: 'My Agent',
            });
            // Show configuration options
            const config = await showAgentConfigQuickPick();
            // Create and start agent
            const agent = await agentService.createAgent(name || `Agent-${Date.now()}`, 'autonomous', config);
            await agentService.startAgent(agent.id, task);
            vscode.window.showInformationMessage(`Agent "${agent.name}" started`);
            // Show output channel
            agentService.getOutputChannel().show();
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to start agent: ${error}`);
        }
    }));
    // ==================== morse.agent.startWithTask ====================
    // Start agent with a pre-defined task
    context.subscriptions.push(vscode.commands.registerCommand('morse.agent.startWithTask', async (task) => {
        try {
            if (!task || task.trim().length === 0) {
                vscode.window.showWarningMessage('Task cannot be empty');
                return;
            }
            // Show configuration options
            const config = await showAgentConfigQuickPick();
            // Create and start agent
            const agent = await agentService.createAgent(`Agent-${Date.now()}`, 'autonomous', config);
            await agentService.startAgent(agent.id, task);
            vscode.window.showInformationMessage(`Agent "${agent.name}" started`);
            // Show output channel
            agentService.getOutputChannel().show();
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to start agent: ${error}`);
        }
    }));
    // ==================== morse.agent.stop ====================
    // Stop a running agent
    context.subscriptions.push(vscode.commands.registerCommand('morse.agent.stop', async () => {
        try {
            const agents = agentService.getAllAgents();
            const runningAgents = agents.filter(a => a.status === 'running');
            if (runningAgents.length === 0) {
                vscode.window.showInformationMessage('No running agents');
                return;
            }
            if (runningAgents.length === 1) {
                await agentService.stopAgent(runningAgents[0].id);
                vscode.window.showInformationMessage(`Agent "${runningAgents[0].name}" stopped`);
                return;
            }
            // Show picker for multiple agents
            const selected = await vscode.window.showQuickPick(runningAgents.map(a => ({
                label: a.name,
                description: a.currentTask || 'No task',
                agent: a,
            })), { placeHolder: 'Select agent to stop' });
            if (selected) {
                await agentService.stopAgent(selected.agent.id);
                vscode.window.showInformationMessage(`Agent "${selected.agent.name}" stopped`);
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to stop agent: ${error}`);
        }
    }));
    // ==================== morse.agent.pause ====================
    // Pause a running agent
    context.subscriptions.push(vscode.commands.registerCommand('morse.agent.pause', async () => {
        try {
            const agents = agentService.getAllAgents();
            const runningAgents = agents.filter(a => a.status === 'running');
            if (runningAgents.length === 0) {
                vscode.window.showInformationMessage('No running agents to pause');
                return;
            }
            const selected = await vscode.window.showQuickPick(runningAgents.map(a => ({
                label: a.name,
                description: a.currentTask || 'No task',
                agent: a,
            })), { placeHolder: 'Select agent to pause' });
            if (selected) {
                await agentService.pauseAgent(selected.agent.id);
                vscode.window.showInformationMessage(`Agent "${selected.agent.name}" paused`);
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to pause agent: ${error}`);
        }
    }));
    // ==================== morse.agent.resume ====================
    // Resume a paused agent
    context.subscriptions.push(vscode.commands.registerCommand('morse.agent.resume', async () => {
        try {
            const agents = agentService.getAllAgents();
            const pausedAgents = agents.filter(a => a.status === 'paused');
            if (pausedAgents.length === 0) {
                vscode.window.showInformationMessage('No paused agents');
                return;
            }
            const selected = await vscode.window.showQuickPick(pausedAgents.map(a => ({
                label: a.name,
                description: a.currentTask || 'No task',
                agent: a,
            })), { placeHolder: 'Select agent to resume' });
            if (selected) {
                await agentService.resumeAgent(selected.agent.id);
                vscode.window.showInformationMessage(`Agent "${selected.agent.name}" resumed`);
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to resume agent: ${error}`);
        }
    }));
    // ==================== morse.agent.status ====================
    // Show agent status
    context.subscriptions.push(vscode.commands.registerCommand('morse.agent.status', async () => {
        try {
            const status = agentService.getSystemStatus();
            const agents = agentService.getAllAgents();
            if (!status.active) {
                await vscode.window.showInformationMessage('No active agents', { modal: true });
                return;
            }
            const statusMessage = [
                `Active Agents: ${status.runningAgents} / ${status.totalAgents}`,
                `Completed: ${status.completedAgents}`,
                `Failed: ${status.failedAgents}`,
                `Total Tasks: ${status.totalTasks}`,
                `Completed Tasks: ${status.completedTasks}`,
                `Failed Tasks: ${status.failedTasks}`,
            ].join('\n');
            await vscode.window.showInformationMessage(statusMessage, { modal: true });
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to get agent status: ${error}`);
        }
    }));
    // ==================== morse.agent.list ====================
    // List all agents
    context.subscriptions.push(vscode.commands.registerCommand('morse.agent.list', async () => {
        try {
            const agents = agentService.getAllAgents();
            if (agents.length === 0) {
                await vscode.window.showInformationMessage('No agents created yet');
                return;
            }
            const agentList = agents.map(a => `${a.name} (${a.type}) - ${a.status}`).join('\n');
            await vscode.window.showInformationMessage(`Agents:\n${agentList}`, { modal: true });
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to list agents: ${error}`);
        }
    }));
    // ==================== morse.agent.panel ====================
    // Open agent panel
    context.subscriptions.push(vscode.commands.registerCommand('morse.agent.panel', async () => {
        try {
            (0, panel_1.showAgentPanel)();
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to open agent panel: ${error}`);
        }
    }));
    // ==================== morse.agent.output ====================
    // Show agent output channel
    context.subscriptions.push(vscode.commands.registerCommand('morse.agent.output', async () => {
        try {
            agentService.getOutputChannel().show();
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to show output: ${error}`);
        }
    }));
    // ==================== morse.agent.createPool ====================
    // Create an agent pool
    context.subscriptions.push(vscode.commands.registerCommand('morse.agent.createPool', async () => {
        try {
            // Get pool name
            const name = await vscode.window.showInputBox({
                prompt: 'Enter pool name',
                placeHolder: 'My Agent Pool',
                validateInput: (value) => {
                    return value.trim().length > 0 ? null : 'Pool name is required';
                },
            });
            if (!name) {
                return;
            }
            // Get max concurrency
            const concurrency = await vscode.window.showQuickPick(['2', '3', '5', '10'], {
                placeHolder: 'Maximum concurrent agents',
                title: 'Select concurrency',
            });
            const maxConcurrency = parseInt(concurrency || '3');
            const pool = await agentService.createAgentPool(name, maxConcurrency);
            vscode.window.showInformationMessage(`Agent pool "${pool.name}" created`);
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to create agent pool: ${error}`);
        }
    }));
    // ==================== morse.agent.delete ====================
    // Delete an agent
    context.subscriptions.push(vscode.commands.registerCommand('morse.agent.delete', async () => {
        try {
            const agents = agentService.getAllAgents();
            if (agents.length === 0) {
                vscode.window.showInformationMessage('No agents to delete');
                return;
            }
            const selected = await vscode.window.showQuickPick(agents.map(a => ({
                label: a.name,
                description: `${a.type} - ${a.status}`,
                agent: a,
            })), { placeHolder: 'Select agent to delete' });
            if (selected) {
                if (selected.agent.status === 'running') {
                    const confirm = await vscode.window.showWarningMessage('Agent is currently running. Stop and delete?', 'Yes', 'No');
                    if (confirm !== 'Yes') {
                        return;
                    }
                    await agentService.stopAgent(selected.agent.id);
                }
                agentService.deleteAgent(selected.agent.id);
                vscode.window.showInformationMessage(`Agent "${selected.agent.name}" deleted`);
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to delete agent: ${error}`);
        }
    }));
}
/**
 * Shows a quick pick for agent configuration
 */
async function showAgentConfigQuickPick() {
    const config = {
        maxIterations: 20,
        autoApprove: false,
        temperature: 0.7,
    };
    // Get max iterations
    const iterations = await vscode.window.showQuickPick(['5', '10', '20', '50', '100'], {
        placeHolder: 'Max iterations',
        title: 'Select max iterations',
    });
    if (iterations) {
        config.maxIterations = parseInt(iterations);
    }
    // Get auto-approve setting
    const autoApprove = await vscode.window.showQuickPick(['Yes', 'No'], {
        placeHolder: 'Auto-approve tool calls?',
        title: 'Auto-approve',
    });
    if (autoApprove === 'Yes') {
        config.autoApprove = true;
    }
    // Get model (optional)
    const model = await vscode.window.showInputBox({
        prompt: 'Model override (optional)',
        placeHolder: 'Leave empty for default',
    });
    if (model && model.trim()) {
        config.model = model.trim();
    }
    return config;
}
//# sourceMappingURL=commands.js.map