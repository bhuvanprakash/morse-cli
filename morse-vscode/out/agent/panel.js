"use strict";
/**
 * Agent Panel for Morse VS Code Extension
 * Webview panel for agent status, task queue, and results
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
exports.AgentPanel = void 0;
exports.getAgentPanel = getAgentPanel;
exports.showAgentPanel = showAgentPanel;
exports.hideAgentPanel = hideAgentPanel;
const vscode = __importStar(require("vscode"));
const types_1 = require("./types");
const service_1 = require("./service");
// ==================== Singleton Instance ====================
let agentPanelInstance = null;
/**
 * Gets the singleton agent panel instance
 */
function getAgentPanel() {
    if (!agentPanelInstance) {
        agentPanelInstance = new AgentPanel();
    }
    return agentPanelInstance;
}
/**
 * Shows the agent panel
 */
function showAgentPanel() {
    getAgentPanel().show();
}
/**
 * Hides the agent panel
 */
function hideAgentPanel() {
    getAgentPanel().hide();
}
// ==================== Agent Panel ====================
/**
 * AgentPanel displays agent status and controls in a webview
 */
class AgentPanel {
    panel = null;
    service;
    context = null;
    refreshInterval = null;
    constructor() {
        this.service = (0, service_1.getAgentService)();
    }
    /**
     * Initializes the panel with the extension context
     */
    init(context) {
        this.context = context;
        // Register event listeners
        this.service.onEvent('*', () => {
            this.refresh();
        });
        // Start periodic refresh
        this.startRefreshInterval();
    }
    /**
     * Creates or shows the panel
     */
    show() {
        if (this.panel) {
            this.panel.reveal(vscode.ViewColumn.Two);
            return;
        }
        if (!this.context) {
            console.error('[Agent Panel] Context not initialized');
            return;
        }
        // Create the panel
        this.panel = vscode.window.createWebviewPanel('morseAgent', 'Morse Agent', vscode.ViewColumn.Two, {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [
                vscode.Uri.file(path.join(this.context.extensionPath, 'webview')),
            ],
        });
        // Set HTML content
        this.panel.webview.html = this.getHtml();
        // Handle messages from webview
        this.panel.webview.onDidReceiveMessage((message) => {
            this.handleMessage(message);
        });
        // Handle panel dispose
        this.panel.onDidDispose(() => {
            this.panel = null;
        });
        // Initial data refresh
        this.refresh();
    }
    /**
     * Hides the panel
     */
    hide() {
        if (this.panel) {
            this.panel.dispose();
            this.panel = null;
        }
    }
    /**
     * Refreshes the panel with current data
     */
    refresh() {
        if (!this.panel) {
            return;
        }
        const status = this.service.getSystemStatus();
        const agents = this.service.getAllAgents();
        const tasks = this.service.getAllTasks();
        this.panel.webview.postMessage({
            type: 'refresh',
            payload: {
                status,
                agents: agents.map(a => this.serializeAgent(a)),
                tasks: tasks.map(t => this.serializeTask(t)),
            },
        });
    }
    /**
     * Starts the periodic refresh interval
     */
    startRefreshInterval() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        this.refreshInterval = setInterval(() => {
            this.refresh();
        }, 2000);
    }
    /**
     * Stops the periodic refresh interval
     */
    stopRefreshInterval() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }
    /**
     * Handles messages from the webview
     */
    async handleMessage(message) {
        switch (message.type) {
            case 'startAgent': {
                const { name, task, config } = message.payload;
                try {
                    const agent = await this.service.createAgent(name, 'autonomous', config);
                    await this.service.startAgent(agent.id, task);
                    vscode.window.showInformationMessage(`Agent "${name}" started`);
                }
                catch (error) {
                    vscode.window.showErrorMessage(`Failed to start agent: ${error}`);
                }
                break;
            }
            case 'stopAgent': {
                const { agentId } = message.payload;
                try {
                    await this.service.stopAgent(agentId);
                    vscode.window.showInformationMessage('Agent stopped');
                }
                catch (error) {
                    vscode.window.showErrorMessage(`Failed to stop agent: ${error}`);
                }
                break;
            }
            case 'pauseAgent': {
                const { agentId } = message.payload;
                try {
                    await this.service.pauseAgent(agentId);
                }
                catch (error) {
                    vscode.window.showErrorMessage(`Failed to pause agent: ${error}`);
                }
                break;
            }
            case 'resumeAgent': {
                const { agentId } = message.payload;
                try {
                    await this.service.resumeAgent(agentId);
                }
                catch (error) {
                    vscode.window.showErrorMessage(`Failed to resume agent: ${error}`);
                }
                break;
            }
            case 'deleteAgent': {
                const { agentId } = message.payload;
                try {
                    this.service.deleteAgent(agentId);
                    vscode.window.showInformationMessage('Agent deleted');
                }
                catch (error) {
                    vscode.window.showErrorMessage(`Failed to delete agent: ${error}`);
                }
                break;
            }
            case 'openOutput': {
                this.service.getOutputChannel().show();
                break;
            }
            case 'refresh': {
                this.refresh();
                break;
            }
            default:
                console.log('[Agent Panel] Unknown message type:', message.type);
        }
    }
    /**
     * Serializes an agent for the webview
     */
    serializeAgent(agent) {
        return {
            id: agent.id,
            name: agent.name,
            type: agent.type,
            status: agent.status,
            statusColor: (0, types_1.getAgentStatusColor)(agent.status),
            statusIcon: (0, types_1.getAgentStatusIcon)(agent.status),
            config: agent.config,
            currentTask: agent.currentTask,
            progress: agent.progress,
            error: agent.error,
            createdAt: agent.createdAt,
            startedAt: agent.startedAt,
            completedAt: agent.completedAt,
        };
    }
    /**
     * Serializes a task for the webview
     */
    serializeTask(task) {
        return {
            id: task.id,
            task: task.task,
            agentId: task.agentId,
            status: task.status,
            priority: task.priority,
            createdAt: task.createdAt,
            startedAt: task.startedAt,
            completedAt: task.completedAt,
            error: task.error,
        };
    }
    /**
     * Gets the HTML content for the webview
     */
    getHtml() {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Morse Agent</title>
    <style>
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            font-size: 13px;
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 16px;
        }
        
        h1 {
            font-size: 18px;
            margin-bottom: 16px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        h2 {
            font-size: 14px;
            margin: 16px 0 8px;
            color: var(--vscode-descriptionForeground);
        }
        
        .card {
            background-color: var(--vscode-editorWidget-background);
            border: 1px solid var(--vscode-editorWidget-border);
            border-radius: 4px;
            padding: 12px;
            margin-bottom: 8px;
        }
        
        .status-bar {
            display: flex;
            gap: 16px;
            margin-bottom: 16px;
        }
        
        .status-item {
            display: flex;
            align-items: center;
            gap: 4px;
        }
        
        .status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
        }
        
        .status-dot.active {
            background-color: #4caf50;
        }
        
        .status-dot.inactive {
            background-color: #9e9e9e;
        }
        
        .agent-list {
            max-height: 300px;
            overflow-y: auto;
        }
        
        .agent-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 8px;
            border-bottom: 1px solid var(--vscode-editorWidget-border);
        }
        
        .agent-item:last-child {
            border-bottom: none;
        }
        
        .agent-info {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .agent-name {
            font-weight: 500;
        }
        
        .agent-type {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            background-color: var(--vscode-badge-background);
            padding: 2px 6px;
            border-radius: 3px;
        }
        
        .progress-bar {
            width: 100px;
            height: 4px;
            background-color: var(--vscode-editorWidget-border);
            border-radius: 2px;
            overflow: hidden;
        }
        
        .progress-fill {
            height: 100%;
            background-color: var(--vscode-progressBar-background);
            transition: width 0.3s ease;
        }
        
        .btn {
            padding: 4px 12px;
            border: none;
            border-radius: 3px;
            cursor: pointer;
            font-size: 12px;
        }
        
        .btn-primary {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        
        .btn-primary:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        
        .btn-secondary {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        
        .btn-danger {
            background-color: #f44336;
            color: white;
        }
        
        .btn-danger:hover {
            background-color: #d32f2f;
        }
        
        .input-group {
            margin-bottom: 12px;
        }
        
        .input-group label {
            display: block;
            margin-bottom: 4px;
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }
        
        input, select, textarea {
            width: 100%;
            padding: 6px 8px;
            border: 1px solid var(--vscode-input-border);
            border-radius: 3px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            font-size: 13px;
        }
        
        textarea {
            min-height: 60px;
            resize: vertical;
        }
        
        .task-list {
            max-height: 200px;
            overflow-y: auto;
        }
        
        .task-item {
            padding: 6px 8px;
            border-bottom: 1px solid var(--vscode-editorWidget-border);
            font-size: 12px;
        }
        
        .task-item:last-child {
            border-bottom: none;
        }
        
        .empty-state {
            text-align: center;
            padding: 32px;
            color: var(--vscode-descriptionForeground);
        }
        
        .spinner {
            display: inline-block;
            width: 16px;
            height: 16px;
            border: 2px solid var(--vscode-progressBar-background);
            border-top-color: transparent;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        
        .actions {
            display: flex;
            gap: 8px;
            margin-top: 8px;
        }
    </style>
</head>
<body>
    <h1>
        <span class="status-dot" id="statusDot"></span>
        Morse Agent
    </h1>
    
    <div class="status-bar">
        <div class="status-item">
            <strong>Status:</strong>
            <span id="statusText">Inactive</span>
        </div>
        <div class="status-item">
            <strong>Agents:</strong>
            <span id="agentCount">0</span>
        </div>
        <div class="status-item">
            <strong>Running:</strong>
            <span id="runningCount">0</span>
        </div>
        <div class="status-item">
            <strong>Tasks:</strong>
            <span id="taskCount">0</span>
        </div>
    </div>
    
    <div class="card">
        <h2>Start New Agent</h2>
        <div class="input-group">
            <label>Agent Name</label>
            <input type="text" id="agentName" placeholder="My Agent">
        </div>
        <div class="input-group">
            <label>Task</label>
            <textarea id="agentTask" placeholder="What should the agent do?"></textarea>
        </div>
        <div class="input-group">
            <label>Max Iterations</label>
            <input type="number" id="maxIterations" value="20" min="1" max="100">
        </div>
        <div class="input-group">
            <label>
                <input type="checkbox" id="autoApprove"> Auto-approve tool calls
            </label>
        </div>
        <div class="actions">
            <button class="btn btn-primary" id="startBtn">Start Agent</button>
            <button class="btn btn-secondary" id="outputBtn">View Output</button>
            <button class="btn btn-secondary" id="refreshBtn">Refresh</button>
        </div>
    </div>
    
    <h2>Active Agents</h2>
    <div class="card">
        <div class="agent-list" id="agentList">
            <div class="empty-state">No agents</div>
        </div>
    </div>
    
    <h2>Task Queue</h2>
    <div class="card">
        <div class="task-list" id="taskList">
            <div class="empty-state">No tasks</div>
        </div>
    </div>
    
    <script>
        const vscode = acquireVsCodeApi();
        
        let agents = [];
        let tasks = [];
        
        // Event handlers
        document.getElementById('startBtn').addEventListener('click', () => {
            const name = document.getElementById('agentName').value || 'Agent';
            const task = document.getElementById('agentTask').value;
            
            if (!task) {
                alert('Please enter a task');
                return;
            }
            
            const maxIterations = parseInt(document.getElementById('maxIterations').value) || 20;
            const autoApprove = document.getElementById('autoApprove').checked;
            
            vscode.postMessage({
                type: 'startAgent',
                payload: {
                    name,
                    task,
                    config: {
                        maxIterations,
                        autoApprove
                    }
                }
            });
            
            // Clear inputs
            document.getElementById('agentTask').value = '';
        });
        
        document.getElementById('outputBtn').addEventListener('click', () => {
            vscode.postMessage({ type: 'openOutput' });
        });
        
        document.getElementById('refreshBtn').addEventListener('click', () => {
            vscode.postMessage({ type: 'refresh' });
        });
        
        // Handle messages from extension
        window.addEventListener('message', (event) => {
            const message = event.data;
            
            if (message.type === 'refresh') {
                const { status, agents: agentList, tasks: taskList } = message.payload;
                agents = agentList;
                tasks = taskList;
                render(status);
            }
        });
        
        function render(status) {
            // Update status bar
            const statusDot = document.getElementById('statusDot');
            const statusText = document.getElementById('statusText');
            
            if (status.active) {
                statusDot.className = 'status-dot active';
                statusText.textContent = 'Active';
            } else {
                statusDot.className = 'status-dot inactive';
                statusText.textContent = 'Inactive';
            }
            
            document.getElementById('agentCount').textContent = status.totalAgents;
            document.getElementById('runningCount').textContent = status.runningAgents;
            document.getElementById('taskCount').textContent = status.totalTasks;
            
            // Render agents
            const agentList = document.getElementById('agentList');
            if (agents.length === 0) {
                agentList.innerHTML = '<div class="empty-state">No agents</div>';
            } else {
                agentList.innerHTML = agents.map(agent => \`
                    <div class="agent-item">
                        <div class="agent-info">
                            <span class="agent-status-icon">\${agent.status === 'running' ? '⏳' : '⏸️'}</span>
                            <span class="agent-name">\${agent.name}</span>
                            <span class="agent-type">\${agent.type}</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: \${agent.progress}%"></div>
                        </div>
                        <div class="actions">
                            \${agent.status === 'running' ? \`
                                <button class="btn btn-secondary" onclick="stopAgent('\${agent.id}')">Stop</button>
                                <button class="btn btn-secondary" onclick="pauseAgent('\${agent.id}')">Pause</button>
                            \` : ''}
                            \${agent.status === 'paused' ? \`
                                <button class="btn btn-primary" onclick="resumeAgent('\${agent.id}')">Resume</button>
                            \` : ''}
                            <button class="btn btn-danger" onclick="deleteAgent('\${agent.id}')">Delete</button>
                        </div>
                    </div>
                \`).join('');
            }
            
            // Render tasks
            const taskList = document.getElementById('taskList');
            if (tasks.length === 0) {
                taskList.innerHTML = '<div class="empty-state">No tasks</div>';
            } else {
                taskList.innerHTML = tasks.map(task => \`
                    <div class="task-item">
                        <strong>\${task.status}</strong>: \${task.task.substring(0, 50)}\${task.task.length > 50 ? '...' : ''}
                    </div>
                \`).join('');
            }
        }
        
        function stopAgent(agentId) {
            vscode.postMessage({ type: 'stopAgent', payload: { agentId } });
        }
        
        function pauseAgent(agentId) {
            vscode.postMessage({ type: 'pauseAgent', payload: { agentId } });
        }
        
        function resumeAgent(agentId) {
            vscode.postMessage({ type: 'resumeAgent', payload: { agentId } });
        }
        
        function deleteAgent(agentId) {
            vscode.postMessage({ type: 'deleteAgent', payload: { agentId } });
        }
        
        // Initial render request
        vscode.postMessage({ type: 'refresh' });
    </script>
</body>
</html>`;
    }
    /**
     * Disposes of the panel
     */
    dispose() {
        this.stopRefreshInterval();
        if (this.panel) {
            this.panel.dispose();
            this.panel = null;
        }
    }
}
exports.AgentPanel = AgentPanel;
// Import path for localResourceRoots
const path = __importStar(require("path"));
//# sourceMappingURL=panel.js.map