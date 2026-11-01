"use strict";
/**
 * Graph Commands
 * VS Code commands for graph operations
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
exports.GraphCommands = void 0;
exports.createGraphCommands = createGraphCommands;
exports.registerGraphCommands = registerGraphCommands;
const vscode = __importStar(require("vscode"));
const service_1 = require("./service");
const panel_1 = require("./panel");
/**
 * Graph command handlers
 */
class GraphCommands {
    context;
    client;
    graphService;
    graphPanel = null;
    graphConfig;
    constructor(context, client, config) {
        this.context = context;
        this.client = client;
        this.graphConfig = {
            depth: 3,
            includeExternal: false,
            format: 'mermaid',
            includeTests: false,
            extensions: ['.ts', '.tsx', '.js', '.jsx', '.go', '.py', '.java', '.rs'],
            excludePatterns: ['node_modules', '.git', 'dist', 'build', 'coverage'],
            ...config,
        };
        this.graphService = (0, service_1.createGraphService)(client, this.graphConfig);
    }
    /**
     * Initialize graph commands
     */
    async initialize() {
        await this.graphService.initialize();
    }
    /**
     * Register all graph commands
     */
    register() {
        // Open graph panel
        this.context.subscriptions.push(vscode.commands.registerCommand('morse.graph.open', async () => {
            await this.openGraphPanel();
        }));
        // Build graph
        this.context.subscriptions.push(vscode.commands.registerCommand('morse.graph.build', async () => {
            await this.buildGraph();
        }));
        // Build graph for current workspace
        this.context.subscriptions.push(vscode.commands.registerCommand('morse.graph.buildWorkspace', async () => {
            await this.buildGraphForWorkspace();
        }));
        // Query graph
        this.context.subscriptions.push(vscode.commands.registerCommand('morse.graph.query', async (task) => {
            await this.queryGraph(task);
        }));
        // Search graph
        this.context.subscriptions.push(vscode.commands.registerCommand('morse.graph.search', async (pattern) => {
            await this.searchGraph(pattern);
        }));
        // Get graph stats
        this.context.subscriptions.push(vscode.commands.registerCommand('morse.graph.stats', async () => {
            await this.getGraphStats();
        }));
        // Find circular dependencies
        this.context.subscriptions.push(vscode.commands.registerCommand('morse.graph.findCircularDeps', async () => {
            await this.findCircularDependencies();
        }));
        // Export graph
        this.context.subscriptions.push(vscode.commands.registerCommand('morse.graph.export', async (format) => {
            await this.exportGraph(format);
        }));
        // Navigate to node
        this.context.subscriptions.push(vscode.commands.registerCommand('morse.graph.navigateToNode', async (node) => {
            await this.navigateToNode(node);
        }));
        // Get neighbors
        this.context.subscriptions.push(vscode.commands.registerCommand('morse.graph.getNeighbors', async (nodeId) => {
            await this.getNeighbors(nodeId);
        }));
    }
    /**
     * Open graph panel
     */
    async openGraphPanel() {
        if (!this.graphPanel) {
            this.graphPanel = (0, panel_1.createGraphPanel)(this.context.extensionUri, this.graphService);
        }
        this.graphPanel.show();
    }
    /**
     * Build graph for current workspace
     */
    async buildGraphForWorkspace() {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showWarningMessage('No workspace folder found');
            return;
        }
        await this.buildGraph(workspaceFolder.uri.fsPath);
    }
    /**
     * Build graph for a specific path
     */
    async buildGraph(projectRoot) {
        let root = projectRoot;
        if (!root) {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (workspaceFolder) {
                root = workspaceFolder.uri.fsPath;
            }
        }
        if (!root) {
            const selected = await vscode.window.showOpenDialog({
                title: 'Select Project Root',
                canSelectFolders: true,
                canSelectFiles: false,
            });
            if (selected && selected[0]) {
                root = selected[0].fsPath;
            }
        }
        if (!root) {
            return;
        }
        try {
            const result = await this.graphService.build({
                projectRoot: root,
            });
            if (result.success) {
                vscode.window.showInformationMessage(`Graph built successfully: ${result.metadata?.nodeCount || 0} nodes`);
                // Show circular dependencies warning if found
                if (result.metadata?.hasCircularDependencies) {
                    vscode.window.showWarningMessage('Circular dependencies detected in the graph');
                }
                // Open panel to show graph
                await this.openGraphPanel();
            }
            else {
                vscode.window.showErrorMessage(`Graph build failed: ${result.error}`);
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Graph build error: ${error}`);
        }
    }
    /**
     * Query graph for relevant code
     */
    async queryGraph(task) {
        if (!task) {
            task = await vscode.window.showInputBox({
                prompt: 'Enter a task description to find relevant code',
                placeHolder: 'e.g., authentication handling, HTTP requests',
            });
        }
        if (!task) {
            return;
        }
        try {
            const result = await this.graphService.query({
                task,
                maxTokens: 4000,
            });
            if (result.success && result.context) {
                // Show results in a new document
                const doc = await vscode.workspace.openTextDocument({
                    language: 'markdown',
                    content: `# Graph Query Results\n\n**Task:** ${task}\n\n---\n\n${result.context}`,
                });
                await vscode.window.showTextDocument(doc, {
                    viewColumn: vscode.ViewColumn.Beside,
                    preview: false,
                });
            }
            else if (result.error) {
                vscode.window.showErrorMessage(`Query failed: ${result.error}`);
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Query error: ${error}`);
        }
    }
    /**
     * Search graph for nodes
     */
    async searchGraph(pattern) {
        if (!pattern) {
            pattern = await vscode.window.showInputBox({
                prompt: 'Enter a search pattern',
                placeHolder: 'e.g., handle, User, calculate',
            });
        }
        if (!pattern) {
            return;
        }
        try {
            const result = await this.graphService.search({ pattern });
            if (result.success && result.nodes && result.nodes.length > 0) {
                // Show results in a quick pick
                const items = result.nodes.map(node => ({
                    label: node.name,
                    description: `${node.nodeType} - ${node.filePath}:${node.startLine}`,
                    node,
                }));
                const selected = await vscode.window.showQuickPick(items, {
                    placeHolder: `Found ${result.nodes.length} matching nodes`,
                });
                if (selected) {
                    await this.navigateToNode(selected.node);
                }
            }
            else if (result.success) {
                vscode.window.showInformationMessage(`No nodes found matching "${pattern}"`);
            }
            else {
                vscode.window.showErrorMessage(`Search failed: ${result.error}`);
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Search error: ${error}`);
        }
    }
    /**
     * Get graph statistics
     */
    async getGraphStats() {
        try {
            const result = await this.graphService.getStats();
            if (result.success && result.stats) {
                const stats = result.stats;
                const message = [
                    `**Graph Statistics**`,
                    ``,
                    `Total Nodes: ${stats.totalNodes}`,
                    `Total Edges: ${stats.totalEdges}`,
                    `Files Indexed: ${stats.filesIndexed}`,
                    ``,
                    `**Nodes by Type:**`,
                    ...Object.entries(stats.nodesByType).map(([type, count]) => `  ${type}: ${count}`),
                ].join('\n');
                // Show in output channel
                const output = vscode.window.createOutputChannel('Graph Statistics');
                output.appendLine(message);
                output.show();
            }
            else {
                vscode.window.showErrorMessage(`Stats failed: ${result.error}`);
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Stats error: ${error}`);
        }
    }
    /**
     * Find circular dependencies
     */
    async findCircularDependencies() {
        try {
            const deps = await this.graphService.findCircularDependencies();
            if (deps.length > 0) {
                const message = deps.map(d => d.description).join('\n\n');
                const doc = await vscode.workspace.openTextDocument({
                    language: 'markdown',
                    content: `# Circular Dependencies\n\n${message}`,
                });
                await vscode.window.showTextDocument(doc, {
                    viewColumn: vscode.ViewColumn.Beside,
                    preview: false,
                });
            }
            else {
                vscode.window.showInformationMessage('No circular dependencies found');
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Error finding circular dependencies: ${error}`);
        }
    }
    /**
     * Export graph
     */
    async exportGraph(format) {
        if (!format) {
            const selected = await vscode.window.showQuickPick([
                { label: 'Mermaid', format: 'mermaid', description: 'Mermaid diagram format' },
                { label: 'DOT', format: 'dot', description: 'Graphviz DOT format' },
                { label: 'JSON', format: 'json', description: 'JSON format' },
            ], { placeHolder: 'Select export format' });
            if (selected) {
                format = selected.format;
            }
        }
        if (!format) {
            return;
        }
        try {
            const content = await this.graphService.exportGraph(format);
            const ext = format === 'mermaid' ? 'mmd' : format;
            const doc = await vscode.workspace.openTextDocument({
                language: format === 'mermaid' ? 'markdown' : format,
                content,
            });
            await vscode.window.showTextDocument(doc, {
                viewColumn: vscode.ViewColumn.Beside,
                preview: false,
            });
        }
        catch (error) {
            vscode.window.showErrorMessage(`Export error: ${error}`);
        }
    }
    /**
     * Navigate to a node in the editor
     */
    async navigateToNode(node) {
        await this.graphService.navigateToNode(node);
    }
    /**
     * Get neighbors of a node
     */
    async getNeighbors(nodeId) {
        if (!nodeId) {
            // Prompt for node ID
            nodeId = await vscode.window.showInputBox({
                prompt: 'Enter node ID to get neighbors for',
                placeHolder: 'e.g., function:handleRequest',
            });
        }
        if (!nodeId) {
            return;
        }
        try {
            const result = await this.graphService.getNeighbors({
                nodeId,
                maxHops: 2,
            });
            if (result.success && result.nodes && result.nodes.length > 0) {
                const items = result.nodes.map(node => ({
                    label: node.name,
                    description: `${node.nodeType} - ${node.filePath}:${node.startLine}`,
                    node,
                }));
                const selected = await vscode.window.showQuickPick(items, {
                    placeHolder: `Found ${result.nodes.length} neighboring nodes`,
                });
                if (selected) {
                    await this.navigateToNode(selected.node);
                }
            }
            else if (result.success) {
                vscode.window.showInformationMessage(`No neighbors found for "${nodeId}"`);
            }
            else {
                vscode.window.showErrorMessage(`Get neighbors failed: ${result.error}`);
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Get neighbors error: ${error}`);
        }
    }
    /**
     * Get graph service
     */
    getService() {
        return this.graphService;
    }
    /**
     * Dispose
     */
    dispose() {
        this.graphService.dispose();
        if (this.graphPanel) {
            this.graphPanel.dispose();
        }
    }
}
exports.GraphCommands = GraphCommands;
/**
 * Create graph commands instance
 */
function createGraphCommands(context, client, config) {
    return new GraphCommands(context, client, config);
}
/**
 * Register graph commands
 */
function registerGraphCommands(context, client) {
    const commands = createGraphCommands(context, client);
    commands.register();
    return commands;
}
//# sourceMappingURL=commands.js.map