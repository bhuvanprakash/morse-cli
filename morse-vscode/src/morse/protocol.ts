/**
 * Morse Protocol Types
 */

export namespace MorseProtocol {
    export type CommandType =
        | 'fix'
        | 'edit'
        | 'explain'
        | 'test'
        | 'commit'
        | 'chat';

    export interface CommandRequest {
        command: CommandType;
        params: Record<string, any>;
    }

    export interface CommandResponse {
        success: boolean;
        data?: any;
        error?: string;
    }

    export interface ChatMessage {
        role: 'user' | 'assistant' | 'system';
        content: string;
        timestamp: string;
        attachments?: Array<{
            name: string;
            content: string;
            language?: string;
        }>;
    }

    export interface DiffHunk {
        id: string;
        fileName: string;
        searchContent: string;
        replaceContent: string;
        additions: number;
        deletions: number;
        lines?: Array<{
            type: 'added' | 'removed' | 'context';
            lineNumber: number;
            content: string;
        }>;
    }

    export interface StreamChunk {
        content: string;
        done: boolean;
    }

    export interface Session {
        id: string;
        title: string;
        messages: ChatMessage[];
        createdAt: string;
        updatedAt: string;
    }

    export interface GenerateCommitParams {
        diff: string;
        context?: string;
    }

    export interface GenerateCommitResponse {
        message: string;
        description?: string;
    }
}
