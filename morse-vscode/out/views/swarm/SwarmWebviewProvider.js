"use strict";
/**
 * Swarm Webview Provider
 * Provides a webview panel for visualizing and managing swarm agents
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SwarmWebviewProvider = void 0;
const client_1 = require("../../swarm/client");
class SwarmWebviewProvider {
    context;
    static viewType = 'morse.swarmView';
    _view;
    swarmClient;
    statusInterval = null;
    constructor(context) {
        this.context = context;
        this.swarmClient = (0, client_1.getSwarmClient)();
        // Listen for status updates
        this.swarmClient.onStatusUpdate((status) => {
            this.updateView(status);
        });
    }
    /**
     * Resolve the webview
     */
    resolveWebviewView(webviewView, _context, _token) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [],
        };
        webviewView.webview.html = this.getHtml();
        // Set up message handler
        webviewView.webview.onDidReceiveMessage(async (message) => {
            await this.handleMessage(message);
        });
        // Start polling for updates
        this.startPolling();
    }
    /**
     * Handle messages from webview
     */
    async handleMessage(message) {
        switch (message.command) {
            case 'getStatus':
                const status = await this.swarmClient.status();
                this.sendMessage({ command: 'status', data: status });
                break;
            case 'startSwarm':
                try {
                    const { task, agents } = message;
                    await this.swarmClient.create(task, agents);
                    this.sendMessage({ command: 'started' });
                }
                catch (error) {
                    this.sendMessage({ command: 'error', data: String(error) });
                }
                break;
            case 'pauseSwarm':
                try {
                    await this.swarmClient.pause();
                    this.sendMessage({ command: 'paused' });
                }
                catch (error) {
                    this.sendMessage({ command: 'error', data: String(error) });
                }
                break;
            case 'resumeSwarm':
                try {
                    await this.swarmClient.resume();
                    this.sendMessage({ command: 'resumed' });
                }
                catch (error) {
                    this.sendMessage({ command: 'error', data: String(error) });
                }
                break;
            case 'cancelSwarm':
                try {
                    await this.swarmClient.cancel();
                    this.sendMessage({ command: 'cancelled' });
                }
                catch (error) {
                    this.sendMessage({ command: 'error', data: String(error) });
                }
                break;
            case 'showLogs':
                this.swarmClient.getOutputChannel().show();
                break;
            case 'getResults':
                const results = await this.swarmClient.results();
                this.sendMessage({ command: 'results', data: results });
                break;
        }
    }
    /**
     * Send message to webview
     */
    sendMessage(message) {
        if (this._view) {
            this._view.webview.postMessage(message);
        }
    }
    /**
     * Update the view with current status
     */
    async updateView(status) {
        this.sendMessage({ command: 'status', data: status });
    }
    /**
     * Start polling for status updates
     */
    startPolling() {
        this.stopPolling();
        this.statusInterval = setInterval(async () => {
            const status = await this.swarmClient.status();
            this.sendMessage({ command: 'status', data: status });
        }, 3000);
    }
    /**
     * Stop polling
     */
    stopPolling() {
        if (this.statusInterval) {
            clearInterval(this.statusInterval);
            this.statusInterval = null;
        }
    }
    /**
     * Get the HTML for the webview
     */
    getHtml() {
        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            padding: 16px;
            background: transparent;
            color: var(--vscode-foreground);
            font-size: 13px;
        }
        
        .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 16px;
            padding-bottom: 12px;
            border-bottom: 1px solid var(--vscode-activityBarBadge-background);
        }
        
        .header h2 {
            font-size: 16px;
            font-weight: 600;
        }
        
        .status-badge {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 500;
            text-transform: uppercase;
        }
        
        .status-badge.active {
            background: #4caf50;
            color: white;
        }
        
        .status-badge.inactive {
            background: #757575;
            color: white;
        }
        
        .status-badge.paused {
            background: #ff9800;
            color: white;
        }
        
        .task-section {
            margin-bottom: 16px;
        }
        
        .task-section h3 {
            font-size: 12px;
            text-transform: uppercase;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 8px;
        }
        
        .task-description {
            background: var(--vscode-editor-background);
            padding: 12px;
            border-radius: 4px;
            border: 1px solid var(--vscode-activityBarBadge-background);
            font-family: 'Consolas', 'Courier New', monospace;
            font-size: 12px;
            white-space: pre-wrap;
            word-break: break-word;
        }
        
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 12px;
            margin-bottom: 16px;
        }
        
        .stat-card {
            background: var(--vscode-editor-background);
            padding: 12px;
            border-radius: 4px;
            border: 1px solid var(--vscode-activityBarBadge-background);
        }
        
        .stat-value {
            font-size: 24px;
            font-weight: 600;
            color: var(--vscode-activityBarBadge-background);
        }
        
        .stat-label {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            text-transform: uppercase;
            margin-top: 4px;
        }
        
        .agents-section {
            margin-bottom: 16px;
        }
        
        .agent-card {
            background: var(--vscode-editor-background);
            padding: 12px;
            border-radius: 4px;
            border: 1px solid var(--vscode-activityBarBadge-background);
            margin-bottom: 8px;
        }
        
        .agent-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 8px;
        }
        
        .agent-name {
            font-weight: 600;
            font-size: 13px;
        }
        
        .agent-status {
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 10px;
            text-transform: uppercase;
        }
        
        .agent-status.running {
            background: #2196f3;
            color: white;
        }
        
        .agent-status.completed {
            background: #4caf50;
            color: white;
        }
        
        .agent-status.failed {
            background: #f44336;
            color: white;
        }
        
        .agent-status.idle {
            background: #9e9e9e;
            color: white;
        }
        
        .agent-status.paused {
            background: #ff9800;
            color: white;
        }
        
        .progress-bar {
            height: 4px;
            background: var(--vscode-activityBarBadge-background);
            border-radius: 2px;
            overflow: hidden;
            margin-top: 8px;
        }
        
        .progress-fill {
            height: 100%;
            background: var(--vscode-activityBarBadge-background);
            transition: width 0.3s ease;
        }
        
        .progress-fill.completed {
            background: #4caf50;
        }
        
        .progress-fill.failed {
            background: #f44336;
        }
        
        .actions {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
            margin-bottom: 16px;
        }
        
        button {
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 500;
            transition: all 0.2s ease;
        }
        
        button:hover {
            opacity: 0.9;
        }
        
        button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        
        .btn-primary {
            background: var(--vscode-activityBarBadge-background);
            color: white;
        }
        
        .btn-secondary {
            background: var(--vscode-editor-background);
            color: var(--vscode-foreground);
            border: 1px solid var(--vscode-activityBarBadge-background);
        }
        
        .btn-danger {
            background: #f44336;
            color: white;
        }
        
        .btn-success {
            background: #4caf50;
            color: white;
        }
        
        .btn-warning {
            background: #ff9800;
            color: white;
        }
        
        .empty-state {
            text-align: center;
            padding: 32px;
            color: var(--vscode-descriptionForeground);
        }
        
        .empty-state-icon {
            font-size: 48px;
            margin-bottom: 16px;
            opacity: 0.5;
        }
        
        .logs-link {
            color: var(--vscode-textLink-foreground);
            cursor: pointer;
            text-decoration: underline;
            font-size: 12px;
        }
        
        .input-group {
            margin-bottom: 12px;
        }
        
        .input-group label {
            display: block;
            font-size: 11px;
            text-transform: uppercase;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 4px;
        }
        
        .input-group input, .input-group select {
            width: 100%;
            padding: 8px;
            border: 1px solid var(--vscode-activityBarBadge-background);
            border-radius: 4px;
            background: var(--vscode-editor-background);
            color: var(--vscode-foreground);
            font-size: 13px;
        }
        
        .input-group input:focus, .input-group select:focus {
            outline: none;
            border-color: var(--vscode-activityBarBadge-background);
        }
    </style>
