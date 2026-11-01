"use strict";
/**
 * Skills UI
 * Provides VS Code tree view and UI components for skills
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
exports.SkillsCommands = exports.SkillsTreeDataProvider = void 0;
exports.initializeSkillsUI = initializeSkillsUI;
const vscode = __importStar(require("vscode"));
const types_1 = require("./types");
/**
 * Skills Tree Data Provider
 * Provides tree view for skills explorer
 */
class SkillsTreeDataProvider {
    registry;
    adapter;
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    constructor(registry, adapter) {
        this.registry = registry;
        this.adapter = adapter;
        // Listen for skill changes
        this.registry.onSkillRegistered(() => {
            this._onDidChangeTreeData.fire();
        });
        this.registry.onStateChanged(() => {
            this._onDidChangeTreeData.fire();
        });
    }
    /**
     * Get tree item for an element
     */
    getTreeItem(element) {
        return element;
    }
    /**
     * Get children of an element
     */
    getChildren(element) {
        if (!element) {
            // Root: show categories
            return this.getCategoryItems();
        }
        if (element instanceof types_1.CategoryTreeItem) {
            // Category: show skills
            return element.skills.map(skill => new types_1.SkillTreeItem(skill));
        }
        if (element instanceof types_1.SkillTreeItem) {
            // Skill: show commands
            return element.skill.commands.map(cmd => {
                const item = new vscode.TreeItem(cmd.name, vscode.TreeItemCollapsibleState.None);
                item.description = cmd.description;
                item.contextValue = 'command';
                item.command = {
                    command: 'morse.skills.invokeCommand',
                    title: 'Invoke Command',
                    arguments: [element.skill.id, cmd.id]
                };
                return item;
            });
        }
        return [];
    }
    /**
     * Get category items
     */
    getCategoryItems() {
        const categories = this.registry.getCategories();
        const items = [];
        for (const [category, skills] of categories) {
            items.push(new types_1.CategoryTreeItem(category, skills));
        }
        // Sort by category name
        items.sort((a, b) => a.category.localeCompare(b.category));
        return items;
    }
    /**
     * Refresh the tree view
     */
    refresh() {
        this._onDidChangeTreeData.fire();
    }
}
exports.SkillsTreeDataProvider = SkillsTreeDataProvider;
/**
 * Skills Commands
 * Register VS Code commands for skills
 */
