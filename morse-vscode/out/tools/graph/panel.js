"use strict";
/**
 * Graph Panel
 * Interactive graph visualization panel for VS Code
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
exports.GraphPanel = void 0;
exports.createGraphPanel = createGraphPanel;
const vscode = __importStar(require("vscode"));
/**
 * Graph Panel for visualizing and interacting with code dependency graphs
 */
class GraphPanel {
    static viewType = 'morse.graph';
    static currentPanel;
    panel;
    extensionUri;
    graphService;
    disposables = [];
    state;
    constructor(extensionUri, graphService) {
        this.extensionUri = extensionUri;
        this.graphService = graphService;
        this.state = {
            isVisible: false,
            graphData: null,
            selectedNodeId: null,
            viewMode: 'graph',
            zoomLevel: 1,
            filters: {
                nodeTypes: ['function', 'type', 'variable', 'constant', 'import', 'class', 'interface', 'method'],
                edgeTypes: ['calls', 'imports', 'references', 'contains', 'extends', 'implements', 'dependsOn'],
                searchQuery: '',
            },
        };
        // Create the webview panel
        this.panel = vscode.window.createWebviewPanel(GraphPanel.viewType, 'Dependency Graph', vscode.ViewColumn.Two, {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [extensionUri],
        });
        this.panel.iconPath = vscode.Uri.joinPath(extensionUri, 'media', 'graph.svg');
        this.initializePanel();
    }
    /**
     * Initialize the panel with content
     */
    initializePanel() {
        // Set initial HTML content
        this.panel.webview.html = this.getHtmlContent();
        // Handle messages from the webview
        this.panel.webview.onDidReceiveMessage((message) => this.handleWebviewMessage(message), null, this.disposables);
        // Handle panel disposal
        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
        // Set up graph service events
        this.graphService.setEvents({
            onGraphBuilt: (graph) => {
                this.state.graphData = graph;
                this.updateGraph();
            },
            onQueryComplete: (result) => {
                if (result.nodes) {
                    this.showNodesInList(result.nodes);
                }
            },
            onSearchComplete: (result) => {
                if (result.nodes) {
                    this.showNodesInList(result.nodes);
                }
            },
            onNodeSelected: (node) => {
                this.state.selectedNodeId = node.id;
                this.updateSelection();
            },
            onError: (error) => {
                this.showError(error);
            },
            onCircularDependency: (deps) => {
                this.showCircularDependencies(deps);
            },
        });
    }
    /**
     * Handle messages from the webview
     */
    async handleWebviewMessage(message) {
        switch (message.command) {
            case 'nodeSelected':
                await this.handleNodeSelected(message.payload);
                break;
            case 'zoom':
                this.handleZoom(message.payload);
                break;
            case 'changeViewMode':
                this.changeViewMode(message.payload);
                break;
            case 'applyFilter':
                this.applyFilter(message.payload);
                break;
            case 'export':
                await this.exportGraph(message.payload);
                break;
            case 'refresh':
                await this.refreshGraph();
                break;
            case 'navigateToNode':
                await this.navigateToNode(message.payload);
                break;
            case 'search':
                await this.searchNodes(message.payload);
                break;
        }
    }
    /**
     * Handle node selection from webview
     */
    async handleNodeSelected(nodeId) {
        this.state.selectedNodeId = nodeId;
        if (this.state.graphData) {
            const node = this.state.graphData.nodes.find(n => n.id === nodeId);
            if (node) {
                this.graphService.setEvents({
                    onGraphBuilt: () => { },
                    onQueryComplete: () => { },
                    onSearchComplete: () => { },
                    onNodeSelected: () => { },
                    onError: () => { },
                    onCircularDependency: () => { },
                });
                // Get neighbors for the selected node
                await this.graphService.getNeighbors({ nodeId, maxHops: 2 });
            }
        }
    }
    /**
     * Handle zoom from webview
     */
    handleZoom(zoomDelta) {
        this.state.zoomLevel = Math.max(0.1, Math.min(5, this.state.zoomLevel + zoomDelta));
        this.panel.webview.postMessage({
            command: 'setZoom',
            payload: this.state.zoomLevel,
        });
    }
    /**
     * Change view mode
     */
    changeViewMode(mode) {
        this.state.viewMode = mode;
        this.panel.webview.postMessage({
            command: 'setViewMode',
            payload: mode,
        });
    }
    /**
     * Apply filters
     */
    applyFilter(filters) {
        this.state.filters = { ...this.state.filters, ...filters };
        this.updateGraph();
    }
    /**
     * Export graph
     */
    async exportGraph(format) {
        try {
            // Filter out 'svg' as it's not supported by the service
            const validFormat = format === 'svg' ? 'mermaid' : format;
            const content = await this.graphService.exportGraph(validFormat);
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
            this.showError(error instanceof Error ? error.message : String(error));
        }
    }
    /**
     * Refresh graph
     */
    async refreshGraph() {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (workspaceFolder) {
            const result = await this.graphService.build({
                projectRoot: workspaceFolder.uri.fsPath,
            });
            if (!result.success && result.error) {
                this.showError(result.error);
            }
        }
    }
    /**
     * Navigate to node in editor
     */
    async navigateToNode(node) {
        await this.graphService.navigateToNode(node);
    }
    /**
     * Search nodes
     */
    async searchNodes(query) {
        const result = await this.graphService.search({ pattern: query });
        if (result.success && result.nodes) {
            this.showNodesInList(result.nodes);
        }
        else if (result.error) {
            this.showError(result.error);
        }
    }
    /**
     * Update graph in webview
     */
    updateGraph() {
        if (this.state.graphData) {
            // Apply filters
            let nodes = this.state.graphData.nodes;
            let edges = this.state.graphData.edges;
            // Filter by node types
            if (this.state.filters.nodeTypes.length < 8) {
                nodes = nodes.filter(n => this.state.filters.nodeTypes.includes(n.nodeType));
            }
            // Filter by search query
            if (this.state.filters.searchQuery) {
                const query = this.state.filters.searchQuery.toLowerCase();
                nodes = nodes.filter(n => n.name.toLowerCase().includes(query));
            }
            // Filter edges based on filtered nodes
            const nodeIds = new Set(nodes.map(n => n.id));
            edges = edges.filter(e => nodeIds.has(e.sourceId) && nodeIds.has(e.targetId));
            this.panel.webview.postMessage({
                command: 'updateGraph',
                payload: { nodes, edges },
            });
        }
    }
    /**
     * Update selection in webview
     */
    updateSelection() {
        this.panel.webview.postMessage({
            command: 'setSelectedNode',
            payload: this.state.selectedNodeId,
        });
    }
    /**
     * Show nodes in list view
     */
    showNodesInList(nodes) {
        this.panel.webview.postMessage({
            command: 'showNodeList',
            payload: nodes,
        });
    }
    /**
     * Show circular dependencies
     */
    showCircularDependencies(deps) {
        this.panel.webview.postMessage({
            command: 'showCircularDeps',
            payload: deps,
        });
    }
    /**
     * Show error message
     */
    showError(message) {
        vscode.window.showErrorMessage(`Graph Error: ${message}`);
        this.panel.webview.postMessage({
            command: 'showError',
            payload: message,
        });
    }
    /**
     * Show the panel
     */
    show() {
        this.panel.reveal();
        this.state.isVisible = true;
    }
    /**
     * Hide the panel
     */
    hide() {
        this.panel.dispose();
        this.state.isVisible = false;
    }
    /**
     * Dispose the panel
     */
    dispose() {
        this.panel.dispose();
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
        GraphPanel.currentPanel = undefined;
    }
    /**
     * Get HTML content for the panel
     */
    getHtmlContent() {
        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dependency Graph</title>
    <style>
        * {
            box-sizing: border-box;
        }
        body {
            margin: 0;
            padding: 0;
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
        }
        .container {
            display: flex;
            flex-direction: column;
            height: 100vh;
        }
        .toolbar {
            display: flex;
            gap: 8px;
            padding: 8px;
            background-color: var(--vscode-editor-background);
            border-bottom: 1px solid var(--vscode-editor-border);
            flex-wrap: wrap;
        }
        .btn {
            padding: 6px 12px;
            border: none;
            border-radius: 4px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            cursor: pointer;
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
        }
        .btn:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .btn.active {
            background-color: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
        }
        .btn-group {
            display: flex;
            gap: 4px;
        }
        .search-input {
            flex: 1;
            min-width: 150px;
            padding: 6px 12px;
            border: 1px solid var(--vscode-editor-border);
            border-radius: 4px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
        }
        .search-input:focus {
            outline: none;
            border-color: var(--vscode-focusBorder);
        }
        .content {
            display: flex;
            flex: 1;
            overflow: hidden;
        }
        .graph-container {
            flex: 1;
            position: relative;
            overflow: hidden;
        }
        .graph-svg {
            width: 100%;
            height: 100%;
        }
        .node {
            cursor: pointer;
        }
        .node rect {
            fill: var(--vscode-editor-background);
            stroke: var(--vscode-editor-border);
            stroke-width: 1;
        }
        .node.selected rect {
            stroke: var(--vscode-focusBorder);
            stroke-width: 2;
        }
        .node text {
            fill: var(--vscode-editor-foreground);
            font-size: 12px;
        }
        .edge {
            stroke: var(--vscode-editor-border);
            stroke-width: 1;
            fill: none;
        }
        .sidebar {
            width: 300px;
            border-left: 1px solid var(--vscode-editor-border);
            display: flex;
            flex-direction: column;
            background-color: var(--vscode-editor-background);
        }
        .sidebar-header {
            padding: 8px;
            font-weight: bold;
            border-bottom: 1px solid var(--vscode-editor-border);
        }
        .node-list {
            flex: 1;
            overflow-y: auto;
        }
        .node-item {
            padding: 8px;
            cursor: pointer;
            border-bottom: 1px solid var(--vscode-editor-border);
        }
        .node-item:hover {
            background-color: var(--vscode-list-hoverBackground);
        }
        .node-item.selected {
            background-color: var(--vscode-list-activeSelectionBackground);
        }
        .node-type {
            font-size: 10px;
            padding: 2px 6px;
            border-radius: 3px;
            background-color: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            margin-right: 4px;
        }
        .node-name {
            font-weight: bold;
        }
        .node-path {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            margin-top: 4px;
            word-break: break-all;
        }
        .details-panel {
            padding: 12px;
            border-top: 1px solid var(--vscode-editor-border);
        }
        .details-title {
            font-weight: bold;
            margin-bottom: 8px;
        }
        .details-content {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }
        .empty-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            color: var(--vscode-descriptionForeground);
            text-align: center;
            padding: 20px;
        }
        .empty-state-icon {
            font-size: 48px;
            margin-bottom: 16px;
        }
        .circular-dep-warning {
            padding: 12px;
            background-color: var(--vscode-editorWarning-foreground);
            color: var(--vscode-editor-background);
            margin: 8px;
            border-radius: 4px;
        }
        .zoom-controls {
            position: absolute;
            bottom: 16px;
            right: 16px;
            display: flex;
            gap: 4px;
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-editor-border);
            border-radius: 4px;
            padding: 4px;
        }
        .zoom-btn {
            padding: 4px 8px;
            border: none;
            border-radius: 2px;
            background-color: transparent;
            cursor: pointer;
        }
        .zoom-btn:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .view-tabs {
            display: flex;
            gap: 4px;
        }
        .view-tab {
            padding: 4px 8px;
            border: none;
            border-radius: 4px;
            background-color: transparent;
            cursor: pointer;
            font-size: 12px;
        }
        .view-tab.active {
            background-color: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
        }
        /* D3.js zoom container */
        .zoom-layer {
            width: 100%;
            height: 100%;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="toolbar">
            <div class="view-tabs">
                <button class="view-tab active" data-view="graph">Graph</button>
                <button class="view-tab" data-view="list">List</button>
            </div>
            <input type="text" class="search-input" placeholder="Search nodes..." id="searchInput">
            <div class="btn-group">
                <button class="btn" id="refreshBtn">Refresh</button>
                <button class="btn" id="exportBtn">Export</button>
            </div>
        </div>
        
        <div class="content">
            <div class="graph-container" id="graphContainer">
                <div class="empty-state" id="emptyState">
                    <div class="empty-state-icon">📊</div>
                    <h3>No Graph Data</h3>
                    <p>Click "Refresh" to build the dependency graph</p>
                </div>
                <svg class="graph-svg" id="graphSvg" style="display: none;"></svg>
                <div class="zoom-controls" style="display: none;" id="zoomControls">
                    <button class="zoom-btn" id="zoomIn">+</button>
                    <button class="zoom-btn" id="zoomOut">-</button>
                    <button class="zoom-btn" id="zoomReset">Reset</button>
                </div>
            </div>
            
            <div class="sidebar" id="sidebar" style="display: none;">
                <div class="sidebar-header">Nodes</div>
                <div class="node-list" id="nodeList"></div>
                <div class="details-panel" id="detailsPanel" style="display: none;">
                    <div class="details-title" id="detailsTitle"></div>
                    <div class="details-content" id="detailsContent"></div>
                </div>
            </div>
        </div>
    </div>

    <script>
        // State
        let currentView = 'graph';
        let selectedNodeId = null;
        let graphData = { nodes: [], edges: [] };
        let zoomLevel = 1;

        // DOM Elements
        const graphSvg = document.getElementById('graphSvg');
        const emptyState = document.getElementById('emptyState');
        const sidebar = document.getElementById('sidebar');
        const nodeList = document.getElementById('nodeList');
        const detailsPanel = document.getElementById('detailsPanel');
        const detailsTitle = document.getElementById('detailsTitle');
        const detailsContent = document.getElementById('detailsContent');
        const zoomControls = document.getElementById('zoomControls');
        const searchInput = document.getElementById('searchInput');

        // View tabs
        document.querySelectorAll('.view-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.view-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                currentView = tab.dataset.view;
                vscode.postMessage({ command: 'changeViewMode', payload: currentView });
                updateView();
            });
        });

        // Search
        searchInput.addEventListener('input', (e) => {
            vscode.postMessage({ command: 'applyFilter', payload: { searchQuery: e.target.value } });
        });

        // Refresh button
        document.getElementById('refreshBtn').addEventListener('click', () => {
            vscode.postMessage({ command: 'refresh' });
        });

        // Export button
        document.getElementById('exportBtn').addEventListener('click', () => {
            const format = prompt('Enter export format (json, dot, mermaid):', 'mermaid');
            if (format && ['json', 'dot', 'mermaid'].includes(format)) {
                vscode.postMessage({ command: 'export', payload: format as 'json' | 'dot' | 'mermaid' });
            }
        });

        // Zoom controls
        document.getElementById('zoomIn').addEventListener('click', () => {
            vscode.postMessage({ command: 'zoom', payload: 0.2 });
        });
        document.getElementById('zoomOut').addEventListener('click', () => {
            vscode.postMessage({ command: 'zoom', payload: -0.2 });
        });
        document.getElementById('zoomReset').addEventListener('click', () => {
            zoomLevel = 1;
            vscode.postMessage({ command: 'setZoom', payload: 1 });
        });

        // Update view based on mode
        function updateView() {
            if (currentView === 'graph') {
                graphSvg.style.display = 'block';
                zoomControls.style.display = 'flex';
                sidebar.style.display = 'none';
            } else {
                graphSvg.style.display = 'none';
                zoomControls.style.display = 'none';
                sidebar.style.display = 'flex';
            }
        }

        // Render graph with D3.js-style SVG
        function renderGraph(nodes, edges) {
            if (!nodes || nodes.length === 0) {
                emptyState.style.display = 'flex';
                graphSvg.style.display = 'none';
                return;
            }

            emptyState.style.display = 'none';
            graphSvg.style.display = 'block';

            // Simple force-directed layout (simplified)
            const width = graphSvg.parentElement.clientWidth || 800;
            const height = graphSvg.parentElement.clientHeight || 600;
            
            // Calculate positions (simple grid layout)
            const positions = {};
            const cols = Math.ceil(Math.sqrt(nodes.length));
            nodes.forEach((node, i) => {
                const col = i % cols;
                const row = Math.floor(i / cols);
                positions[node.id] = {
                    x: 80 + col * 150,
                    y: 40 + row * 80
                };
            });

            // Build SVG content
            let svgContent = '';
            
            // Draw edges first
            edges.forEach(edge => {
                const source = positions[edge.sourceId];
                const target = positions[edge.targetId];
                if (source && target) {
                    svgContent += \`<line class="edge" x1="\${source.x}" y1="\${source.y}" x2="\${target.x}" y2="\${target.y}"/>\`;
                }
            });

            // Draw nodes
            nodes.forEach(node => {
                const pos = positions[node.id];
                if (pos) {
                    const isSelected = node.id === selectedNodeId;
                    svgContent += \`
                        <g class="node \${isSelected ? 'selected' : ''}" data-id="\${node.id}" transform="translate(\${pos.x}, \${pos.y})">
                            <rect x="-50" y="-15" width="100" height="30" rx="4"/>
                            <text text-anchor="middle" y="5">\${node.name.substring(0, 12)}</text>
                        </g>
                    \`;
                }
            });

            graphSvg.innerHTML = svgContent;

            // Add click handlers
            graphSvg.querySelectorAll('.node').forEach(nodeEl => {
                nodeEl.addEventListener('click', () => {
                    const nodeId = nodeEl.dataset.id;
                    selectedNodeId = nodeId;
                    vscode.postMessage({ command: 'nodeSelected', payload: nodeId });
                    renderGraph(nodes, edges);
                });
            });
        }

        // Render node list
        function renderNodeList(nodes) {
            if (!nodes || nodes.length === 0) {
                nodeList.innerHTML = '<div style="padding: 8px; color: var(--vscode-descriptionForeground);">No nodes found</div>';
                return;
            }

            nodeList.innerHTML = nodes.map(node => \`
                <div class="node-item \${node.id === selectedNodeId ? 'selected' : ''}" data-id="\${node.id}">
                    <span class="node-type">\${node.nodeType}</span>
                    <span class="node-name">\${node.name}</span>
                    <div class="node-path">\${node.filePath}:\${node.startLine}</div>
                </div>
            \`).join('');

            // Add click handlers
            nodeList.querySelectorAll('.node-item').forEach(item => {
                item.addEventListener('click', () => {
                    const nodeId = item.dataset.id;
                    selectedNodeId = nodeId;
                    const node = nodes.find(n => n.id === nodeId);
                    if (node) {
                        vscode.postMessage({ command: 'navigateToNode', payload: node });
                    }
                });
            });
        }

        // Handle messages from extension
        window.addEventListener('message', (event) => {
            const message = event.data;
            
            switch (message.command) {
                case 'updateGraph':
                    graphData = message.payload;
                    renderGraph(graphData.nodes, graphData.edges);
                    renderNodeList(graphData.nodes);
                    break;
                case 'setSelectedNode':
                    selectedNodeId = message.payload;
                    renderGraph(graphData.nodes, graphData.edges);
                    break;
                case 'setZoom':
                    zoomLevel = message.payload;
                    break;
                case 'setViewMode':
                    currentView = message.payload;
                    updateView();
                    break;
                case 'showNodeList':
                    renderNodeList(message.payload);
                    break;
                case 'showError':
                    console.error('Graph error:', message.payload);
                    break;
                case 'showCircularDeps':
                    // Show circular dependency warning
                    console.warn('Circular dependencies found:', message.payload);
                    break;
            }
        });
    </script>
</body>
</html>`;
    }
}
exports.GraphPanel = GraphPanel;
/**
 * Create a graph panel instance
 */
function createGraphPanel(extensionUri, graphService) {
    return new GraphPanel(extensionUri, graphService);
}
//# sourceMappingURL=panel.js.map