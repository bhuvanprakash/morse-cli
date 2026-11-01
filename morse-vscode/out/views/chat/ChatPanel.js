"use strict";
/**
 * Enhanced Chat Panel with Streaming, Session Persistence, and Error Handling
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
exports.ChatPanel = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
class ChatPanel {
    static currentPanel;
    static viewType = 'morse.chat';
    panel;
    extensionUri;
    client;
    context;
    disposables = [];
    currentSession;
    streamingMessageId = null;
    static create(extensionUri, client, context) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;
        const panel = vscode.window.createWebviewPanel(ChatPanel.viewType, 'Morse Chat', column || vscode.ViewColumn.One, {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [
                vscode.Uri.joinPath(extensionUri, 'webview'),
            ],
        });
        ChatPanel.currentPanel = new ChatPanel(panel, extensionUri, client, context);
        return ChatPanel.currentPanel;
    }
    static revive(panel, extensionUri, client, context) {
        ChatPanel.currentPanel = new ChatPanel(panel, extensionUri, client, context);
        return ChatPanel.currentPanel;
    }
    constructor(panel, extensionUri, client, context) {
        this.panel = panel;
        this.extensionUri = extensionUri;
        this.client = client;
        this.context = context;
        // Load or create session
        this.currentSession = this.loadSession();
        this.update();
        this.setupEventListeners();
        this.checkConnection();
    }
    setupEventListeners() {
        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
        this.panel.webview.onDidReceiveMessage(async (message) => {
            try {
                await this.handleWebviewMessage(message);
            }
            catch (error) {
                this.sendErrorToWebview('Failed to process message: ' + error.message);
            }
        }, null, this.disposables);
        // Listen for file changes
        const fileWatcher = vscode.workspace.createFileSystemWatcher('**/*');
        fileWatcher.onDidChange((uri) => {
            this.notifyFileChange(uri.fsPath, 'changed');
        });
        fileWatcher.onDidCreate((uri) => {
            this.notifyFileChange(uri.fsPath, 'created');
        });
        fileWatcher.onDidDelete((uri) => {
            this.notifyFileChange(uri.fsPath, 'deleted');
        });
        this.disposables.push(fileWatcher);
    }
    async handleWebviewMessage(message) {
        switch (message.command) {
            case 'webviewReady':
                this.sendSessionToWebview();
                break;
            case 'sendMessage':
                await this.handleSendMessage(message.text, message.messageId);
                break;
            case 'clearChat':
                this.clearSession();
                break;
            case 'attachFile':
                await this.handleAttachFile();
                break;
            case 'exportChat':
                await this.handleExportChat();
                break;
            case 'hunkAction':
                await this.handleHunkAction(message.hunkId, message.action);
                break;
        }
    }
    async handleSendMessage(text, messageId) {
        const config = vscode.workspace.getConfiguration('morse');
        const enableStreaming = config.get('enableStreaming', true);
        try {
            if (enableStreaming) {
                await this.handleStreamingMessage(text, messageId);
            }
            else {
                await this.handleNonStreamingMessage(text, messageId);
            }
        }
        catch (error) {
            this.sendErrorToWebview(error.message);
        }
    }
    async handleStreamingMessage(text, messageId) {
        this.streamingMessageId = `stream-${Date.now()}`;
        try {
            const stream = await this.client.sendMessageStream(text, {
                sessionId: this.currentSession.id,
                messageId: messageId,
            });
            for await (const chunk of stream) {
                this.panel.webview.postMessage({
                    command: 'streamChunk',
                    chunk: chunk.content,
                    messageId: this.streamingMessageId,
                });
                // Add to session
                if (!this.currentSession.messages.find(m => m.id === this.streamingMessageId)) {
                    this.currentSession.messages.push({
                        id: this.streamingMessageId,
                        role: 'assistant',
                        content: chunk.content,
                        timestamp: new Date().toISOString(),
                        streaming: true,
                    });
                }
                else {
                    const msg = this.currentSession.messages.find(m => m.id === this.streamingMessageId);
                    if (msg) {
                        msg.content += chunk.content;
                    }
                }
            }
            // Mark streaming as complete
            const msg = this.currentSession.messages.find(m => m.id === this.streamingMessageId);
            if (msg) {
                msg.streaming = false;
            }
            this.panel.webview.postMessage({
                command: 'streamEnd',
                messageId: this.streamingMessageId,
            });
            this.streamingMessageId = null;
            this.saveSession();
        }
        catch (error) {
            this.panel.webview.postMessage({
                command: 'streamError',
                error: error.message,
            });
            this.streamingMessageId = null;
        }
    }
    async handleNonStreamingMessage(text, messageId) {
        const response = await this.client.sendMessage(text, {
            sessionId: this.currentSession.id,
            messageId: messageId,
        });
        this.currentSession.messages.push({
            id: `msg-${Date.now()}`,
            role: 'assistant',
            content: response.content,
            timestamp: new Date().toISOString(),
        });
        this.panel.webview.postMessage({
            command: 'receiveMessage',
            text: response.content,
        });
        this.saveSession();
    }
    async handleAttachFile() {
        const uris = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: true,
            openLabel: 'Attach',
        });
        if (!uris || uris.length === 0)
            return;
        for (const uri of uris) {
            try {
                const content = await fs.promises.readFile(uri.fsPath, 'utf-8');
                const fileName = path.basename(uri.fsPath);
                const language = this.getLanguageFromFileName(fileName);
                this.panel.webview.postMessage({
                    command: 'addAttachment',
                    file: {
                        name: fileName,
                        content: content,
                        language: language,
                    },
                });
            }
            catch (error) {
                vscode.window.showErrorMessage(`Failed to attach file: ${error.message}`);
            }
        }
    }
    async handleExportChat() {
        const uri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(`morse-chat-${new Date().toISOString().split('T')[0]}.json`),
            filters: {
                'JSON': ['json'],
                'Markdown': ['md'],
            },
        });
        if (!uri)
            return;
        const ext = path.extname(uri.fsPath);
        let content;
        if (ext === '.md') {
            content = this.exportAsMarkdown();
        }
        else {
            content = JSON.stringify(this.currentSession, null, 2);
        }
        await fs.promises.writeFile(uri.fsPath, content, 'utf-8');
        vscode.window.showInformationMessage('Chat exported successfully');
    }
    exportAsMarkdown() {
        let md = `# ${this.currentSession.title}\n\n`;
        md += `Created: ${this.currentSession.createdAt}\n\n`;
        md += `---\n\n`;
        for (const msg of this.currentSession.messages) {
            const role = msg.role === 'user' ? '👤 You' : msg.role === 'error' ? '⚠️ Error' : '⚡ Morse';
            md += `## ${role}\n\n`;
            md += `${msg.content}\n\n`;
            md += `---\n\n`;
        }
        return md;
    }
    async handleHunkAction(hunkId, action) {
        // This would be implemented to work with the diff viewer
        vscode.commands.executeCommand(action === 'accept' ? 'morse.acceptHunk' : 'morse.rejectHunk', hunkId);
    }
    getLanguageFromFileName(fileName) {
        const ext = path.extname(fileName).toLowerCase();
        const languageMap = {
            '.js': 'javascript',
            '.ts': 'typescript',
            '.tsx': 'tsx',
            '.jsx': 'jsx',
            '.py': 'python',
            '.go': 'go',
            '.rs': 'rust',
            '.java': 'java',
            '.cpp': 'cpp',
            '.c': 'c',
            '.h': 'c',
            '.cs': 'csharp',
            '.rb': 'ruby',
            '.php': 'php',
            '.swift': 'swift',
            '.kt': 'kotlin',
            '.scala': 'scala',
            '.r': 'r',
            '.sql': 'sql',
            '.sh': 'bash',
            '.yaml': 'yaml',
            '.yml': 'yaml',
            '.json': 'json',
            '.xml': 'xml',
            '.html': 'html',
            '.css': 'css',
            '.scss': 'scss',
            '.less': 'less',
            '.md': 'markdown',
        };
        return languageMap[ext] || 'text';
    }
    loadSession() {
        const config = vscode.workspace.getConfiguration('morse');
        const persistence = config.get('sessionPersistence', true);
        if (persistence) {
            const saved = this.context.globalState.get('morse.currentSession');
            if (saved) {
                return saved;
            }
        }
        return {
            id: `session-${Date.now()}`,
            title: 'New Chat',
            messages: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
    }
    saveSession() {
        this.currentSession.updatedAt = new Date().toISOString();
        const config = vscode.workspace.getConfiguration('morse');
        const persistence = config.get('sessionPersistence', true);
        if (persistence) {
            this.context.globalState.update('morse.currentSession', this.currentSession);
        }
    }
    clearSession() {
        this.currentSession = {
            id: `session-${Date.now()}`,
            title: 'New Chat',
            messages: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        this.saveSession();
    }
    sendSessionToWebview() {
        this.panel.webview.postMessage({
            command: 'setMessages',
            messages: this.currentSession.messages,
        });
    }
    sendErrorToWebview(error) {
        this.panel.webview.postMessage({
            command: 'streamError',
            error: error,
        });
    }
    async checkConnection() {
        try {
            const connected = await this.client.checkConnection();
            this.panel.webview.postMessage({
                command: 'connectionStatus',
                status: connected ? 'connected' : 'error',
            });
        }
        catch {
            this.panel.webview.postMessage({
                command: 'connectionStatus',
                status: 'error',
            });
        }
    }
    notifyFileChange(filePath, type) {
        // Notify the webview about file changes
        this.panel.webview.postMessage({
            command: 'fileChange',
            filePath,
            type,
        });
    }
    reveal() {
        this.panel.reveal();
    }
    addCodeContext(code, language, fileName) {
        const contextMessage = {
            id: `ctx-${Date.now()}`,
            role: 'user',
            content: `Here's some code from ${fileName}:\n\n\`\`\`${language}\n${code}\n\`\`\`\n\nPlease analyze this code.`,
            timestamp: new Date().toISOString(),
        };
        this.currentSession.messages.push(contextMessage);
        this.saveSession();
        this.sendSessionToWebview();
        this.panel.reveal();
        // Auto-send the context message
        this.handleSendMessage(contextMessage.content, contextMessage.id);
    }
    addHunk(hunk) {
        this.panel.webview.postMessage({
            command: 'addHunk',
            hunk: hunk,
        });
    }
    update() {
        const webview = this.panel.webview;
        webview.html = this.getHtmlForWebview(webview);
    }
    getHtmlForWebview(webview) {
        const chatPath = vscode.Uri.joinPath(this.extensionUri, 'webview', 'chat');
        const htmlPath = vscode.Uri.joinPath(chatPath, 'index.html');
        let html = fs.readFileSync(htmlPath.fsPath, 'utf-8');
        // Convert local paths to webview URIs
        const stylesUri = webview.asWebviewUri(vscode.Uri.joinPath(chatPath, 'styles.css'));
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(chatPath, 'chat.js'));
        html = html.replace('styles.css', stylesUri.toString());
        html = html.replace('chat.js', scriptUri.toString());
        return html;
    }
    dispose() {
        ChatPanel.currentPanel = undefined;
        this.panel.dispose();
        while (this.disposables.length) {
            const disposable = this.disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
}
exports.ChatPanel = ChatPanel;
//# sourceMappingURL=ChatPanel.js.map