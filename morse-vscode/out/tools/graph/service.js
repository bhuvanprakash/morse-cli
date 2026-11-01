"use strict";
/**
 * Graph Service
 * Handles code dependency graph operations through morse-cli
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
exports.GraphService = void 0;
exports.createGraphService = createGraphService;
const vscode = __importStar(require("vscode"));
const types_1 = require("./types");
/**
 * Graph service for managing dependency graphs and executing graph operations
 */
class GraphService {
    client;
    config;
    events = {};
    currentGraph = null;
    isInitialized = false;
    constructor(client, config = {}) {
        this.client = client;
        this.config = { ...types_1.DEFAULT_GRAPH_CONFIG, ...config };
    }
    /**
     * Set event handlers
     */
    setEvents(events) {
        this.events = events;
    }
    /**
     * Initialize the graph service
     */
    async initialize() {
        this.isInitialized = true;
    }
    /**
     * Check if graph service is available
     */
    isAvailable() {
        return this.isInitialized;
    }
    /**
     * Get current graph data
     */
    getCurrentGraph() {
        return this.currentGraph;
    }
    /**
     * Get configuration
     */
    getConfig() {
        return this.config;
    }
    /**
     * Update configuration
     */
    updateConfig(config) {
        this.config = { ...this.config, ...config };
    }
    /**
     * Execute graph query to find relevant code
     */
    async query(args) {
        try {
            const result = await this.executeGraphQuery(args);
            if (result.success && result.nodes) {
                this.events.onQueryComplete?.(result);
            }
            return result;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.events.onError?.(errorMessage);
            return {
                success: false,
                message: '',
                error: errorMessage,
            };
        }
    }
    /**
     * Get neighboring nodes in the graph
     */
    async getNeighbors(args) {
        try {
            const maxHops = args.maxHops ?? 2;
            const result = await this.executeGraphNeighbors(args.nodeId, maxHops);
            return result;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.events.onError?.(errorMessage);
            return {
                success: false,
                message: '',
                error: errorMessage,
            };
        }
    }
    /**
     * Search for nodes by pattern
     */
    async search(args) {
        try {
            const result = await this.executeGraphSearch(args.pattern);
            if (result.success) {
                this.events.onSearchComplete?.(result);
            }
            return result;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.events.onError?.(errorMessage);
            return {
                success: false,
                message: '',
                error: errorMessage,
            };
        }
    }
    /**
     * Get graph statistics
     */
    async getStats() {
        try {
            const result = await this.executeGraphStats();
            return result;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.events.onError?.(errorMessage);
            return {
                success: false,
                message: '',
                error: errorMessage,
            };
        }
    }
    /**
     * Build the dependency graph
     */
    async build(args) {
        try {
            const result = await this.executeGraphBuild(args);
            if (result.success && result.metadata) {
                this.currentGraph = {
                    nodes: [],
                    edges: [],
                    metadata: result.metadata,
                };
                // Check for circular dependencies
                if (result.metadata.hasCircularDependencies && result.metadata.circularDependencies) {
                    this.events.onCircularDependency?.(result.metadata.circularDependencies);
                }
                this.events.onGraphBuilt?.(this.currentGraph);
            }
            return result;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.events.onError?.(errorMessage);
            return {
                success: false,
                message: '',
                error: errorMessage,
            };
        }
    }
    /**
     * Find circular dependencies in the graph
     */
    async findCircularDependencies() {
        try {
            const result = await this.executeGraphStats();
            if (result.success && result.stats) {
                // Get more detailed circular dependency info
                const depsResult = await this.executeGraphNeighbors('*', 10);
                // For now, return empty array - actual detection happens in morse-cli
                return [];
            }
            return [];
        }
        catch {
            return [];
        }
    }
    /**
     * Get import/export relationships for a file
     */
    async getImportRelationships(filePath) {
        try {
            // Use graph_neighbors to get import relationships
            const result = await this.executeGraphNeighbors(`file:${filePath}`, 1);
            if (result.success && result.nodes) {
                const imports = result.nodes
                    .filter(n => n.nodeType === 'import')
                    .map(n => n.name);
                const exports = result.nodes
                    .filter(n => n.nodeType === 'function' || n.nodeType === 'type')
                    .map(n => n.name);
                return { imports, exports };
            }
            return { imports: [], exports: [] };
        }
        catch {
            return { imports: [], exports: [] };
        }
    }
    /**
     * Build call graph for a function
     */
    async buildCallGraph(functionId) {
        try {
            const result = await this.executeGraphNeighbors(functionId, 2);
            if (result.success && result.nodes) {
                const callers = result.nodes.filter(n => n.nodeType === 'function');
                const callees = result.nodes.filter(n => n.nodeType === 'function');
                return { callers, callees };
            }
            return { callers: [], callees: [] };
        }
        catch {
            return { callers: [], callees: [] };
        }
    }
    /**
     * Export graph in specified format
     */
    async exportGraph(format) {
        if (!this.currentGraph) {
            throw new Error('No graph data available. Build the graph first.');
        }
        switch (format) {
            case 'json':
                return JSON.stringify(this.currentGraph, null, 2);
            case 'dot':
                return this.convertToDot(this.currentGraph);
            case 'mermaid':
                return this.convertToMermaid(this.currentGraph);
            default:
                throw new Error(`Unsupported format: ${format}`);
        }
    }
    /**
     * Convert graph to DOT format
     */
    convertToDot(graph) {
        const lines = ['digraph G {'];
        // Add nodes
        for (const node of graph.nodes) {
            const label = node.name.replace(/"/g, '\\"');
            lines.push(`  "${node.id}" [label="${label}", shape=box];`);
        }
        // Add edges
        for (const edge of graph.edges) {
            lines.push(`  "${edge.sourceId}" -> "${edge.targetId}" [label="${edge.edgeType}"];`);
        }
        lines.push('}');
        return lines.join('\n');
    }
    /**
     * Convert graph to Mermaid format
     */
    convertToMermaid(graph) {
        const lines = ['graph TD'];
        // Add nodes with labels
        for (const node of graph.nodes) {
            const label = node.name.replace(/[^a-zA-Z0-9]/g, '_');
            lines.push(`  ${node.id}${node.nodeType}[${node.name}]`);
        }
        // Add edges
        for (const edge of graph.edges) {
            lines.push(`  ${edge.sourceId} -->|${edge.edgeType}| ${edge.targetId}`);
        }
        return lines.join('\n');
    }
    /**
     * Execute graph query through morse-cli
     */
    async executeGraphQuery(args) {
        let output = '';
        let success = false;
        let nodes;
        let context;
        const toolArgs = {
            task: args.task,
            max_tokens: args.maxTokens ?? 4000,
        };
        for await (const chunk of this.client.streamToolExecution('graph_query', toolArgs)) {
            if (chunk.output) {
                output += chunk.output;
            }
            if (chunk.error) {
                output += `[Error]: ${chunk.error}\n`;
            }
            if (chunk.status === 'completed') {
                success = true;
            }
            if (chunk.status === 'failed') {
                success = false;
            }
        }
        // Parse output to extract nodes
        nodes = this.parseNodesFromOutput(output);
        context = output;
        return {
            success,
            message: output,
            nodes,
            context,
        };
    }
    /**
     * Execute graph neighbors through morse-cli
     */
    async executeGraphNeighbors(nodeId, maxHops) {
        let output = '';
        let success = false;
        let nodes;
        let edges;
        const toolArgs = {
            node_id: nodeId,
            max_hops: maxHops,
        };
        for await (const chunk of this.client.streamToolExecution('graph_neighbors', toolArgs)) {
            if (chunk.output) {
                output += chunk.output;
            }
            if (chunk.error) {
                output += `[Error]: ${chunk.error}\n`;
            }
            if (chunk.status === 'completed') {
                success = true;
            }
            if (chunk.status === 'failed') {
                success = false;
            }
        }
        // Parse output
        nodes = this.parseNodesFromOutput(output);
        edges = this.parseEdgesFromOutput(output);
        return {
            success,
            message: output,
            nodes,
            edges,
        };
    }
    /**
     * Execute graph search through morse-cli
     */
    async executeGraphSearch(pattern) {
        let output = '';
        let success = false;
        let nodes;
        const toolArgs = {
            pattern,
        };
        for await (const chunk of this.client.streamToolExecution('graph_search', toolArgs)) {
            if (chunk.output) {
                output += chunk.output;
            }
            if (chunk.error) {
                output += `[Error]: ${chunk.error}\n`;
            }
            if (chunk.status === 'completed') {
                success = true;
            }
            if (chunk.status === 'failed') {
                success = false;
            }
        }
        // Parse output
        nodes = this.parseNodesFromOutput(output);
        return {
            success,
            message: output,
            nodes,
        };
    }
    /**
     * Execute graph stats through morse-cli
     */
    async executeGraphStats() {
        let output = '';
        let success = false;
        let stats;
        for await (const chunk of this.client.streamToolExecution('graph_stats', {})) {
            if (chunk.output) {
                output += chunk.output;
            }
            if (chunk.error) {
                output += `[Error]: ${chunk.error}\n`;
            }
            if (chunk.status === 'completed') {
                success = true;
            }
            if (chunk.status === 'failed') {
                success = false;
            }
        }
        // Parse output to extract stats
        stats = this.parseStatsFromOutput(output);
        return {
            success,
            message: output,
            stats,
        };
    }
    /**
     * Execute graph build through morse-cli
     */
    async executeGraphBuild(args) {
        let output = '';
        let success = false;
        let metadata;
        const toolArgs = {
            project_root: args.projectRoot,
            files: args.files,
            force: args.force,
        };
        for await (const chunk of this.client.streamToolExecution('graph_build', toolArgs)) {
            if (chunk.output) {
                output += chunk.output;
            }
            if (chunk.error) {
                output += `[Error]: ${chunk.error}\n`;
            }
            if (chunk.status === 'completed') {
                success = true;
            }
            if (chunk.status === 'failed') {
                success = false;
            }
        }
        // Parse metadata from output
        metadata = this.parseMetadataFromOutput(output);
        return {
            success,
            message: output,
            metadata,
        };
    }
    /**
     * Parse nodes from morse-cli output
     */
    parseNodesFromOutput(output) {
        const nodes = [];
        const nodeRegex = /-\s+(function|type|variable|constant|import|class|interface|method):\s+(.+?)(?:\s+\((.+?):(\d+)-(\d+)\))?/g;
        let match;
        while ((match = nodeRegex.exec(output)) !== null) {
            const [, nodeType, name, filePath, startLine, endLine] = match;
            nodes.push({
                id: `${nodeType}:${name}`,
                name,
                nodeType: nodeType,
                filePath: filePath || '',
                startLine: startLine ? parseInt(startLine, 10) : 0,
                endLine: endLine ? parseInt(endLine, 10) : 0,
            });
        }
        return nodes;
    }
    /**
     * Parse edges from morse-cli output
     */
    parseEdgesFromOutput(output) {
        const edges = [];
        // Parse edges from output - simplified for now
        return edges;
    }
    /**
     * Parse statistics from output
     */
    parseStatsFromOutput(output) {
        const stats = {
            totalNodes: 0,
            totalEdges: 0,
            nodesByType: {},
            edgesByType: {},
            filesIndexed: 0,
            indexSize: 0,
        };
        // Parse node count
        const nodeMatch = output.match(/(\d+)\s+node(s)?/i);
        if (nodeMatch) {
            stats.totalNodes = parseInt(nodeMatch[1], 10);
        }
        // Parse edge count
        const edgeMatch = output.match(/(\d+)\s+edge(s)?/i);
        if (edgeMatch) {
            stats.totalEdges = parseInt(edgeMatch[1], 10);
        }
        // Parse files indexed
        const filesMatch = output.match(/(\d+)\s+file(s)?\s+indexed/i);
        if (filesMatch) {
            stats.filesIndexed = parseInt(filesMatch[1], 10);
        }
        return stats;
    }
    /**
     * Parse metadata from output
     */
    parseMetadataFromOutput(output) {
        const metadata = {
            nodeCount: 0,
            edgeCount: 0,
            filesAnalyzed: [],
            builtAt: new Date(),
            hasCircularDependencies: output.toLowerCase().includes('circular'),
        };
        // Parse node count
        const nodeMatch = output.match(/(\d+)\s+node(s)?/i);
        if (nodeMatch) {
            metadata.nodeCount = parseInt(nodeMatch[1], 10);
        }
        // Parse edge count
        const edgeMatch = output.match(/(\d+)\s+edge(s)?/i);
        if (edgeMatch) {
            metadata.edgeCount = parseInt(edgeMatch[1], 10);
        }
        return metadata;
    }
    /**
     * Navigate to a node in the editor
     */
    async navigateToNode(node) {
        try {
            const document = await vscode.workspace.openTextDocument(node.filePath);
            const editor = await vscode.window.showTextDocument(document, {
                preview: false,
            });
            const startLine = node.startLine - 1;
            const endLine = node.endLine - 1;
            const start = new vscode.Position(startLine, 0);
            const end = new vscode.Position(endLine, 0);
            const range = new vscode.Range(start, end);
            editor.selection = new vscode.Selection(start, end);
            editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to navigate to node: ${error}`);
        }
    }
    /**
     * Dispose the graph service
     */
    dispose() {
        this.events = {};
        this.currentGraph = null;
    }
}
exports.GraphService = GraphService;
/**
 * Create a graph service instance
 */
function createGraphService(client, config) {
    return new GraphService(client, config);
}
//# sourceMappingURL=service.js.map