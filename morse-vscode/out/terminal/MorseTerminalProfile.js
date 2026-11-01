"use strict";
/**
 * Morse Terminal Profile
 * Provides a terminal profile for Morse CLI integration
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
exports.MorseREPLTerminal = exports.MorseTerminalRecorder = exports.MorseTerminalLinkProvider = exports.MorseTerminalProfile = void 0;
exports.registerTerminalFeatures = registerTerminalFeatures;
const vscode = __importStar(require("vscode"));
class MorseTerminalProfile {
    client;
    constructor(client) {
        this.client = client;
    }
    async provideTerminalProfile(token) {
        const config = vscode.workspace.getConfiguration('morse');
        const morsePath = config.get('morsePath') || 'morse';
        const shellPath = process.platform === 'win32' ? 'cmd.exe' : '/bin/bash';
        const shellArgs = process.platform === 'win32' ? ['/c'] : ['-c'];
        // Get session ID asynchronously
        let sessionId = '';
        try {
            const session = await this.client.fetchCurrentSession();
            sessionId = session?.id || '';
        }
        catch {
            // Ignore session errors
        }
        // Create a custom terminal that runs Morse CLI
        const terminalOptions = {
            name: 'Morse',
            shellPath: shellPath,
            shellArgs: [
                ...shellArgs,
                this.buildMorseCommand(morsePath)
            ],
            env: {
                'MORSE_TERM': 'vscode',
                'MORSE_SESSION_ID': sessionId,
            },
            color: new vscode.ThemeColor('terminal.ansiBlue'),
        };
        return new vscode.TerminalProfile(terminalOptions);
    }
    buildMorseCommand(morsePath) {
        // Build the morse command with default args
        const config = vscode.workspace.getConfiguration('morse');
        const mode = config.get('defaultMode') || 'auto';
        return `${morsePath} run --mode ${mode}`;
    }
}
exports.MorseTerminalProfile = MorseTerminalProfile;
class MorseTerminalLinkProvider {
    client;
    constructor(client) {
        this.client = client;
    }
    provideTerminalLinks(context, _token) {
        const links = [];
        const line = context.line;
        const filePathRegex = /\/?[\w\-.]+\/[\w\-./]+(?:\.\w+)?/g;
        let match;
        while ((match = filePathRegex.exec(line)) !== null) {
            const start = match.index;
            const length = match[0].length;
            links.push({
                startIndex: start,
                length,
                tooltip: 'Open file',
                handle: match[0],
            });
        }
        const commandRegex = /morse\s+(\w+)/g;
        while ((match = commandRegex.exec(line)) !== null) {
            const length = match[0].length;
            links.push({
                startIndex: match.index,
                length,
                tooltip: 'Run Morse command',
                handle: `morse:${match[1]}`,
            });
        }
        return links;
    }
    handleTerminalLink(link) {
        if (link.handle.startsWith('morse:')) {
            vscode.commands.executeCommand('morse.chat', link.handle);
        }
        else {
            vscode.workspace.openTextDocument(link.handle).then(doc => vscode.window.showTextDocument(doc));
        }
    }
}
exports.MorseTerminalLinkProvider = MorseTerminalLinkProvider;
class MorseTerminalRecorder {
    outputChannel;
    maxLines = 10000;
    lines = [];
    constructor() {
        this.outputChannel = vscode.window.createOutputChannel('Morse Terminal');
    }
    recordOutput(output) {
        this.lines.push(output);
        // Keep only the last maxLines
        if (this.lines.length > this.maxLines) {
            this.lines = this.lines.slice(-this.maxLines);
        }
        this.outputChannel.append(output);
    }
    showOutput() {
        this.outputChannel.show();
    }
    clearOutput() {
        this.lines = [];
        this.outputChannel.clear();
    }
    getOutput() {
        return this.lines.join('\n');
    }
    dispose() {
        this.outputChannel.dispose();
    }
}
exports.MorseTerminalRecorder = MorseTerminalRecorder;
class MorseREPLTerminal {
    terminal = null;
    client;
    history = [];
    historyIndex = -1;
    currentInput = '';
    constructor(client) {
        this.client = client;
    }
    startREPL() {
        const config = vscode.workspace.getConfiguration('morse');
        const morsePath = config.get('morsePath') || 'morse';
        this.terminal = vscode.window.createTerminal({
            name: 'Morse REPL',
            shellPath: process.platform === 'win32' ? 'cmd.exe' : '/bin/bash',
            shellArgs: process.platform === 'win32' ? ['/c'] : ['-c'],
            env: {
                'MORSE_REPL': 'true',
            },
        });
        this.terminal.sendText(`${morsePath} repl`);
        this.terminal.show();
        // Terminal output is handled via terminal's onDidWriteData if available
        const term = this.terminal;
        if (term.onDidWriteData) {
            term.onDidWriteData((data) => { this.handleTerminalOutput(data); });
        }
    }
    async handleTerminalOutput(data) {
        // Handle REPL commands and send to Morse
        if (data.trim().startsWith('/')) {
            const command = data.trim();
            this.history.push(command);
            this.historyIndex = this.history.length;
            // Process REPL commands
            await this.processREPLCommand(command);
        }
    }
    async processREPLCommand(command) {
        const [cmd, ...args] = command.slice(1).split(' ');
        switch (cmd) {
            case 'help':
                this.terminal?.sendText('Available commands: /ask, /edit, /fix, /explain, /test, /commit');
                break;
            case 'ask':
                await this.client.sendMessage(args.join(' '));
                break;
            case 'clear':
                // Clear terminal - send clear command
                break;
            default:
                this.terminal?.sendText(`Unknown command: ${cmd}. Type /help for available commands.`);
        }
    }
    sendInput(input) {
        if (this.terminal) {
            this.terminal.sendText(input);
            this.currentInput = input;
        }
    }
    getHistory() {
        return [...this.history];
    }
    navigateHistory(direction) {
        if (direction === 'up' && this.historyIndex > 0) {
            this.historyIndex--;
            return this.history[this.historyIndex];
        }
        else if (direction === 'down' && this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            return this.history[this.historyIndex];
        }
        else if (direction === 'down') {
            this.historyIndex = this.history.length;
            return '';
        }
        return null;
    }
    dispose() {
        this.terminal?.dispose();
        this.terminal = null;
    }
}
exports.MorseREPLTerminal = MorseREPLTerminal;
function registerTerminalFeatures(context, client) {
    // Register terminal profile
    const profileProvider = new MorseTerminalProfile(client);
    context.subscriptions.push(vscode.window.registerTerminalProfileProvider('morse-terminal', profileProvider));
    // Register terminal link provider
    const linkProvider = new MorseTerminalLinkProvider(client);
    context.subscriptions.push(vscode.window.registerTerminalLinkProvider(linkProvider));
    // Register terminal commands
    context.subscriptions.push(vscode.commands.registerCommand('morse.terminal.startREPL', () => {
        const repl = new MorseREPLTerminal(client);
        repl.startREPL();
        context.subscriptions.push(repl);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('morse.terminal.showOutput', () => {
        const recorder = new MorseTerminalRecorder();
        recorder.showOutput();
    }));
    // Register terminal profile in settings
    vscode.workspace.getConfiguration('terminal').update('integrated.profiles', {
        ...vscode.workspace.getConfiguration('terminal').get('integrated.profiles'),
        'Morse': {
            'source': 'Morse',
            'id': 'morse-terminal',
        },
    }, vscode.ConfigurationTarget.Global);
}
//# sourceMappingURL=MorseTerminalProfile.js.map