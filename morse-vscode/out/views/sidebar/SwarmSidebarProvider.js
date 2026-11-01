"use strict";
/**
 * Swarm Sidebar Provider
 * Provides a tree view of swarm sessions in the sidebar
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
exports.SwarmSidebarProvider = void 0;
exports.registerSwarmSidebar = registerSwarmSidebar;
const vscode = __importStar(require("vscode"));
const client_1 = require("../../swarm/client");
class SwarmSidebarProvider {
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    swarmClient;
    currentStatus = null;
    currentSession = null;
    constructor() {
        this.swarmClient = (0, client_1.getSwarmClient)();
        // Listen for status updates
        this.swarmClient.onStatusUpdate((status) => {
            this.currentStatus = status;
            this.refresh();
        });
        // Initial load
        this.refreshData();
    }
    /**
     * Refresh the tree data
     */
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    /**
     * Refresh status and session data
     */
    async refreshData() {
        try {
            this.currentStatus = await this.swarmClient.status();
            this.currentSession = await this.swarmClient.getSession();
            this.refresh();
        }
        catch (error) {
            console.error('Failed to refresh swarm data:', error);
        }
    }
    /**
     * Get tree item
     */
    getTreeItem(element) {
        return element;
    }
    /**
     * Get children
     */
    getChildren(element) {
        if (!element) {
            return this.getRootItems();
        }
        return Promise.resolve(element.children || []);
    }
    /**
     * Get root level items
     */
    async getRootItems() {
        const items = [];
        // Status section
        const statusDesc = this.currentStatus?.active
            ? `${this.currentStatus.runningAgents}/${this.currentStatus.agents} agents`
            : 'Click to start a new swarm';
        const statusItem = new SwarmTreeItem(this.currentStatus?.active ? '🟢 Swarm Active' : '⚪ No Active Swarm', vscode.TreeItemCollapsibleState.None, 'status', statusDesc);
        statusItem.command = {
            command: 'morse.swarm.start',
            title: 'Start Swarm'
        };
        items.push(statusItem);
        // If there's an active swarm, show details
        if (this.currentStatus?.active) {
            // Task section
            const taskItem = new SwarmTreeItem('📋 Current Task', vscode.TreeItemCollapsibleState.Expanded, 'section');
            const taskDescText = this.currentStatus.task
                ? `${this.currentStatus.task.substring(0, 50)}...`
                : 'No task';
            const taskDesc = new SwarmTreeItem(this.currentStatus.task || 'No task', vscode.TreeItemCollapsibleState.None, 'task', taskDescText);
            taskDesc.command = {
                command: 'morse.swarm.status',
                title: 'View Status'
            };
            taskItem.children = [taskDesc];
            items.push(taskItem);
            // Stats section
            const statsItem = new SwarmTreeItem('📊 Statistics', vscode.TreeItemCollapsibleState.Expanded, 'section');
            const runningItem = new SwarmTreeItem(`🔄 Running: ${this.currentStatus.runningAgents}`, vscode.TreeItemCollapsibleState.None, 'stat');
            const completedItem = new SwarmTreeItem(`✅ Completed: ${this.currentStatus.completed}`, vscode.TreeItemCollapsibleState.None, 'stat');
            const failedItem = new SwarmTreeItem(`❌ Failed: ${this.currentStatus.failed}`, vscode.TreeItemCollapsibleState.None, 'stat');
            const totalItem = new SwarmTreeItem(`📝 Total Tasks: ${this.currentStatus.tasks}`, vscode.TreeItemCollapsibleState.None, 'stat');
            statsItem.children = [runningItem, completedItem, failedItem, totalItem];
            items.push(statsItem);
            // Actions section
            const actionsItem = new SwarmTreeItem('🎮 Actions', vscode.TreeItemCollapsibleState.Expanded, 'section');
            const pauseItem = new SwarmTreeItem('⏸ Pause', vscode.TreeItemCollapsibleState.None, 'action');
            pauseItem.command = {
                command: 'morse.swarm.pause',
                title: 'Pause Swarm'
            };
            const cancelItem = new SwarmTreeItem('⏹ Cancel', vscode.TreeItemCollapsibleState.None, 'action');
            cancelItem.command = {
                command: 'morse.swarm.cancel',
                title: 'Cancel Swarm'
            };
            const logsItem = new SwarmTreeItem('📜 View Logs', vscode.TreeItemCollapsibleState.None, 'action');
            logsItem.command = {
                command: 'morse.swarm.showLogs',
                title: 'Show Logs'
            };
            actionsItem.children = [pauseItem, cancelItem, logsItem];
            items.push(actionsItem);
        }
        // Quick actions section (always visible)
        const quickActions = new SwarmTreeItem('⚡ Quick Actions', vscode.TreeItemCollapsibleState.Expanded, 'section');
        const newSwarmItem = new SwarmTreeItem('🚀 New Swarm', vscode.TreeItemCollapsibleState.None, 'action');
        newSwarmItem.command = {
            command: 'morse.swarm.start',
            title: 'Start New Swarm'
        };
        const listSwarmsItem = new SwarmTreeItem('📋 List Sessions', vscode.TreeItemCollapsibleState.None, 'action');
        listSwarmsItem.command = {
            command: 'morse.swarm.list',
            title: 'List Swarm Sessions'
        };
        const configItem = new SwarmTreeItem('⚙️ Configure', vscode.TreeItemCollapsibleState.None, 'action');
        configItem.command = {
            command: 'morse.swarm.config',
            title: 'Configure Swarm'
        };
        quickActions.children = [newSwarmItem, listSwarmsItem, configItem];
        items.push(quickActions);
        return Promise.resolve(items);
    }
}
exports.SwarmSidebarProvider = SwarmSidebarProvider;
/**
 * Custom tree item for swarm
 */
class SwarmTreeItem extends vscode.TreeItem {
    label;
    collapsibleState;
    contextValue;
    itemDescription;
    children;
    constructor(label, collapsibleState, contextValue, itemDescription) {
        super(label, collapsibleState);
        this.label = label;
        this.collapsibleState = collapsibleState;
        this.contextValue = contextValue;
        this.itemDescription = itemDescription;
        this.description = itemDescription;
        this.tooltip = label;
        // Set icon based on context value
        switch (contextValue) {
            case 'status':
                this.iconPath = new vscode.ThemeIcon('pulse');
                break;
            case 'section':
                this.iconPath = new vscode.ThemeIcon('folder');
                break;
            case 'task':
                this.iconPath = new vscode.ThemeIcon('file-text');
                break;
            case 'stat':
                this.iconPath = new vscode.ThemeIcon('graph');
                break;
            case 'action':
                this.iconPath = new vscode.ThemeIcon('play');
                break;
        }
    }
}
/**
 * Register the swarm sidebar view
 */
function registerSwarmSidebar(context) {
    const provider = new SwarmSidebarProvider();
    // Register tree data provider
    context.subscriptions.push(vscode.window.registerTreeDataProvider('morse.swarm', provider));
    // Add refresh command
    context.subscriptions.push(vscode.commands.registerCommand('morse.swarm.sidebar.refresh', async () => {
        await provider.refreshData();
    }));
    // Add start command
    context.subscriptions.push(vscode.commands.registerCommand('morse.swarm.sidebar.start', async () => {
        await vscode.commands.executeCommand('morse.swarm.start');
    }));
    // Refresh on window focus
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(async () => {
        await provider.refreshData();
    }));
    // Initial refresh
    provider.refreshData();
}
//# sourceMappingURL=SwarmSidebarProvider.js.map