class SkillsCommands {
    registry;
    adapter;
    context;
    constructor(registry, adapter, context) {
        this.registry = registry;
        this.adapter = adapter;
        this.context = context;
        this.registerCommands();
    }
    /**
     * Register all skills commands
     */
    registerCommands() {
        // List all skills
        this.context.subscriptions.push(vscode.commands.registerCommand('morse.skills.list', async () => {
            await this.listSkills();
        }));
        // Invoke a skill
        this.context.subscriptions.push(vscode.commands.registerCommand('morse.skills.invoke', async (skillId) => {
            await this.invokeSkill(skillId);
        }));
        // Invoke a skill command
        this.context.subscriptions.push(vscode.commands.registerCommand('morse.skills.invokeCommand', async (skillId, commandId) => {
            await this.invokeSkillCommand(skillId, commandId);
        }));
        // Enable a skill
        this.context.subscriptions.push(vscode.commands.registerCommand('morse.skills.enable', async (skillId) => {
            await this.enableSkill(skillId);
        }));
        // Disable a skill
        this.context.subscriptions.push(vscode.commands.registerCommand('morse.skills.disable', async (skillId) => {
            await this.disableSkill(skillId);
        }));
        // Toggle skill
        this.context.subscriptions.push(vscode.commands.registerCommand('morse.skills.toggle', async (skillId) => {
            await this.toggleSkill(skillId);
        }));
        // Search skills
        this.context.subscriptions.push(vscode.commands.registerCommand('morse.skills.search', async () => {
            await this.searchSkills();
        }));
        // Show skill details
        this.context.subscriptions.push(vscode.commands.registerCommand('morse.skills.showDetails', async (skillId) => {
            await this.showSkillDetails(skillId);
        }));
        // Reload skills
        this.context.subscriptions.push(vscode.commands.registerCommand('morse.skills.reload', async () => {
            await this.reloadSkills();
        }));
        console.log('[Skills] Commands registered');
    }
    /**
     * List all skills
     */
    async listSkills() {
        const skills = this.registry.getEnabledSkills();
        if (skills.length === 0) {
            vscode.window.showInformationMessage('No skills loaded');
            return;
        }
        const items = skills.map(skill => ({
            label: `${skill.metadata.name} (${skill.category})`,
            description: skill.metadata.description.substring(0, 80),
            skill
        }));
        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select a skill to invoke',
            matchOnDescription: true
        });
        if (selected) {
            await this.invokeSkill(selected.skill.id);
        }
    }
    /**
     * Invoke a skill
     */
    async invokeSkill(skillId) {
        let targetSkill;
        if (skillId) {
            targetSkill = this.registry.getSkill(skillId);
        }
        else {
            // Show skill picker
            const skills = this.registry.getEnabledSkills();
            const items = skills.map(skill => ({
                label: skill.metadata.name,
                description: skill.category,
                skill
            }));
            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: 'Select a skill to invoke'
            });
            targetSkill = selected?.skill;
        }
        if (!targetSkill) {
            return;
        }
        // Build context
        const context = this.buildInvocationContext();
        // Invoke the skill
        const result = await this.adapter.invoke(targetSkill.id, context);
        if (!result.success) {
            vscode.window.showErrorMessage(result.error || 'Failed to invoke skill');
            return;
        }
        vscode.window.showInformationMessage(`Skill "${targetSkill.metadata.name}" invoked`);
    }
    /**
     * Invoke a skill command
     */
    async invokeSkillCommand(skillId, commandId) {
        const skill = this.registry.getSkill(skillId);
        if (!skill) {
            vscode.window.showErrorMessage(`Skill not found: ${skillId}`);
            return;
        }
        let targetCommand = skill.commands[0];
        if (commandId) {
            targetCommand = skill.commands.find(c => c.id === commandId) || skill.commands[0];
        }
        else if (skill.commands.length > 1) {
            // Show command picker
            const items = skill.commands.map(cmd => ({
                label: cmd.name,
                description: cmd.description,
                command: cmd
            }));
            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: 'Select a command'
            });
            targetCommand = selected?.command || targetCommand;
        }
        const context = this.buildInvocationContext();
        const result = await this.adapter.invokeCommand(skill.id, targetCommand.id, context);
        if (!result.success) {
            vscode.window.showErrorMessage(result.error || 'Failed to invoke command');
            return;
        }
        vscode.window.showInformationMessage(`Command "${targetCommand.name}" invoked`);
    }
    /**
     * Enable a skill
     */
    async enableSkill(skillId) {
        const success = this.registry.enableSkill(skillId);
        if (success) {
            const skill = this.registry.getSkill(skillId);
            vscode.window.showInformationMessage(`Skill "${skill?.metadata.name}" enabled`);
        }
    }
    /**
     * Disable a skill
     */
    async disableSkill(skillId) {
        const success = this.registry.disableSkill(skillId);
        if (success) {
            const skill = this.registry.getSkill(skillId);
            vscode.window.showInformationMessage(`Skill "${skill?.metadata.name}" disabled`);
        }
    }
    /**
     * Toggle a skill
     */
    async toggleSkill(skillId) {
        const wasEnabled = this.registry.isSkillEnabled(skillId);
        this.registry.toggleSkill(skillId);
        const skill = this.registry.getSkill(skillId);
        const status = wasEnabled ? 'disabled' : 'enabled';
        vscode.window.showInformationMessage(`Skill "${skill?.metadata.name}" ${status}`);
    }
    /**
     * Search skills
     */
    async searchSkills() {
        const query = await vscode.window.showInputBox({
            prompt: 'Search skills',
            placeHolder: 'Enter a search term...'
        });
        if (!query) {
            return;
        }
        const results = this.registry.searchSkills(query);
        if (results.length === 0) {
            vscode.window.showInformationMessage(`No skills found matching: ${query}`);
            return;
        }
        const items = results.slice(0, 10).map(skill => ({
            label: skill.metadata.name,
            description: skill.category,
            skill
        }));
        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select a skill'
        });
        if (selected) {
            await this.invokeSkill(selected.skill.id);
        }
    }
    /**
     * Show skill details
     */
    async showSkillDetails(skillId) {
        const skill = this.registry.getSkill(skillId);
        if (!skill) {
            vscode.window.showErrorMessage(`Skill not found: ${skillId}`);
            return;
        }
        const panel = vscode.window.createWebviewPanel('skillDetails', skill.metadata.name, vscode.ViewColumn.One, {});
        panel.webview.html = this.generateSkillDetailsHtml(skill);
    }
    /**
     * Generate HTML for skill details
     */
    generateSkillDetailsHtml(skill) {
        return `
<!DOCTYPE html>
<html>
<head>
	<style>
		body { font-family: var(--vscode-font-family); padding: 20px; }
		h1 { color: var(--vscode-editor-foreground); }
		.description { color: var(--vscode-editor-foreground); margin-bottom: 20px; }
		.meta { color: var(--vscode-editorComment-foreground); font-size: 0.9em; }
		.commands { margin-top: 20px; }
		.command { 
			background: var(--vscode-editor-background); 
			padding: 10px; 
			margin: 5px 0; 
			border-radius: 4px;
		}
		.command-name { font-weight: bold; color: var(--vscode-editor-foreground); }
		.command-desc { color: var(--vscode-editorComment-foreground); }
		pre { 
			background: var(--vscode-editor-background); 
			padding: 10px; 
			overflow: auto;
		}
	</style>
</head>
<body>
	<h1>${skill.metadata.name}</h1>
	<p class="description">${skill.metadata.description}</p>
	<div class="meta">
		<p><strong>Category:</strong> ${skill.category}</p>
		<p><strong>Risk:</strong> ${skill.metadata.risk || 'unknown'}</p>
		<p><strong>Status:</strong> ${skill.enabled ? 'Enabled' : 'Disabled'}</p>
		${skill.metadata.version ? `<p><strong>Version:</strong> ${skill.metadata.version}</p>` : ''}
		${skill.metadata.author ? `<p><strong>Author:</strong> ${skill.metadata.author}</p>` : ''}
	</div>
	${skill.commands.length > 0 ? `
	<div class="commands">
		<h2>Commands</h2>
		${skill.commands.map(cmd => `
			<div class="command">
				<span class="command-name">${cmd.name}</span>
				<p class="command-desc">${cmd.description}</p>
			</div>
		`).join('')}
	</div>
	` : ''}
	<h2>Content</h2>
	<pre>${skill.content}</pre>
</body>
</html>`;
    }
    /**
     * Reload skills
     */
    async reloadSkills() {
        const loader = this.registry.getLoader();
        loader.clearCache();
        await this.registry.loadSkills();
        vscode.window.showInformationMessage('Skills reloaded');
    }
    /**
     * Build invocation context from current VS Code state
     */
    buildInvocationContext() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        const activeEditor = vscode.window.activeTextEditor;
        return {
            skillId: '',
            workspaceFolder: workspaceFolders?.[0],
            activeEditor,
            selection: activeEditor?.selection,
            context: this.context
        };
    }
}
exports.SkillsCommands = SkillsCommands;
/**
 * Initialize skills UI
 */
function initializeSkillsUI(registry, adapter, context) {
    // Create tree data provider
    const treeProvider = new SkillsTreeDataProvider(registry, adapter);
    // Register tree view
    vscode.window.registerTreeDataProvider('morseSkills', treeProvider);
    // Create commands
    const commands = new SkillsCommands(registry, adapter, context);
    return { treeProvider, commands };
}
//# sourceMappingURL=ui.js.map