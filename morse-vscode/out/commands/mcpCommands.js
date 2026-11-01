"use strict";
/**
 * MCP Commands for VS Code Extension
 * Commands for managing MCP server connections
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
exports.registerMCPCommands = registerMCPCommands;
exports.registerMorseMCPServerCommands = registerMorseMCPServerCommands;
const vscode = __importStar(require("vscode"));
const client_1 = require("../mcp/client");
const MCPSidebarProvider_1 = require("../views/sidebar/MCPSidebarProvider");
// Global MCP client manager
let mcpClientManager = null;
/**
 * Get or create the MCP client manager
 */
function getMCPClientManager() {
    if (!mcpClientManager) {
        mcpClientManager = new client_1.MCPClientManager();
    }
    return mcpClientManager;
}
/**
 * Register MCP commands
 */
function registerMCPCommands(context, manager) {
    // If manager is provided, also register the sidebar
    if (manager) {
        (0, MCPSidebarProvider_1.registerMCPSidebar)(context, manager);
    }
    // Register morse.mcp.list command
    registerMCPListCommand(context);
    // Register morse.mcp.connect command
    registerMCPConnectCommand(context);
    // Register morse.mcp.disconnect command
    registerMCPDisconnectCommand(context);
    // Register morse.mcp.invoke command
    registerMCPInvokeCommand(context);
    // Register morse.mcp.add command
    registerMCPAddCommand(context);
    // Register morse.mcp.remove command
    registerMCPRemoveCommand(context);
    // Register morse.mcp.listTools command
    registerMCPListToolsCommand(context);
}
/**
 * Register morse.mcp.list - List available MCP servers
 */
function registerMCPListCommand(context) {
    context.subscriptions.push(vscode.commands.registerCommand('morse.mcp.list', async () => {
        try {
            const manager = getMCPClientManager();
            const servers = manager.listClients();
            if (servers.length === 0) {
                vscode.window.showInformationMessage('No MCP servers configured. Use "Morse: Add MCP Server" to add one.');
                return;
            }
            // Show quick pick with server list
            const items = servers.map(server => ({
                label: server.name,
                description: `Status: ${server.status} • Tools: ${server.tools.length}`,
                detail: server.status === 'connected' ? 'Connected' : 'Disconnected',
            }));
            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: 'Select an MCP server',
            });
            if (selected) {
                const serverInfo = servers.find(s => s.name === selected.label);
                if (serverInfo) {
                    vscode.window.showInformationMessage(`Server: ${serverInfo.name}\nStatus: ${serverInfo.status}\nTools: ${serverInfo.tools.length}`);
                }
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to list MCP servers: ${error}`);
        }
    }));
}
/**
 * Register morse.mcp.connect - Connect to an MCP server
 */
function registerMCPConnectCommand(context) {
    context.subscriptions.push(vscode.commands.registerCommand('morse.mcp.connect', async () => {
        try {
            const serverName = await vscode.window.showInputBox({
                prompt: 'Enter MCP server name to connect',
                placeHolder: 'e.g., filesystem, playwright',
            });
            if (!serverName) {
                return;
            }
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Connecting to ${serverName}...`,
                cancellable: false,
            }, async () => {
                const manager = getMCPClientManager();
                const client = manager.getClient(serverName);
                if (!client) {
                    throw new Error(`Server ${serverName} not found. Add it first using "Morse: Add MCP Server".`);
                }
                await client.connect();
                vscode.window.showInformationMessage(`Connected to MCP server: ${serverName}`);
            });
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to connect: ${error}`);
        }
    }));
}
/**
 * Register morse.mcp.disconnect - Disconnect from an MCP server
 */
function registerMCPDisconnectCommand(context) {
    context.subscriptions.push(vscode.commands.registerCommand('morse.mcp.disconnect', async () => {
        try {
            const manager = getMCPClientManager();
            const servers = manager.listClients();
            if (servers.length === 0) {
                vscode.window.showInformationMessage('No MCP servers to disconnect from.');
                return;
            }
            const items = servers.map(server => ({
                label: server.name,
                description: `Status: ${server.status}`,
            }));
            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: 'Select an MCP server to disconnect',
            });
            if (selected) {
                manager.disconnect(selected.label);
                vscode.window.showInformationMessage(`Disconnected from MCP server: ${selected.label}`);
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to disconnect: ${error}`);
        }
    }));
}
/**
 * Register morse.mcp.invoke - Invoke a tool on an MCP server
 */
