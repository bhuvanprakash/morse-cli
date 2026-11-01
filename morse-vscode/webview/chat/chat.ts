/**
 * Chat webview script
 */

// VS Code API
const vscode = acquireVsCodeApi();

// State
let messages: Array<{ role: string; content: string; timestamp?: string }> = [];
let isTyping = false;
let attachments: Array<{ name: string; content: string }> = [];

// DOM Elements
const messagesContainer = document.getElementById('messages') as HTMLDivElement;
const messageInput = document.getElementById('message-input') as HTMLTextAreaElement;
const sendBtn = document.getElementById('send-btn') as HTMLButtonElement;
const attachBtn = document.getElementById('attach-btn') as HTMLButtonElement;
const clearBtn = document.getElementById('clear-btn') as HTMLButtonElement;
const typingIndicator = document.getElementById('typing-indicator') as HTMLDivElement;
const attachmentsContainer = document.getElementById('attachments') as HTMLDivElement;

// Initialize
function init(): void {
    // Load messages from state
    const state = vscode.getState();
    if (state && state.messages) {
        messages = state.messages;
        renderMessages();
    } else {
        showWelcomeMessage();
    }

    // Event listeners
    sendBtn.addEventListener('click', sendMessage);
    attachBtn.addEventListener('click', attachFile);
    clearBtn.addEventListener('click', clearChat);

    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Auto-resize textarea
    messageInput.addEventListener('input', autoResize);

    // Listen for messages from extension
    window.addEventListener('message', handleExtensionMessage);
}

function showWelcomeMessage(): void {
    messagesContainer.innerHTML = `
        <div class="welcome-message">
            <h2>👋 Welcome to Morse Chat</h2>
            <p>I'm your AI coding assistant. I can help you with:</p>
            <p>• Writing and editing code</p>
            <p>• Explaining complex functions</p>
            <p>• Generating tests</p>
            <p>• Debugging issues</p>
            <br>
            <p>Type a message below to get started!</p>
        </div>
    `;
}

function renderMessages(): void {
    if (messages.length === 0) {
        showWelcomeMessage();
        return;
    }

    messagesContainer.innerHTML = '';

    for (const message of messages) {
        const messageEl = createMessageElement(message);
        messagesContainer.appendChild(messageEl);
    }

    scrollToBottom();
}

function createMessageElement(message: { role: string; content: string; timestamp?: string }): HTMLDivElement {
    const el = document.createElement('div');
    el.className = `message ${message.role}`;
    el.innerHTML = formatMessageContent(message.content);

    if (message.timestamp) {
        const timeEl = document.createElement('div');
        timeEl.className = 'timestamp';
        timeEl.textContent = new Date(message.timestamp).toLocaleTimeString();
        el.appendChild(timeEl);
    }

    return el;
}

function formatMessageContent(content: string): string {
    // Escape HTML characters first to prevent XSS
    let escaped = content
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    // Apply markdown-like formatting

    // Bold: **text**
    escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');

    // Italic: *text*
    escaped = escaped.replace(/\*(.*?)\*/g, '<i>$1</i>');

    // Inline code: `code`
    escaped = escaped.replace(/`(.*?)`/g, '<code>$1</code>');

    // Links: [text](url) - ensure URL is safe by keeping data-url attribute
    escaped = escaped.replace(/\[(.*?)\]\((.*?)\)/g, (match, text, url) => {
        // Additional check: url should not contain quotes or dangerous chars
        const safeUrl = url.replace(/"/g, '&quot;').replace(/'/g, '&#039;');
        return `<a href="#" data-url="${safeUrl}">${text}</a>`;
    });

    // Code blocks: ```lang\ncode\n```
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    escaped = escaped.replace(codeBlockRegex, (match, lang, code) => {
        const language = lang || '';
        // Escape code again (already escaped, but safe)
        const codeEscaped = code
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        return `<pre><code class="language-${language}">${codeEscaped}</code></pre>`;
    });

    // If DOMPurify is available, use it for final sanitization
    if (typeof DOMPurify !== 'undefined') {
        escaped = DOMPurify.sanitize(escaped, {
            ALLOWED_TAGS: ['b', 'i', 'strong', 'em', 'code', 'pre', 'a', 'p', 'br', 'div', 'span'],
            ALLOWED_ATTR: ['href', 'data-url', 'class'],
        });
    }

    return escaped;
}

function sendMessage(): void {
    const text = messageInput.value.trim();
    if (!text && attachments.length === 0) {
        return;
    }

    // Add attachments to message
    let fullMessage = text;
    if (attachments.length > 0) {
        fullMessage += '\n\n' + attachments.map(a => `[Attached: ${a.name}]`).join('\n');
    }

    // Send to extension
    vscode.postMessage({
        command: 'sendMessage',
        text: fullMessage,
    });

    // Clear input
    messageInput.value = '';
    autoResize();
    attachments = [];
    renderAttachments();
}

function attachFile(): void {
    vscode.postMessage({
        command: 'attachFile',
    });
}

function clearChat(): void {
    messages = [];
    vscode.postMessage({
        command: 'clearChat',
    });
    vscode.setState({ messages: [] });
    showWelcomeMessage();
}

function autoResize(): void {
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 200) + 'px';
}

function scrollToBottom(): void {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function setTyping(typing: boolean): void {
    isTyping = typing;
    if (typing) {
        typingIndicator.classList.remove('hidden');
    } else {
        typingIndicator.classList.add('hidden');
    }
    scrollToBottom();
}

function renderAttachments(): void {
    attachmentsContainer.innerHTML = '';

    for (const attachment of attachments) {
        const el = document.createElement('div');
        el.className = 'attachment';
        el.innerHTML = `
            <span>${attachment.name}</span>
            <span class="remove" data-name="${attachment.name}">×</span>
        `;
        attachmentsContainer.appendChild(el);
    }

    // Add remove listeners
    attachmentsContainer.querySelectorAll('.remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const name = (e.target as HTMLElement).getAttribute('data-name');
            attachments = attachments.filter(a => a.name !== name);
            renderAttachments();
        });
    });
}

function handleExtensionMessage(event: MessageEvent): void {
    const message = event.data;

    switch (message.command) {
        case 'loadMessages':
            messages = message.messages || [];
            vscode.setState({ messages });
            renderMessages();
            break;

        case 'setTyping':
            setTyping(message.isTyping);
            break;

        case 'fileAttached':
            attachments.push({
                name: message.fileName,
                content: message.content,
            });
            renderAttachments();
            break;

        case 'connectionStatus':
            const statusEl = document.getElementById('connection-status') as HTMLElement;
            if (statusEl) {
                statusEl.title = message.status === 'online' ? 'Connected' : 'Disconnected';
                const dot = statusEl.querySelector('.status-dot') as HTMLElement;
                if (dot) {
                    dot.style.backgroundColor = message.status === 'online' ? '#4ec9b0' : '#f14c4c';
                }
            }
            break;
    }
}

// Handle link clicks
document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'A' && target.hasAttribute('data-url')) {
        e.preventDefault();
        const url = target.getAttribute('data-url');
        if (url) {
            vscode.postMessage({
                command: 'openLink',
                url: url,
            });
        }
    }
});

// Start
init();
