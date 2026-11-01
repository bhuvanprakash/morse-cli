"use strict";
/**
 * Model and Provider selection commands
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
exports.registerSelectModelCommand = registerSelectModelCommand;
exports.registerSelectProviderCommand = registerSelectProviderCommand;
exports.registerSessionsCommand = registerSessionsCommand;
exports.registerUsageCommand = registerUsageCommand;
exports.registerSettingsCommand = registerSettingsCommand;
exports.registerSwarmCommand = registerSwarmCommand;
exports.registerPluginsCommand = registerPluginsCommand;
exports.registerSkillsCommand = registerSkillsCommand;
const vscode = __importStar(require("vscode"));
function registerSelectModelCommand(context, client) {
    // Model selection command
    context.subscriptions.push(vscode.commands.registerCommand('morse.selectModel', async () => {
        try {
            // Get available models
            const models = await client.getAvailableModels();
            // Quick picks for model selection
            const items = models.map((model) => ({
                label: model.name,
                description: `${model.provider} • Context: ${(model.contextLength / 1000).toFixed(0)}K`,
                detail: model.supportsTools ? 'Tools supported' : 'No tools',
                picked: model.id === client.getCurrentModel(),
            }));
            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: 'Select a model',
                matchOnDescription: true,
            });
            if (selected) {
                const selectedModel = models.find((m) => m.name === selected.label);
                if (selectedModel) {
                    await client.setModel(selectedModel.id);
                    vscode.window.showInformationMessage(`Model changed to ${selected.label}`);
                }
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to change model: ${error}`);
        }
    }));
}
function registerSelectProviderCommand(context, client) {
    // Provider selection command
    context.subscriptions.push(vscode.commands.registerCommand('morse.selectProvider', async () => {
        try {
            // Get available providers
            const providers = await client.getProviders();
            const items = providers.map((provider) => ({
                label: provider.name.charAt(0).toUpperCase() + provider.name.slice(1),
                description: `${provider.models.length} models • ${provider.enabled ? 'Enabled' : 'Disabled'}`,
                detail: provider.priority ? `Priority: ${provider.priority}` : undefined,
                picked: provider.name === client.getCurrentProvider(),
            }));
            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: 'Select a provider',
                matchOnDescription: true,
            });
            if (selected) {
                const providerName = selected.label.toLowerCase();
                await client.setProvider(providerName);
                vscode.window.showInformationMessage(`Provider changed to ${selected.label}`);
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to change provider: ${error}`);
        }
    }));
}
function registerSessionsCommand(context, client) {
    // Sessions management command
    context.subscriptions.push(vscode.commands.registerCommand('morse.sessions', async () => {
        try {
            const sessions = await client.getSessions();
            const items = sessions.map((session) => ({
                label: session.title,
                description: new Date(session.updatedAt).toLocaleDateString(),
                detail: `Messages: ${session.messages.length} • Cost: $${session.cost?.toFixed(4) || '0.0000'}`,
            }));
            // Add option for new session
            items.unshift({
                label: '$(plus) New Session',
                description: 'Start a new chat session',
            });
            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: 'Select or create a session',
                matchOnDescription: true,
            });
            if (selected) {
                if (selected.label.includes('New Session')) {
                    const newSession = await client.createSession();
                    vscode.window.showInformationMessage(`Created new session: ${newSession.title}`);
                }
                else {
                    const selectedSession = sessions.find((s) => s.title === selected.label);
                    if (selectedSession) {
                        client.setCurrentSession(selectedSession.id);
                        vscode.window.showInformationMessage(`Switched to session: ${selected.label}`);
                    }
                }
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to manage sessions: ${error}`);
        }
    }));
}
function registerUsageCommand(context, client) {
    // Usage stats command
    context.subscriptions.push(vscode.commands.registerCommand('morse.usage', async () => {
        try {
            const metrics = client.getMetrics();
            const costBreakdown = await client.getCostBreakdown();
            const message = [
                `**Usage Statistics**`,
                ``,
                `Total Cost: $${metrics.costUSD.toFixed(4)}`,
                `Tokens Used: ${metrics.tokensUsed.toLocaleString()}`,
                `Requests: ${metrics.requestsSuccess}/${metrics.requestsTotal}`,
                `Avg Latency: ${metrics.avgLatency.toFixed(0)}ms`,
                ``,
                `**Cost by Provider**`,
            ];
            for (const [provider, cost] of Object.entries(costBreakdown.byProvider)) {
                message.push(`- ${provider}: $${cost.toFixed(4)}`);
            }
            // Show in information message
            const selection = await vscode.window.showInformationMessage(message.join('\n'), { modal: true }, 'Open Dashboard', 'Close');
            if (selection === 'Open Dashboard') {
                vscode.env.openExternal(vscode.Uri.parse('https://morse.sh/dashboard/usage'));
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to get usage: ${error}`);
        }
    }));
}
function registerSettingsCommand(context, client) {
    // Settings command
    context.subscriptions.push(vscode.commands.registerCommand('morse.settings', async () => {
        // Open VS Code settings for Morse
        await vscode.commands.executeCommand('workbench.action.openSettings', 'morse');
    }));
}
function registerSwarmCommand(context, client) {
    // Swarm command
    context.subscriptions.push(vscode.commands.registerCommand('morse.swarm', async () => {
        const swarmStatus = await client.getSwarmStatus();
        if (swarmStatus.active) {
            const selection = await vscode.window.showInformationMessage(`Swarm active with ${swarmStatus.agents} agents\nTasks: ${swarmStatus.completed}/${swarmStatus.tasks}`, { modal: true }, 'Stop Swarm', 'View Status', 'Close');
            if (selection === 'Stop Swarm') {
                await client.stopSwarm();
                vscode.window.showInformationMessage('Swarm stopped');
            }
        }
        else {
            const task = await vscode.window.showInputBox({
                prompt: 'Enter task for swarm',
                placeHolder: 'What do you want the swarm to do?',
            });
            if (task) {
                const agents = await vscode.window.showQuickPick(['2', '3', '5', '10'], {
                    placeHolder: 'Number of agents',
                });
                if (agents) {
                    await client.startSwarm(task, parseInt(agents));
                    vscode.window.showInformationMessage(`Swarm started with ${agents} agents`);
                }
            }
        }
    }));
}
function registerPluginsCommand(context, client) {
    // Plugins command
    context.subscriptions.push(vscode.commands.registerCommand('morse.plugins', async () => {
        try {
            const plugins = await client.getPlugins();
            const items = plugins.map((plugin) => ({
                label: plugin.name,
                description: plugin.enabled ? '$(check) Enabled' : '$(circle-outline) Disabled',
                detail: plugin.description,
            }));
            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: 'Select a plugin to toggle',
                matchOnDescription: true,
            });
            if (selected) {
                const selectedPlugin = plugins.find((p) => p.name === selected.label);
                if (selectedPlugin) {
                    if (selectedPlugin.enabled) {
                        await client.disablePlugin(selectedPlugin.id);
                        vscode.window.showInformationMessage(`Plugin ${selectedPlugin.name} disabled`);
                    }
                    else {
                        await client.enablePlugin(selectedPlugin.id);
                        vscode.window.showInformationMessage(`Plugin ${selectedPlugin.name} enabled`);
                    }
                }
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to manage plugins: ${error}`);
        }
    }));
}
function registerSkillsCommand(context, client) {
    // Skills command
    context.subscriptions.push(vscode.commands.registerCommand('morse.skills', async () => {
        try {
            const skills = await client.getSkills();
            const items = skills.map((skill) => ({
                label: skill.name,
                description: skill.enabled ? '$(check) Active' : '$(circle-outline) Inactive',
                detail: skill.description,
            }));
            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: 'Select a skill',
                matchOnDescription: true,
            });
            if (selected) {
                const selectedSkill = skills.find((s) => s.name === selected.label);
                if (selectedSkill) {
                    if (client.getCurrentSkill() === selectedSkill.id) {
                        await client.deselectSkill();
                        vscode.window.showInformationMessage(`Skill ${selectedSkill.name} deselected`);
                    }
                    else {
                        await client.selectSkill(selectedSkill.id);
                        vscode.window.showInformationMessage(`Skill ${selectedSkill.name} selected`);
                    }
                }
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to manage skills: ${error}`);
        }
    }));
}
//# sourceMappingURL=selectModel.js.map