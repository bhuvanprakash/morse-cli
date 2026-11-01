"use strict";
/**
 * MCP Sidebar Provider - Shows connected MCP servers and their tools
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
exports.MCPSidebarProvider = void 0;
exports.registerMCPSidebar = registerMCPSidebar;
const vscode = __importStar(require("vscode"));
class MCPSidebarProvider {
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    manager;
    serverNames = new Map();
    constructor(manager) {
        this.manager = manager;
        // Listen for server changes
        this.manager.on('serverStatusChange', () => {
            this.refresh();
        });
        this.manager.on('serverToolsChanged', () => {
            this.refresh();
        });
    }
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return element;
    }
    getChildren(element) {
        if (!element) {
            // Root level - show servers
            return this.getServers();
        }
        // Check if this is a server item (has children)
        if (element.collapsibleState === vscode.TreeItemCollapsibleState.Collapsed) {
            const serverName = this.serverNames.get(element.id || '');
            if (serverName) {
                return this.getToolsForServer(serverName);
            }
        }
        return Promise.resolve([]);
    }
    getServers() {
        const servers = this.manager.listClients();
        if (servers.length === 0) {
            return Promise.resolve([{
                    id: 'no-servers',
                    label: 'No MCP servers configured',
                    description: 'Use "Morse: Add MCP Server" to add one',
                    collapsibleState: vscode.TreeItemCollapsibleState.None,
                }]);
        }
        return Promise.resolve(servers.map(server => {
            const item = new vscode.TreeItem(server.name, vscode.TreeItemCollapsibleState.Collapsed);
            item.description = `${server.status} • ${server.tools.length} tools`;
            item.iconPath = new vscode.ThemeIcon(server.status === 'connected' ? 'plug' : 'circle-outline');
            // Store server name for children lookup
            this.serverNames.set(item.id || '', server.name);
            // Context menu
            item.contextValue = 'mcpServer';
            item.command = {
                command: 'morse.mcp.invoke',
                title: 'Invoke Tool',
                arguments: [server.name],
            };
            return item;
        }));
    }
    getToolsForServer(serverName) {
        const client = this.manager.getClient(serverName);
        if (!client) {
            return Promise.resolve([]);
        }
        const tools = client.getTools();
        if (tools.length === 0) {
            return Promise.resolve([{
                    id: `${serverName}-no-tools`,
                    label: 'No tools available',
                    collapsibleState: vscode.TreeItemCollapsibleState.None,
                }]);
        }
        return Promise.resolve(tools.map(tool => {
            const item = new vscode.TreeItem(tool.name, vscode.TreeItemCollapsibleState.None);
            item.description = tool.description || '';
            item.iconPath = new vscode.ThemeIcon('symbol-property');
            // Context menu for tool
            item.contextValue = 'mcpTool';
            item.command = {
                command: 'morse.mcp.invoke',
                title: 'Invoke Tool',
                arguments: [serverName, tool.name],
            };
            return item;
        }));
    }
}
exports.MCPSidebarProvider = MCPSidebarProvider;
/**
 * Register the MCP sidebar view
 */
function registerMCPSidebar(context, manager) {
    const provider = new MCPSidebarProvider(manager);
    // Register tree data provider
    context.subscriptions.push(vscode.window.registerTreeDataProvider('morse.mcp', provider));
    // Add context menu commands
    context.subscriptions.push(vscode.commands.registerCommand('morse.mcp.sidebar.refresh', () => {
        provider.refresh();
    }));
    context.subscriptions.push(vscode.commands.registerCommand('morse.mcp.sidebar.connect', async (serverName) => {
        if (!serverName) {
            vscode.window.showInformationMessage('Select a server from the sidebar');
            return;
        }
        try {
            await manager.connect(serverName);
            provider.refresh();
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to connect: ${error}`);
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('morse.mcp.sidebar.disconnect', async (serverName) => {
        if (!serverName) {
            vscode.window.showInformationMessage('Select a server from the sidebar');
            return;
        }
        manager.disconnect(serverName);
        provider.refresh();
    }));
    context.subscriptions.push(vscode.commands.registerCommand('morse.mcp.sidebar.remove', async (serverName) => {
        if (!serverName) {
            vscode.window.showInformationMessage('Select a server from the sidebar');
            return;
        }
        const response = await vscode.window.showWarningMessage(`Remove MCP server "${serverName}"?`, { modal: true }, 'Remove');
        if (response === 'Remove') {
            manager.removeServer(serverName);
            provider.refresh();
        }
    }));
}
//# sourceMappingURL=MCPSidebarProvider.js.map