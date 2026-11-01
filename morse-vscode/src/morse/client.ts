/**
 * Enhanced Morse Client with Streaming Support
 */

import * as vscode from 'vscode';
import { MorseProtocol } from './protocol';

interface ClientConfig {
    endpoint: string;
    apiKey: string;
}

interface MessageOptions {
    sessionId?: string;
    messageId?: string;
}

interface StreamChunk {
    content: string;
    done: boolean;
}

export class MorseClient {
    private config: ClientConfig = { endpoint: 'http://localhost:8080', apiKey: '' };
    private outputChannel: vscode.OutputChannel;

    constructor() {
        this.outputChannel = vscode.window.createOutputChannel('Morse');
        this.loadConfig();

        // Watch for configuration changes
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('morse')) {
                this.loadConfig();
            }
        });
    }

    private loadConfig(): void {
        const config = vscode.workspace.getConfiguration('morse');
        this.config = {
            endpoint: config.get<string>('endpoint', 'http://localhost:8080'),
            apiKey: config.get<string>('apiKey', ''),
        };
    }

    public async checkConnection(): Promise<boolean> {
        try {
            const response = await fetch(`${this.config.endpoint}/health`, {
                method: 'GET',
                headers: this.getHeaders(),
            });
            return response.ok;
        } catch {
            return false;
        }
    }

    public async *sendMessageStream(
        message: string,
        options?: MessageOptions
    ): AsyncGenerator<StreamChunk> {
        const response = await fetch(`${this.config.endpoint}/api/v1/chat/stream`, {
            method: 'POST',
            headers: {
                ...this.getHeaders(),
                'Content-Type': 'application/json',
                'Accept': 'text/event-stream',
            },
            body: JSON.stringify({
                message,
                sessionId: options?.sessionId,
                messageId: options?.messageId,
            }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        if (!response.body) {
            throw new Error('Response body is null');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') {
                            return;
                        }
                        try {
                            const parsed = JSON.parse(data);
                            yield {
                                content: parsed.content || '',
                                done: parsed.done || false,
                            };
                        } catch (err) {
                            console.error('[Morse] Failed to parse stream data:', err, 'Raw data:', data);
                            // Skip invalid JSON but continue streaming
                        }
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }
    }

    public async sendMessage(
        message: string,
        options?: MessageOptions
    ): Promise<{ content: string }> {
        const response = await fetch(`${this.config.endpoint}/api/v1/chat`, {
            method: 'POST',
            headers: {
                ...this.getHeaders(),
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message,
                sessionId: options?.sessionId,
                messageId: options?.messageId,
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(error || `HTTP error! status: ${response.status}`);
        }

        return response.json() as Promise<{ content: string }>;
    }

    public async sendCommand(
        command: MorseProtocol.CommandType,
        params: Record<string, any>
    ): Promise<MorseProtocol.CommandResponse> {
        const response = await fetch(`${this.config.endpoint}/api/v1/command`, {
            method: 'POST',
            headers: {
                ...this.getHeaders(),
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                command,
                params,
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(error || `HTTP error! status: ${response.status}`);
        }

        return response.json() as Promise<MorseProtocol.CommandResponse>;
    }

    public async getSessionHistory(sessionId: string): Promise<MorseProtocol.ChatMessage[]> {
        const response = await fetch(
            `${this.config.endpoint}/api/v1/sessions/${sessionId}/messages`,
            {
                method: 'GET',
                headers: this.getHeaders(),
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to get session history: ${response.status}`);
        }

        return response.json() as Promise<MorseProtocol.ChatMessage[]>;
    }

    private getHeaders(): Record<string, string> {
        const headers: Record<string, string> = {};
        if (this.config.apiKey) {
            headers['Authorization'] = `Bearer ${this.config.apiKey}`;
        }
        return headers;
    }

    // Backward compatibility methods
    public async getSession(): Promise<any> {
        const response = await fetch(`${this.config.endpoint}/api/v1/session`, {
            method: 'GET',
            headers: this.getHeaders(),
        });
        if (!response.ok) return null;
        return response.json();
    }

    public async getUsageStats(): Promise<any> {
        const response = await fetch(`${this.config.endpoint}/api/v1/usage/stats`, {
            method: 'GET',
            headers: this.getHeaders(),
        });
        if (!response.ok) return { daily: [] };
        return response.json();
    }

    public async fix(params: Record<string, any>): Promise<any> {
        return this.sendCommand('fix', params);
    }

    public async edit(params: Record<string, any>): Promise<any> {
        return this.sendCommand('edit', params);
    }

    public async explain(params: Record<string, any>): Promise<any> {
        return this.sendCommand('explain', params);
    }

    public async generateTests(params: Record<string, any>): Promise<any> {
        return this.sendCommand('test', params);
    }

    public async generateCommit(params: { diff: string; conventional?: boolean }): Promise<MorseProtocol.GenerateCommitResponse> {
        const response = await this.sendCommand('commit', params);
        return {
            message: response.data?.message || 'Update code',
            description: response.data?.description,
        };
    }

    public isReady(): boolean {
        return true;
    }

    public async start(): Promise<void> {
        // Connection is established on demand
    }

    public stop(): void {
        // No persistent connection to stop
    }

    public dispose(): void {
        this.outputChannel.dispose();
    }

    public log(message: string): void {
        this.outputChannel.appendLine(`[${new Date().toISOString()}] ${message}`);
    }
}
