"use strict";
/**
 * Swarm Commands for Morse VS Code Extension
 * Registers all swarm-related commands
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
exports.registerSwarmCommands = registerSwarmCommands;
const vscode = __importStar(require("vscode"));
const client_1 = require("../swarm/client");
function registerSwarmCommands(context) {
    const swarmClient = (0, client_1.getSwarmClient)();
    // ==================== morse.swarm.start ====================
    // Start a new swarm session
    context.subscriptions.push(vscode.commands.registerCommand('morse.swarm.start', async () => {
        try {
            // Get task description from user
            const task = await vscode.window.showInputBox({
                prompt: 'Enter task for swarm',
                placeHolder: 'What do you want the swarm to do?',
                validateInput: (value) => {
                    return value.trim().length > 0 ? null : 'Task description is required';
                },
            });
            if (!task) {
                return;
            }
            // Get number of agents
            const agents = await vscode.window.showQuickPick(['2', '3', '5', '10'], {
                placeHolder: 'Number of agents',
                title: 'Select number of agents',
            });
            if (!agents) {
                return;
            }
            // Show configuration options
            const config = await showSwarmConfigQuickPick();
            // Start swarm
            const session = await swarmClient.create(task, parseInt(agents), config);
            vscode.window.showInformationMessage(`Swarm started with ${agents} agents`);
            // Show the output channel
            swarmClient.getOutputChannel().show();
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to start swarm: ${error}`);
        }
    }));
    // ==================== morse.swarm.status ====================
    // Show swarm status
    context.subscriptions.push(vscode.commands.registerCommand('morse.swarm.status', async () => {
        try {
            const status = await swarmClient.status();
            if (!status.active) {
                vscode.window.showInformationMessage('No active swarm');
                return;
            }
            const message = `Swarm Status:
Task: ${status.task || 'N/A'}
Agents: ${status.runningAgents}/${status.agents} running
Completed: ${status.completed}/${status.tasks} tasks
Failed: ${status.failed}`;
            await vscode.window.showInformationMessage(message, { modal: true });
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to get swarm status: ${error}`);
        }
    }));
    // ==================== morse.swarm.pause ====================
    // Pause swarm
    context.subscriptions.push(vscode.commands.registerCommand('morse.swarm.pause', async () => {
        try {
            await swarmClient.pause();
            vscode.window.showInformationMessage('Swarm paused');
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to pause swarm: ${error}`);
        }
    }));
    // ==================== morse.swarm.resume ====================
    // Resume swarm
    context.subscriptions.push(vscode.commands.registerCommand('morse.swarm.resume', async () => {
        try {
            await swarmClient.resume();
            vscode.window.showInformationMessage('Swarm resumed');
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to resume swarm: ${error}`);
        }
    }));
    // ==================== morse.swarm.cancel ====================
    // Cancel swarm
    context.subscriptions.push(vscode.commands.registerCommand('morse.swarm.cancel', async () => {
        try {
            const response = await vscode.window.showWarningMessage('Are you sure you want to cancel the current swarm?', { modal: true }, 'Cancel Swarm', 'Keep Running');
            if (response === 'Cancel Swarm') {
                await swarmClient.cancel();
                vscode.window.showInformationMessage('Swarm cancelled');
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to cancel swarm: ${error}`);
        }
    }));
    // ==================== morse.swarm.add ====================
    // Add agent to swarm (future enhancement - not implemented in CLI yet)
    context.subscriptions.push(vscode.commands.registerCommand('morse.swarm.add', async () => {
        try {
            const status = await swarmClient.status();
            if (!status.active) {
                vscode.window.showInformationMessage('No active swarm to add agents to');
                return;
            }
            // For now, just show a message that this feature requires swarm to be running
            vscode.window.showInformationMessage(`Current swarm has ${status.agents} agents. Adding agents dynamically is not yet supported.`);
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to add agent: ${error}`);
        }
    }));
    // ==================== morse.swarm.remove ====================
    // Remove agent from swarm (future enhancement - not implemented in CLI yet)
    context.subscriptions.push(vscode.commands.registerCommand('morse.swarm.remove', async () => {
        try {
            const status = await swarmClient.status();
            if (!status.active) {
                vscode.window.showInformationMessage('No active swarm to remove agents from');
                return;
            }
            // For now, just show a message that this feature requires swarm to be running
            vscode.window.showInformationMessage(`Current swarm has ${status.agents} agents. Removing agents dynamically is not yet supported.`);
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to remove agent: ${error}`);
        }
    }));
    // ==================== morse.swarm.config ====================
    // Configure swarm settings
    context.subscriptions.push(vscode.commands.registerCommand('morse.swarm.config', async () => {
        try {
            const config = await showSwarmConfigQuickPick();
            if (config) {
                // Store config for future use
                const configJson = JSON.stringify(config, null, 2);
                vscode.window.showInformationMessage(`Swarm configuration updated:\n${configJson}`);
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to configure swarm: ${error}`);
        }
    }));
    // ==================== morse.swarm.showLogs ====================
    // Show swarm logs
    context.subscriptions.push(vscode.commands.registerCommand('morse.swarm.showLogs', async () => {
        const outputChannel = swarmClient.getOutputChannel();
        outputChannel.show();
    }));
    // ==================== morse.swarm.results ====================
    // Show swarm results
    context.subscriptions.push(vscode.commands.registerCommand('morse.swarm.results', async () => {
        try {
            const results = await swarmClient.results();
            if (results.length === 0) {
                vscode.window.showInformationMessage('No results available yet');
                return;
            }
            const resultsText = results.map(r => `Agent ${r.agentId}: ${r.success ? 'Success' : 'Failed'}\n${r.output}`).join('\n\n---\n\n');
            // Show in a document
            const document = await vscode.workspace.openTextDocument({
                content: `# Swarm Results\n\n${resultsText}`,
                language: 'markdown',
            });
            await vscode.window.showTextDocument(document);
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to get swarm results: ${error}`);
        }
    }));
    // ==================== morse.swarm.list ====================
    // List swarm sessions
    context.subscriptions.push(vscode.commands.registerCommand('morse.swarm.list', async () => {
        try {
            const sessions = await swarmClient.getSessions();
            if (sessions.length === 0) {
                vscode.window.showInformationMessage('No swarm sessions');
                return;
            }
            const sessionItems = sessions.map(s => ({
                label: `${s.id}: ${s.task.substring(0, 30)}...`,
                description: `${s.status} - ${s.agents} agents`,
                session: s,
            }));
            const selected = await vscode.window.showQuickPick(sessionItems, {
                placeHolder: 'Select a swarm session',
            });
            if (selected) {
                const session = selected.session;
                const message = `Session: ${session.id}\nTask: ${session.task}\nAgents: ${session.agents}\nStatus: ${session.status}`;
                vscode.window.showInformationMessage(message, { modal: true });
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to list swarm sessions: ${error}`);
        }
    }));
}
/**
 * Show quick pick for swarm configuration
 */
