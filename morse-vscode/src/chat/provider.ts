/**
 * VS Code Native Chat API Provider
 * Integrates Morse with VS Code's built-in chat interface
 */

import * as vscode from 'vscode';
import { MorseClient } from '../morse/client';

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    name?: string;
}

/**
 * Handle chat requests from VS Code's native chat interface
 */
async function handleChatRequest(
    request: vscode.ChatRequest,
    context: vscode.ChatContext,
    response: vscode.ChatResponseStream,
    token: vscode.CancellationToken,
    client: MorseClient
): Promise<void> {
    // Convert VS Code chat context to Morse format
    const messages = convertContext(context);

    // Add the current user prompt
    messages.push({
        role: 'user',
        content: request.prompt,
    });

    // Get session ID from context or create new
    const sessionId = `vscode-${Date.now()}`;

    try {
        // Check if streaming is enabled
        const config = vscode.workspace.getConfiguration('morse');
        const enableStreaming = config.get<boolean>('enableStreaming', true);

        if (enableStreaming) {
            // Stream the response
            const stream = client.sendMessageStream(request.prompt, {
                sessionId,
            });

            let fullResponse = '';

            for await (const chunk of stream) {
                if (token.isCancellationRequested) {
                    break;
                }

                fullResponse += chunk.content;

                // Stream markdown to the response
                if (chunk.content) {
                    response.markdown(chunk.content);
                }
            }

        } else {
            // Non-streaming response
            const result = await client.sendMessage(request.prompt, {
                sessionId,
            });

            if (token.isCancellationRequested) {
                return;
            }

            response.markdown(result.content);
        }

    } catch (error) {
        console.error('[MorseChatProvider] Error:', error);

        if (error instanceof Error) {
            if (error.message.includes('ECONNREFUSED')) {
                response.markdown(
                    '❌ **Connection Error**\n\n' +
                    'Unable to connect to Morse CLI. Please ensure:\n' +
                    '1. Morse CLI is running (`morse server`)\n' +
                    '2. The endpoint is configured correctly\n\n'
                );
            } else {
                response.markdown(`❌ **Error**: ${error.message}`);
            }
        } else {
            response.markdown('❌ An unexpected error occurred.');
        }
    }
}

/**
 * Convert VS Code chat context to Morse messages
 */
function convertContext(context: vscode.ChatContext): ChatMessage[] {
    const messages: ChatMessage[] = [];

    // Add system prompt
    messages.push({
        role: 'assistant',
        content: 'You are Morse, an AI coding assistant. Help the user with their coding tasks.',
        name: 'system',
    });

    // Convert history
    if (context.history && context.history.length > 0) {
        for (const turn of context.history) {
            // Handle request turns
            const prompt = (turn as { prompt?: string }).prompt;
            if (prompt !== undefined) {
                messages.push({
                    role: 'user',
                    content: prompt,
                });
            } else {
                // Handle response turns - try to extract content
                const responseTurn = turn as { response?: Array<{ value?: { value?: string } }> };
                if (responseTurn.response && responseTurn.response.length > 0) {
                    let content = '';
                    for (const fragment of responseTurn.response) {
                        if (fragment.value && fragment.value.value) {
                            content += fragment.value.value;
                        }
                    }
                    if (content) {
                        messages.push({
                            role: 'assistant',
                            content,
                        });
                    }
                }
            }
        }
    }

    return messages;
}

/**
 * Register the chat participant
 */
export function registerChatParticipant(
    context: vscode.ExtensionContext,
    client: MorseClient
): void {
    // Create the chat request handler function
    const handler: vscode.ChatRequestHandler = async (
        request: vscode.ChatRequest,
        context: vscode.ChatContext,
        response: vscode.ChatResponseStream,
        token: vscode.CancellationToken
    ): Promise<void> => {
        await handleChatRequest(request, context, response, token, client);
    };

    // Register as chat participant with 'morse' ID
    const participant = vscode.chat.createChatParticipant('morse', handler);

    // Set participant icon if available
    try {
        const iconUri = vscode.Uri.joinPath(context.extensionUri, 'icon.png');
        (participant as { iconPath?: vscode.Uri }).iconPath = iconUri;
    } catch {
        // Icon not required
    }

    context.subscriptions.push(participant);
}