function registerMCPInvokeCommand(context) {
    context.subscriptions.push(vscode.commands.registerCommand('morse.mcp.invoke', async (serverName, toolName) => {
        try {
            const manager = getMCPClientManager();
            const servers = manager.listClients().filter(s => s.status === 'connected');
            if (servers.length === 0) {
                vscode.window.showInformationMessage('No connected MCP servers. Connect to a server first.');
                return;
            }
            // Select server if not provided
            let selectedServer = serverName;
            if (!selectedServer) {
                const serverItems = servers.map(server => ({
                    label: server.name,
                    description: `${server.tools.length} tools`,
                }));
                const selected = await vscode.window.showQuickPick(serverItems, {
                    placeHolder: 'Select an MCP server',
                });
                if (!selected) {
                    return;
                }
                selectedServer = selected.label;
            }
            // Get tools from selected server
            const client = manager.getClient(selectedServer);
            if (!client) {
                throw new Error(`Server ${selectedServer} not found`);
            }
            const tools = client.getTools();
            // Select tool if not provided
            let selectedTool = toolName;
            if (!selectedTool) {
                const toolItems = tools.map(tool => ({
                    label: tool.name,
                    description: tool.description || '',
                }));
                const selected = await vscode.window.showQuickPick(toolItems, {
                    placeHolder: 'Select a tool to invoke',
                });
                if (!selected) {
                    return;
                }
                selectedTool = selected.label;
            }
            // Get tool arguments from user
            const tool = tools.find(t => t.name === selectedTool);
            if (!tool) {
                throw new Error(`Tool ${selectedTool} not found`);
            }
            // Build input fields based on tool schema
            const args = {};
            const inputSchema = tool.inputSchema;
            if (inputSchema.properties) {
                for (const [propName, propInfo] of Object.entries(inputSchema.properties)) {
                    const value = await vscode.window.showInputBox({
                        prompt: propInfo.description || `Enter ${propName}`,
                        placeHolder: propInfo.type,
                    });
                    if (value !== undefined) {
                        // Parse value based on type
                        if (propInfo.type === 'number') {
                            args[propName] = parseFloat(value);
                        }
                        else if (propInfo.type === 'boolean') {
                            args[propName] = value.toLowerCase() === 'true';
                        }
                        else {
                            args[propName] = value;
                        }
                    }
                }
            }
            // Invoke the tool
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Invoking ${selectedTool}...`,
                cancellable: false,
            }, async () => {
                const result = await manager.callTool(selectedServer, selectedTool, args);
                // Display result
                if (result.isError) {
                    vscode.window.showErrorMessage(`Tool error: ${JSON.stringify(result.content)}`);
                }
                else {
                    // Show result in document
                    const output = result.content
                        .map(c => c.type === 'text' ? c.text : JSON.stringify(c))
                        .join('\n');
                    const doc = await vscode.workspace.openTextDocument({
                        language: 'json',
                        content: output,
                    });
                    await vscode.window.showTextDocument(doc, {
                        viewColumn: vscode.ViewColumn.Beside,
                        preview: false,
                    });
                }
            });
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to invoke tool: ${error}`);
        }
    }));
}
/**
 * Register morse.mcp.add - Add an MCP server
 */
