/**
 * Enhanced Chat Panel with Streaming, Session Persistence, and Error Handling
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { MorseClient } from '../../morse/client';
import { MorseProtocol } from '../../morse/protocol';

interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'error';
    content: string;
    timestamp: string;
    attachments?: Array<{ name: string; content: string; language?: string }>;
    streaming?: boolean;
}

interface ChatSession {
    id: string;
    title: string;
    messages: ChatMessage[];
    createdAt: string;
    updatedAt: string;
}

export class ChatPanel {
    public static currentPanel: ChatPanel | undefined;
    public static readonly viewType = 'morse.chat';

    private readonly panel: vscode.WebviewPanel;
    private readonly extensionUri: vscode.Uri;
    private readonly client: MorseClient;
    private readonly context: vscode.ExtensionContext;
    private disposables: vscode.Disposable[] = [];
    private currentSession: ChatSession;
    private streamingMessageId: string | null = null;

    public static create(
        extensionUri: vscode.Uri,
        client: MorseClient,
        context: vscode.ExtensionContext
    ): ChatPanel {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        const panel = vscode.window.createWebviewPanel(
            ChatPanel.viewType,
            'Morse Chat',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(extensionUri, 'webview'),
                ],
            }
        );

        ChatPanel.currentPanel = new ChatPanel(panel, extensionUri, client, context);
        return ChatPanel.currentPanel;
    }

    public static revive(
        panel: vscode.WebviewPanel,
        extensionUri: vscode.Uri,
        client: MorseClient,
        context: vscode.ExtensionContext
    ): ChatPanel {
        ChatPanel.currentPanel = new ChatPanel(panel, extensionUri, client, context);
        return ChatPanel.currentPanel;
    }

    private constructor(
        panel: vscode.WebviewPanel,
        extensionUri: vscode.Uri,
        client: MorseClient,
        context: vscode.ExtensionContext
    ) {
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

    private setupEventListeners(): void {
        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

        this.panel.webview.onDidReceiveMessage(
            async (message) => {
                try {
                    await this.handleWebviewMessage(message);
                } catch (error) {
                    this.sendErrorToWebview('Failed to process message: ' + (error as Error).message);
                }
            },
            null,
            this.disposables
        );

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

    private async handleWebviewMessage(message: any): Promise<void> {
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
            case 'openLink':
                try {
                    await vscode.env.openExternal(vscode.Uri.parse(message.url));
                } catch (error) {
                    console.error('[ChatPanel] Failed to open link:', error);
                }
                break;
            case 'fileChange':
                // File change notifications are currently ignored; could be used for auto-reload in future
                // Silently ignore to avoid spamming
                break;
        }
    }

    private async handleSendMessage(text: string, messageId: string): Promise<void> {
        const config = vscode.workspace.getConfiguration('morse');
        const enableStreaming = config.get<boolean>('enableStreaming', true);

        try {
            if (enableStreaming) {
                await this.handleStreamingMessage(text, messageId);
            } else {
                await this.handleNonStreamingMessage(text, messageId);
            }
        } catch (error) {
            this.sendErrorToWebview((error as Error).message);
        }
    }

    private async handleStreamingMessage(text: string, messageId: string): Promise<void> {
        const streamingMessageId = `stream-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        try {
            const stream = await this.client.sendMessageStream(text, {
                sessionId: this.currentSession.id,
                messageId: messageId,
            });

            for await (const chunk of stream) {
                this.panel.webview.postMessage({
                    command: 'streamChunk',
                    chunk: chunk.content,
                    messageId: streamingMessageId,
                });

                // Add or update message in session
                let msg = this.currentSession.messages.find(m => m.id === streamingMessageId);
                if (!msg) {
                    msg = {
                        id: streamingMessageId,
                        role: 'assistant',
                        content: chunk.content,
                        timestamp: new Date().toISOString(),
                        streaming: true,
                    };
                    this.currentSession.messages.push(msg);
                } else {
                    msg.content += chunk.content;
                }
            }

            // Mark streaming as complete
            const finalMsg = this.currentSession.messages.find(m => m.id === streamingMessageId);
            if (finalMsg) {
                finalMsg.streaming = false;
            }
        } catch (error) {
            this.sendErrorToWebview((error as Error).message);
            // Clear streaming state
            const errMsg = this.currentSession.messages.find(m => m.id === streamingMessageId);
            if (errMsg) {
                errMsg.streaming = false;
            }
        }

        await this.saveSession();
        this.sendSessionToWebview();
    }

    private async handleNonStreamingMessage(text: string, messageId: string): Promise<void> {
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

    private async handleAttachFile(): Promise<void> {
        const uris = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: true,
            openLabel: 'Attach',
        });

        if (!uris || uris.length === 0) return;

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
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to attach file: ${(error as Error).message}`);
            }
        }
    }

    private async handleExportChat(): Promise<void> {
        const uri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(`morse-chat-${new Date().toISOString().split('T')[0]}.json`),
            filters: {
                'JSON': ['json'],
                'Markdown': ['md'],
            },
        });

        if (!uri) return;

        const ext = path.extname(uri.fsPath);
        let content: string;

        if (ext === '.md') {
            content = this.exportAsMarkdown();
        } else {
            content = JSON.stringify(this.currentSession, null, 2);
        }

        await fs.promises.writeFile(uri.fsPath, content, 'utf-8');
        vscode.window.showInformationMessage('Chat exported successfully');
    }

    private exportAsMarkdown(): string {
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

    private async handleHunkAction(hunkId: string, action: 'accept' | 'reject'): Promise<void> {
        // This would be implemented to work with the diff viewer
        vscode.commands.executeCommand(
            action === 'accept' ? 'morse.acceptHunk' : 'morse.rejectHunk',
            hunkId
        );
    }

    private getLanguageFromFileName(fileName: string): string {
        const ext = path.extname(fileName).toLowerCase();
        const languageMap: Record<string, string> = {
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

    private loadSession(): ChatSession {
        const config = vscode.workspace.getConfiguration('morse');
        const persistence = config.get<boolean>('sessionPersistence', true);

        if (persistence) {
            const saved = this.context.globalState.get<ChatSession>('morse.currentSession');
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

    private saveSession(): void {
        this.currentSession.updatedAt = new Date().toISOString();

        const config = vscode.workspace.getConfiguration('morse');
        const persistence = config.get<boolean>('sessionPersistence', true);

        if (persistence) {
            this.context.globalState.update('morse.currentSession', this.currentSession);
        }
    }

    private clearSession(): void {
        this.currentSession = {
            id: `session-${Date.now()}`,
            title: 'New Chat',
            messages: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        this.saveSession();
    }

    private sendSessionToWebview(): void {
        this.panel.webview.postMessage({
            command: 'setMessages',
            messages: this.currentSession.messages,
        });
    }

    private sendErrorToWebview(error: string): void {
        this.panel.webview.postMessage({
            command: 'streamError',
            error: error,
        });
    }

    private async checkConnection(): Promise<void> {
        try {
            const connected = await this.client.checkConnection();
            this.panel.webview.postMessage({
                command: 'connectionStatus',
                status: connected ? 'connected' : 'error',
            });
        } catch {
            this.panel.webview.postMessage({
                command: 'connectionStatus',
                status: 'error',
            });
        }
    }

    private notifyFileChange(filePath: string, type: 'changed' | 'created' | 'deleted'): void {
        // Notify the webview about file changes
        this.panel.webview.postMessage({
            command: 'fileChange',
            filePath,
            type,
        });
    }

    public reveal(): void {
        this.panel.reveal();
    }

    public addCodeContext(code: string, language: string, fileName: string): void {
        const contextMessage: ChatMessage = {
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

    public addHunk(hunk: any): void {
        this.panel.webview.postMessage({
            command: 'addHunk',
            hunk: hunk,
        });
    }

    private update(): void {
        const webview = this.panel.webview;
        webview.html = this.getHtmlForWebview(webview);
    }

    private getHtmlForWebview(webview: vscode.Webview): string {
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

    public dispose(): void {
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