async function showSwarmConfigQuickPick() {
    const config = {};
    // Auto-approve
    const autoApprove = await vscode.window.showQuickPick(['Yes', 'No'], {
        placeHolder: 'Auto-approve agent actions?',
        title: 'Auto-approve',
    });
    if (autoApprove === undefined) {
        return undefined;
    }
    config.autoApprove = autoApprove === 'Yes';
    // Max steps
    const maxSteps = await vscode.window.showQuickPick(['10', '20', '30', '50'], {
        placeHolder: 'Maximum coordinator steps',
        title: 'Max Steps',
    });
    if (maxSteps) {
        config.maxSteps = parseInt(maxSteps);
    }
    // Max budget
    const maxBudget = await vscode.window.showQuickPick(['$1', '$5', '$10', 'No limit'], {
        placeHolder: 'Maximum budget (USD)',
        title: 'Max Budget',
    });
    if (maxBudget && maxBudget !== 'No limit') {
        config.maxBudget = parseFloat(maxBudget.replace('$', ''));
    }
    // Dry run
    const dryRun = await vscode.window.showQuickPick(['No (Execute)', 'Yes (Preview only)'], {
        placeHolder: 'Dry run?',
        title: 'Dry Run',
    });
    if (dryRun === undefined) {
        return undefined;
    }
    config.dryRun = dryRun === 'Yes (Preview only)';
    return config;
}
//# sourceMappingURL=swarmCommands.js.map