function registerMCPAddCommand(context) {
    context.subscriptions.push(vscode.commands.registerCommand('morse.mcp.add', async () => {
        try {
            // Get server name
            const name = await vscode.window.showInputBox({
                prompt: 'Enter MCP server name',
                placeHolder: 'e.g., filesystem, playwright',
            });
            if (!name) {
                return;
            }
            // Get server type
            const serverType = await vscode.window.showQuickPick([
                { label: 'stdio', description: 'Stdio-based MCP server' },
                { label: 'sse', description: 'Server-Sent Events MCP server' },
                { label: 'http', description: 'HTTP-based MCP server' },
            ], { placeHolder: 'Select server type' });
            if (!serverType) {
                return;
            }
            // Get command (for stdio)
            let command;
            if (serverType.label === 'stdio') {
                command = await vscode.window.showInputBox({
                    prompt: 'Enter command to run the MCP server',
                    placeHolder: 'e.g., npx @modelcontextprotocol/server-filesystem /path/to/dir',
                });
                if (!command) {
                    return;
                }
            }
            // Get URL (for http/sse)
            let url;
            if (serverType.label === 'http' || serverType.label === 'sse') {
                url = await vscode.window.showInputBox({
                    prompt: 'Enter server URL',
                    placeHolder: 'e.g., http://localhost:3000/mcp',
                });
                if (!url) {
                    return;
                }
            }
            // Create server config
            const config = {
                name,
                type: serverType.label,
                command,
                url,
            };
            // Add and connect to server
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Adding MCP server ${name}...`,
                cancellable: false,
            }, async () => {
                const manager = getMCPClientManager();
                await manager.addServer(config);
                vscode.window.showInformationMessage(`Added and connected to MCP server: ${name}`);
            });
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to add MCP server: ${error}`);
        }
    }));
}
/**
 * Register morse.mcp.remove - Remove an MCP server
 */
