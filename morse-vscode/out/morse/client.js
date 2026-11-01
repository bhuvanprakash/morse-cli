"use strict";
/**
 * Enhanced Morse Client with Streaming Support
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
exports.MorseClient = void 0;
const vscode = __importStar(require("vscode"));
class MorseClient {
    config = { endpoint: 'http://localhost:8080', apiKey: '' };
    outputChannel;
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
    loadConfig() {
        const config = vscode.workspace.getConfiguration('morse');
        this.config = {
            endpoint: config.get('endpoint', 'http://localhost:8080'),
            apiKey: config.get('apiKey', ''),
        };
    }
    async checkConnection() {
        try {
            const response = await fetch(`${this.config.endpoint}/health`, {
                method: 'GET',
                headers: this.getHeaders(),
            });
            return response.ok;
        }
        catch {
            return false;
        }
    }
    async *sendMessageStream(message, options) {
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
                if (done)
                    break;
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
                        }
                        catch {
                            // Skip invalid JSON
                        }
                    }
                }
            }
        }
        finally {
            reader.releaseLock();
        }
    }
    async sendMessage(message, options) {
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
        return response.json();
    }
    async sendCommand(command, params) {
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
        return response.json();
    }
    async getSessionHistory(sessionId) {
        const response = await fetch(`${this.config.endpoint}/api/v1/sessions/${sessionId}/messages`, {
            method: 'GET',
            headers: this.getHeaders(),
        });
        if (!response.ok) {
            throw new Error(`Failed to get session history: ${response.status}`);
        }
        return response.json();
    }
    getHeaders() {
        const headers = {};
        if (this.config.apiKey) {
            headers['Authorization'] = `Bearer ${this.config.apiKey}`;
        }
        return headers;
    }
    // Backward compatibility methods
    async getSession() {
        const response = await fetch(`${this.config.endpoint}/api/v1/session`, {
            method: 'GET',
            headers: this.getHeaders(),
        });
        if (!response.ok)
            return null;
        return response.json();
    }
    async getUsageStats() {
        const response = await fetch(`${this.config.endpoint}/api/v1/usage/stats`, {
            method: 'GET',
            headers: this.getHeaders(),
        });
        if (!response.ok)
            return { daily: [] };
        return response.json();
    }
    async fix(params) {
        return this.sendCommand('fix', params);
    }
    async edit(params) {
        return this.sendCommand('edit', params);
    }
    async explain(params) {
        return this.sendCommand('explain', params);
    }
    async generateTests(params) {
        return this.sendCommand('test', params);
    }
    async generateCommit(params) {
        const response = await this.sendCommand('commit', params);
        return {
            message: response.data?.message || 'Update code',
            description: response.data?.description,
        };
    }
    isReady() {
        return true;
    }
    async start() {
        // Connection is established on demand
    }
    stop() {
        // No persistent connection to stop
    }
    log(message) {
        this.outputChannel.appendLine(`[${new Date().toISOString()}] ${message}`);
    }
}
exports.MorseClient = MorseClient;
//# sourceMappingURL=client.js.map