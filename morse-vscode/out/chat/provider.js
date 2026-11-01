"use strict";
/**
 * VS Code Native Chat API Provider
 * Integrates Morse with VS Code's built-in chat interface
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
exports.registerChatParticipant = registerChatParticipant;
const vscode = __importStar(require("vscode"));
/**
 * Handle chat requests from VS Code's native chat interface
 */
async function handleChatRequest(request, context, response, token, client) {
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
        const enableStreaming = config.get('enableStreaming', true);
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
        }
        else {
            // Non-streaming response
            const result = await client.sendMessage(request.prompt, {
                sessionId,
            });
            if (token.isCancellationRequested) {
                return;
            }
            response.markdown(result.content);
        }
    }
    catch (error) {
        console.error('[MorseChatProvider] Error:', error);
        if (error instanceof Error) {
            if (error.message.includes('ECONNREFUSED')) {
                response.markdown('❌ **Connection Error**\n\n' +
                    'Unable to connect to Morse CLI. Please ensure:\n' +
                    '1. Morse CLI is running (`morse server`)\n' +
                    '2. The endpoint is configured correctly\n\n');
            }
            else {
                response.markdown(`❌ **Error**: ${error.message}`);
            }
        }
        else {
            response.markdown('❌ An unexpected error occurred.');
        }
    }
}
/**
 * Convert VS Code chat context to Morse messages
 */
function convertContext(context) {
    const messages = [];
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
            const prompt = turn.prompt;
            if (prompt !== undefined) {
                messages.push({
                    role: 'user',
                    content: prompt,
                });
            }
            else {
                // Handle response turns - try to extract content
                const responseTurn = turn;
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
function registerChatParticipant(context, client) {
    // Create the chat request handler function
    const handler = async (request, context, response, token) => {
        await handleChatRequest(request, context, response, token, client);
    };
    // Register as chat participant with 'morse' ID
    const participant = vscode.chat.createChatParticipant('morse', handler);
    // Set participant icon if available
    try {
        const iconUri = vscode.Uri.joinPath(context.extensionUri, 'icon.png');
        participant.iconPath = iconUri;
    }
    catch {
        // Icon not required
    }
    context.subscriptions.push(participant);
}
//# sourceMappingURL=provider.js.map