function registerMCPRemoveCommand(context) {
    context.subscriptions.push(vscode.commands.registerCommand('morse.mcp.remove', async () => {
        try {
            const manager = getMCPClientManager();
            const servers = manager.listClients();
            if (servers.length === 0) {
                vscode.window.showInformationMessage('No MCP servers to remove.');
                return;
            }
            const items = servers.map(server => ({
                label: server.name,
                description: `Status: ${server.status}`,
            }));
            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: 'Select an MCP server to remove',
            });
            if (selected) {
                manager.removeServer(selected.label);
                vscode.window.showInformationMessage(`Removed MCP server: ${selected.label}`);
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to remove MCP server: ${error}`);
        }
    }));
}
/**
 * Register morse.mcp.listTools - List tools from all connected MCP servers
 */
function registerMCPListToolsCommand(context) {
    context.subscriptions.push(vscode.commands.registerCommand('morse.mcp.listTools', async () => {
        try {
            const manager = getMCPClientManager();
            const allTools = manager.getAllTools();
            if (allTools.length === 0) {
                vscode.window.showInformationMessage('No tools available. Connect to an MCP server first.');
                return;
            }
            // Group tools by server
            const toolsByServer = new Map();
            for (const { serverName, tool } of allTools) {
                if (!toolsByServer.has(serverName)) {
                    toolsByServer.set(serverName, []);
                }
                toolsByServer.get(serverName).push({ serverName, tool });
            }
            // Create output
            let output = '# MCP Tools\n\n';
            for (const [serverName, tools] of toolsByServer) {
                output += `## ${serverName}\n\n`;
                for (const { tool } of tools) {
                    output += `- **${tool.name}**: ${tool.description || 'No description'}\n`;
                }
                output += '\n';
            }
            // Show in document
            const doc = await vscode.workspace.openTextDocument({
                language: 'markdown',
                content: output,
            });
            await vscode.window.showTextDocument(doc, {
                viewColumn: vscode.ViewColumn.Beside,
                preview: true,
            });
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to list tools: ${error}`);
        }
    }));
}
/**
 * Register Morse CLI MCP server commands
 */
function registerMorseMCPServerCommands(context) {
    // Register morse.mcp.server.list command - list configured MCP servers in morse-cli
    context.subscriptions.push(vscode.commands.registerCommand('morse.mcp.server.list', async () => {
        try {
            const { exec } = require('child_process');
            const { promisify } = require('util');
            const execAsync = promisify(exec);
            const { stdout } = await execAsync('morse mcp list --output json');
            const result = JSON.parse(stdout);
            if (result.enabled === false) {
                vscode.window.showInformationMessage('MCP is disabled. Enable it in .morse/config.yaml');
                return;
            }
            if (!result.lines || result.lines.length === 0) {
                vscode.window.showInformationMessage('No MCP servers configured in morse-cli');
                return;
            }
            // Show configured servers
            const items = result.lines.map((line) => ({
                label: line,
                description: 'Configured MCP server',
            }));
            await vscode.window.showQuickPick(items, {
                placeHolder: 'Configured MCP servers',
            });
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to list MCP servers: ${error}`);
        }
    }));
    // Register morse.mcp.server.start command - start an MCP server in morse-cli
    context.subscriptions.push(vscode.commands.registerCommand('morse.mcp.server.start', async () => {
        try {
            const serverName = await vscode.window.showInputBox({
                prompt: 'Enter MCP server name to start',
                placeHolder: 'Server name from morse mcp list',
            });
            if (!serverName) {
                return;
            }
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Starting MCP server ${serverName}...`,
                cancellable: false,
            }, async () => {
                const { exec } = require('child_process');
                const { promisify } = require('util');
                const execAsync = promisify(exec);
                await execAsync(`morse mcp start ${serverName}`);
                vscode.window.showInformationMessage(`Started MCP server: ${serverName}`);
            });
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to start MCP server: ${error}`);
        }
    }));
    // Register morse.mcp.server.stop command - stop an MCP server in morse-cli
    context.subscriptions.push(vscode.commands.registerCommand('morse.mcp.server.stop', async () => {
        try {
            const serverName = await vscode.window.showInputBox({
                prompt: 'Enter MCP server name to stop',
                placeHolder: 'Server name from morse mcp list',
            });
            if (!serverName) {
                return;
            }
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Stopping MCP server ${serverName}...`,
                cancellable: false,
            }, async () => {
                const { exec } = require('child_process');
                const { promisify } = require('util');
                const execAsync = promisify(exec);
                await execAsync(`morse mcp stop ${serverName}`);
                vscode.window.showInformationMessage(`Stopped MCP server: ${serverName}`);
            });
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to stop MCP server: ${error}`);
        }
    }));
    // Register morse.mcp.server.status command - show MCP server statuses
    context.subscriptions.push(vscode.commands.registerCommand('morse.mcp.server.status', async () => {
        try {
            const { exec } = require('child_process');
            const { promisify } = require('util');
            const execAsync = promisify(exec);
            const { stdout } = await execAsync('morse mcp servers --output json');
            const result = JSON.parse(stdout);
            if (!result.servers || result.servers.length === 0) {
                vscode.window.showInformationMessage('No MCP servers running');
                return;
            }
            // Show server statuses
            let output = '# MCP Server Status\n\n';
            for (const server of result.servers) {
                output += `## ${server.name}\n`;
                output += `- Running: ${server.running}\n`;
                output += `- Healthy: ${server.healthy}\n`;
                output += `- Type: ${server.type}\n`;
                output += `- Target: ${server.target}\n`;
                if (server.last_error) {
                    output += `- Last Error: ${server.last_error}\n`;
                }
                output += '\n';
            }
            const doc = await vscode.workspace.openTextDocument({
                language: 'markdown',
                content: output,
            });
            await vscode.window.showTextDocument(doc, {
                viewColumn: vscode.ViewColumn.Beside,
                preview: true,
            });
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to get MCP server status: ${error}`);
        }
    }));
}
//# sourceMappingURL=mcpCommands.js.map