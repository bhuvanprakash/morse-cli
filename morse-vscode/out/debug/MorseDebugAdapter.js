"use strict";
/**
 * Morse Debug Adapter
 * Debugging support for Morse-assisted debugging
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
exports.MorseBreakpointManager = exports.MorseDebugAdapter = void 0;
exports.registerDebugAdapterFeatures = registerDebugAdapterFeatures;
const vscode = __importStar(require("vscode"));
const net = __importStar(require("net"));
const child_process = __importStar(require("child_process"));
class MorseDebugAdapter {
    context;
    client;
    activeSessions = new Map();
    serverProcess = null;
    serverPort = 4711;
    constructor(context, client) {
        this.context = context;
        this.client = client;
    }
    // Create debug adapter tracker
    createDebugAdapterTracker(session) {
        const tracker = new MorseDebugAdapterTracker(session, this.client);
        return tracker;
    }
    // Create debug adapter descriptor (DebugAdapterDescriptorFactory)
    createDebugAdapterDescriptor(_session, _executable, _token) {
        return this.startDebugAdapterServer().then((server) => {
            return new vscode.DebugAdapterServer(server.port, 'localhost');
        });
    }
    async startDebugAdapterServer() {
        const port = await this.findAvailablePort();
        const adapterPath = this.getAdapterPath();
        const env = typeof process !== 'undefined' ? { ...process.env, 'MORSE_DEBUG': 'true' } : { MORSE_DEBUG: 'true' };
        const proc = child_process.spawn(adapterPath, [`--port=${port}`], {
            stdio: ['pipe', 'pipe', 'pipe'],
            env,
        });
        return { port, process: proc };
    }
    async findAvailablePort() {
        return new Promise((resolve, reject) => {
            const server = net.createServer();
            server.unref();
            server.on('error', reject);
            server.listen(0, () => {
                const address = server.address();
                const port = address.port;
                server.close(() => resolve(port));
            });
        });
    }
    getAdapterPath() {
        // Use the morse CLI debug adapter
        const config = vscode.workspace.getConfiguration('morse');
        return config.get('debugAdapterPath') || 'morse';
    }
    // Create debug configuration
    async createDebugConfiguration(folder, type, token) {
        const configurations = [
            {
                type: 'morse-node',
                name: 'Morse: Node.js',
                request: 'launch',
                program: '${workspaceFolder}/${relativeFilePath}',
                args: [],
                cwd: '${workspaceFolder}',
            },
            {
                type: 'morse-python',
                name: 'Morse: Python',
                request: 'launch',
                program: '${workspaceFolder}/${relativeFilePath}',
                args: [],
                cwd: '${workspaceFolder}',
            },
            {
                type: 'morse-go',
                name: 'Morse: Go',
                request: 'launch',
                program: '${workspaceFolder}/${relativeFilePath}',
                args: [],
                cwd: '${workspaceFolder}',
            },
        ];
        return configurations;
    }
    // Handle debugging with Morse AI assistance
    async debugWithMorse(session, request, config) {
        // Create debug session with Morse assistance
        const debugSession = {
            id: session.id,
            name: config.name,
            configuration: config,
            state: 'initialized',
            breakpoints: new Map(),
        };
        this.activeSessions.set(session.id, debugSession);
        // Start debugging
        await vscode.debug.startDebugging(undefined, config);
    }
    // Analyze breakpoint and suggest fixes
    async analyzeBreakpoint(session, breakpoint) {
        const suggestions = [];
        // Get context from the breakpoint location (SourceBreakpoint has uri/range)
        const bp = breakpoint;
        const location = bp.uri && bp.range ? { uri: bp.uri, range: bp.range } : undefined;
        if (location?.uri) {
            const document = await vscode.workspace.openTextDocument(location.uri);
            const line = document.lineAt(location.range.start.line);
            // Send to Morse for analysis
            const response = await this.client.sendMessage(`Analyze this code for potential bugs or issues:\n${line.text}`);
            suggestions.push(response.content);
        }
        return suggestions;
    }
    // Handle exception with Morse
    async handleException(session, exception) {
        const suggestions = [];
        // Get stack trace
        const stackTrace = await session.customRequest('stackTrace');
        // Send to Morse for analysis
        const response = await this.client.sendMessage(`Analyze this error and suggest a fix:\n${JSON.stringify(exception)}`);
        suggestions.push(response.content);
        return suggestions;
    }
    dispose() {
        // Clean up server process
        if (this.serverProcess) {
            this.serverProcess.kill();
            this.serverProcess = null;
        }
        // Clear sessions
        this.activeSessions.clear();
    }
}
exports.MorseDebugAdapter = MorseDebugAdapter;
class MorseDebugAdapterTracker {
    session;
    client;
    outputChannel;
    constructor(session, client) {
        this.session = session;
        this.client = client;
        this.outputChannel = vscode.window.createOutputChannel(`Debug: ${session.name}`);
    }
    onWillStartSession() {
        this.outputChannel.appendLine(`[Morse Debug] Starting debug session: ${this.session.name}`);
        this.outputChannel.show();
    }
    onWillStopSession() {
        this.outputChannel.appendLine(`[Morse Debug] Stopping debug session: ${this.session.name}`);
    }
    onError(error) {
        this.outputChannel.appendLine(`[Morse Debug] Error: ${error.message}`);
        // Send error to Morse for analysis
        this.client.sendMessage(`Debug session encountered an error: ${error.message}. Please analyze and suggest a fix.`).then(response => {
            this.outputChannel.appendLine(`[Morse Suggestion] ${response.content}`);
        });
    }
    onWillReceiveMessage(message) {
        // Log message if it's a breakpoint or exception
        const msg = message;
        if (msg.type === 'event') {
            const event = msg.event;
            if (event === 'stopped' || event === 'breakpoint') {
                this.outputChannel.appendLine(`[Morse Debug] Event: ${event}`);
            }
        }
    }
    onDidSendMessage(message) {
        const msg = message;
        // Log significant messages
        if (msg.type === 'response' && msg.command) {
            this.outputChannel.appendLine(`[Morse Debug] Response: ${msg.command}`);
        }
    }
    onExit(code, signal) {
        const exitInfo = code !== undefined ? `code ${code}` : `signal ${signal}`;
        this.outputChannel.appendLine(`[Morse Debug] Exited with ${exitInfo}`);
    }
    dispose() {
        this.outputChannel.dispose();
    }
}
// Breakpoint management with Morse assistance
class MorseBreakpointManager {
    context;
    client;
    suggestedBreakpoints = new Map();
    constructor(context, client) {
        this.context = context;
        this.client = client;
    }
    // Suggest breakpoints based on code analysis
    async suggestBreakpoints(document) {
        const suggestions = [];
        // Get full document text
        const text = document.getText();
        // Analyze with Morse
        const response = await this.client.sendMessage(`Analyze this code and suggest which lines would be good breakpoints for debugging. 
            Return the line numbers as a comma-separated list:\n\n${text.slice(0, 5000)}`);
        // Parse line numbers from response
        const lineNumbers = response.content.match(/\d+/g);
        if (lineNumbers) {
            for (const lineNum of lineNumbers) {
                const line = parseInt(lineNum, 10);
                if (line > 0 && line <= document.lineCount) {
                    const position = new vscode.Position(line - 1, 0);
                    const range = new vscode.Range(position, position);
                    const bp = new vscode.SourceBreakpoint(new vscode.Location(document.uri, range), false, undefined, undefined, 'Morse suggested breakpoint');
                    suggestions.push(bp);
                }
            }
        }
        // Store suggestions
        this.suggestedBreakpoints.set(document.uri.toString(), suggestions);
        return suggestions;
    }
    // Apply suggested breakpoints
    async applySuggestedBreakpoints(document) {
        const suggestions = this.suggestedBreakpoints.get(document.uri.toString());
        if (!suggestions || suggestions.length === 0) {
            vscode.window.showInformationMessage('No breakpoint suggestions available');
            return;
        }
        vscode.debug.addBreakpoints(suggestions);
        vscode.window.showInformationMessage(`Added ${suggestions.length} breakpoints suggested by Morse`);
    }
}
exports.MorseBreakpointManager = MorseBreakpointManager;
function registerDebugAdapterFeatures(context, client) {
    const debugAdapter = new MorseDebugAdapter(context, client);
    const breakpointManager = new MorseBreakpointManager(context, client);
    // Register debug adapter tracker factory
    context.subscriptions.push(vscode.debug.registerDebugAdapterTrackerFactory('*', debugAdapter));
    // Register debug adapter descriptor factory
    context.subscriptions.push(vscode.debug.registerDebugAdapterDescriptorFactory('morse-*', debugAdapter));
    // Register debug configuration provider
    context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('morse-*', {
        provideDebugConfigurations: (folder, token) => {
            return debugAdapter.createDebugConfiguration(folder, 'morse', token);
        },
        resolveDebugConfiguration: (folder, config, token) => {
            return config;
        },
    }));
    // Register commands
    context.subscriptions.push(vscode.commands.registerCommand('morse.debug.analyze', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('No active editor');
            return;
        }
        const suggestions = await breakpointManager.suggestBreakpoints(editor.document);
        if (suggestions.length > 0) {
            const response = await vscode.window.showInformationMessage(`Morse suggests ${suggestions.length} breakpoints. Apply them?`, 'Apply', 'Ignore');
            if (response === 'Apply') {
                await breakpointManager.applySuggestedBreakpoints(editor.document);
            }
        }
        else {
            vscode.window.showInformationMessage('No breakpoint suggestions found');
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('morse.debug.fix', async () => {
        const debugSession = vscode.debug.activeDebugSession;
        if (!debugSession) {
            vscode.window.showWarningMessage('No active debug session');
            return;
        }
        // Get current exception info
        const exception = await debugSession.customRequest('exceptionInfo');
        if (exception) {
            const response = await client.sendMessage(`Debug session error: ${JSON.stringify(exception)}. Suggest a fix.`);
            vscode.window.showInformationMessage(response.content);
        }
    }));
}
//# sourceMappingURL=MorseDebugAdapter.js.map