</head>
<body>
    <div id="app">
        <div class="header">
            <h2>🧠 Swarm</h2>
            <span id="statusBadge" class="status-badge inactive">Inactive</span>
        </div>
        
        <div id="startForm" style="display: none;">
            <div class="input-group">
                <label>Task Description</label>
                <input type="text" id="taskInput" placeholder="What should the swarm do?">
            </div>
            <div class="input-group">
                <label>Number of Agents</label>
                <select id="agentsSelect">
                    <option value="2">2 Agents</option>
                    <option value="3" selected>3 Agents</option>
                    <option value="5">5 Agents</option>
                    <option value="10">10 Agents</option>
                </select>
            </div>
            <div class="actions">
                <button class="btn-primary" onclick="startSwarm()">Start Swarm</button>
                <button class="btn-secondary" onclick="showIdleState()">Cancel</button>
            </div>
        </div>
        
        <div id="activeState" style="display: none;">
            <div class="task-section">
                <h3>Current Task</h3>
                <div id="taskDescription" class="task-description">-</div>
            </div>
            
            <div class="stats-grid">
                <div class="stat-card">
                    <div id="agentsCount" class="stat-value">0</div>
                    <div class="stat-label">Total Agents</div>
                </div>
                <div class="stat-card">
                    <div id="runningAgents" class="stat-value">0</div>
                    <div class="stat-label">Running</div>
                </div>
                <div class="stat-card">
                    <div id="completedTasks" class="stat-value">0</div>
                    <div class="stat-label">Completed</div>
                </div>
                <div class="stat-card">
                    <div id="failedTasks" class="stat-value">0</div>
                    <div class="stat-label">Failed</div>
                </div>
            </div>
            
            <div class="actions">
                <button id="pauseBtn" class="btn-warning" onclick="pauseSwarm()">⏸ Pause</button>
                <button id="resumeBtn" class="btn-success" onclick="resumeSwarm()" style="display:none;">▶ Resume</button>
                <button class="btn-danger" onclick="cancelSwarm()">⏹ Cancel</button>
                <button class="btn-secondary" onclick="showLogs()">📋 Logs</button>
            </div>
        </div>
        
        <div id="idleState">
            <div class="empty-state">
                <div class="empty-state-icon">🧠</div>
                <h3>No Active Swarm</h3>
                <p style="margin-bottom: 16px;">Start a swarm to run multiple agents in parallel</p>
                <button class="btn-primary" onclick="showStartForm()">Start Swarm</button>
            </div>
        </div>
        
        <div style="margin-top: 16px; text-align: center;">
            <span class="logs-link" onclick="showLogs()">View Full Logs</span>
        </div>
    </div>
    
    <script>
        const vscode = acquireVsCodeApi();
        
        let currentStatus = null;
        
        function showStartForm() {
            document.getElementById('idleState').style.display = 'none';
            document.getElementById('startForm').style.display = 'block';
            document.getElementById('activeState').style.display = 'none';
        }
        
        function showIdleState() {
            document.getElementById('idleState').style.display = 'block';
            document.getElementById('startForm').style.display = 'none';
            document.getElementById('activeState').style.display = 'none';
        }
        
        function showActiveState() {
            document.getElementById('idleState').style.display = 'none';
            document.getElementById('startForm').style.display = 'none';
            document.getElementById('activeState').style.display = 'block';
        }
        
        function updateUI(status) {
            currentStatus = status;
            
            if (status.active) {
                showActiveState();
                
                const badge = document.getElementById('statusBadge');
                badge.textContent = 'Active';
                badge.className = 'status-badge active';
                
                document.getElementById('taskDescription').textContent = status.task || '-';
                document.getElementById('agentsCount').textContent = status.agents || 0;
                document.getElementById('runningAgents').textContent = status.runningAgents || 0;
                document.getElementById('completedTasks').textContent = status.completed || 0;
                document.getElementById('failedTasks').textContent = status.failed || 0;
                
                // Show pause/resume buttons based on state
                // Note: Would need more state tracking for proper pause/resume UI
            } else {
                showIdleState();
                
                const badge = document.getElementById('statusBadge');
                badge.textContent = 'Inactive';
                badge.className = 'status-badge inactive';
            }
        }
        
        function startSwarm() {
            const task = document.getElementById('taskInput').value;
            const agents = parseInt(document.getElementById('agentsSelect').value);
            
            if (!task.trim()) {
                alert('Please enter a task description');
                return;
            }
            
            vscode.postMessage({
                command: 'startSwarm',
                task: task,
                agents: agents
            });
        }
        
        function pauseSwarm() {
            vscode.postMessage({ command: 'pauseSwarm' });
        }
        
        function resumeSwarm() {
            vscode.postMessage({ command: 'resumeSwarm' });
        }
        
        function cancelSwarm() {
            if (confirm('Are you sure you want to cancel the swarm?')) {
                vscode.postMessage({ command: 'cancelSwarm' });
            }
        }
        
        function showLogs() {
            vscode.postMessage({ command: 'showLogs' });
        }
        
        // Listen for messages from extension
        window.addEventListener('message', (event) => {
            const message = event.data;
            
            if (message.command === 'status') {
                updateUI(message.data);
            } else if (message.command === 'error') {
                alert('Error: ' + message.data);
            }
        });
        
        // Get initial status
        vscode.postMessage({ command: 'getStatus' });
    </script>
</body>
</html>`;
    }
    /**
     * Reveal the webview
     */
    reveal() {
        if (this._view) {
            this._view.show();
        }
    }
    /**
     * Dispose the provider
     */
    dispose() {
        this.stopPolling();
    }
}
exports.SwarmWebviewProvider = SwarmWebviewProvider;
//# sourceMappingURL=SwarmWebviewProvider.js.map