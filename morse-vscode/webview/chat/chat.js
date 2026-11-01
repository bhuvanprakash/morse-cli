/**
 * Enhanced Chat Webview Script
 * Features: Streaming, Syntax Highlighting, Markdown, Diff View, Hunk Management
 */

// VS Code API
const vscode = acquireVsCodeApi();

// State
let messages = [];
let isTyping = false;
let attachments = [];
let hunks = [];
let streamingMessageId = null;
let messageCounter = 0;

// DOM Elements
const messagesContainer = document.getElementById('messages');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const attachBtn = document.getElementById('attach-btn');
const clearBtn = document.getElementById('clear-btn');
const exportBtn = document.getElementById('export-btn');
const typingIndicator = document.getElementById('typing-indicator');
const attachmentsContainer = document.getElementById('attachments');
const hunksContainer = document.getElementById('hunks-container');
const hunksList = document.getElementById('hunks-list');
const connectionStatus = document.getElementById('connection-status');
const acceptAllBtn = document.getElementById('accept-all-btn');
const rejectAllBtn = document.getElementById('reject-all-btn');

// Initialize
function init() {
    // Load messages from state
    const state = vscode.getState();
    if (state && state.messages && state.messages.length > 0) {
        messages = state.messages;
        renderMessages();
    }

    // Event listeners
    sendBtn.addEventListener('click', sendMessage);
    attachBtn.addEventListener('click', attachFile);
    clearBtn.addEventListener('click', clearChat);
    exportBtn.addEventListener('click', exportChat);
    acceptAllBtn.addEventListener('click', () => handleAllHunks('accept'));
    rejectAllBtn.addEventListener('click', () => handleAllHunks('reject'));

    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
        if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            clearChat();
        }
    });

    messageInput.addEventListener('input', autoResize);

    // Listen for messages from extension
    window.addEventListener('message', handleExtensionMessage);

    // Notify extension that webview is ready
    vscode.postMessage({ command: 'webviewReady' });
}

function autoResize() {
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 150) + 'px';
}

function sendMessage() {
    const text = messageInput.value.trim();
    if (!text && attachments.length === 0) return;

    const messageText = buildMessageText(text);
    const message = {
        id: `msg-${++messageCounter}`,
        role: 'user',
        content: messageText,
        timestamp: new Date().toISOString(),
        attachments: [...attachments],
    };

    messages.push(message);
    renderMessages();
    saveState();

    vscode.postMessage({
        command: 'sendMessage',
        text: messageText,
        messageId: message.id,
    });

    messageInput.value = '';
    messageInput.style.height = 'auto';
    attachments = [];
    renderAttachments();
    setTyping(true);
}

function buildMessageText(text) {
    if (attachments.length === 0) return text;

    let fullText = text;
    attachments.forEach((att) => {
        fullText += `\n\n[Attached: ${att.name}]\n\`\`\`${att.language || ''}\n${att.content}\n\`\`\``;
    });
    return fullText;
}

function attachFile() {
    vscode.postMessage({ command: 'attachFile' });
}

function clearChat() {
    if (messages.length === 0) return;
    if (!confirm('Clear all messages? This cannot be undone.')) return;

    messages = [];
    hunks = [];
    streamingMessageId = null;
    saveState();
    renderMessages();
    renderHunks();
    showWelcomeMessage();
}

function exportChat() {
    const chatData = {
        exportedAt: new Date().toISOString(),
        messages: messages.map((m) => ({
            role: m.role,
            content: m.content,
            timestamp: m.timestamp,
        })),
    };

    const blob = new Blob([JSON.stringify(chatData, null, 2)], {
        type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `morse-chat-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function handleExtensionMessage(event) {
    const message = event.data;

    switch (message.command) {
        case 'receiveMessage':
            handleReceiveMessage(message);
            break;
        case 'streamChunk':
            handleStreamChunk(message);
            break;
        case 'streamEnd':
            handleStreamEnd(message);
            break;
        case 'streamError':
            handleStreamError(message);
            break;
        case 'addAttachment':
            addAttachment(message.file);
            break;
        case 'addHunk':
            addHunk(message.hunk);
            break;
        case 'connectionStatus':
            updateConnectionStatus(message.status);
            break;
        case 'setMessages':
            messages = message.messages;
            renderMessages();
            break;
    }
}

function handleReceiveMessage(message) {
    setTyping(false);

    const newMessage = {
        id: `msg-${++messageCounter}`,
        role: 'assistant',
        content: message.text,
        timestamp: new Date().toISOString(),
    };

    messages.push(newMessage);
    renderMessages();
    saveState();
}

function handleStreamChunk(message) {
    setTyping(false);

    if (!streamingMessageId) {
        streamingMessageId = `msg-${++messageCounter}`;
        const newMessage = {
            id: streamingMessageId,
            role: 'assistant',
            content: message.chunk,
            timestamp: new Date().toISOString(),
            streaming: true,
        };
        messages.push(newMessage);
    } else {
        const msg = messages.find((m) => m.id === streamingMessageId);
        if (msg) {
            msg.content += message.chunk;
        }
    }

    renderMessages(false);
    saveState();
}

function handleStreamEnd(message) {
    if (streamingMessageId) {
        const msg = messages.find((m) => m.id === streamingMessageId);
        if (msg) {
            msg.streaming = false;
        }
        streamingMessageId = null;
        renderMessages();
        saveState();
    }
}

function handleStreamError(message) {
    setTyping(false);
    streamingMessageId = null;

    const errorMessage = {
        id: `msg-${++messageCounter}`,
        role: 'error',
        content: message.error,
        timestamp: new Date().toISOString(),
    };

    messages.push(errorMessage);
    renderMessages();
    saveState();
}

function setTyping(typing) {
    isTyping = typing;
    typingIndicator.classList.toggle('hidden', !typing);
    sendBtn.disabled = typing;
}

function updateConnectionStatus(status) {
    connectionStatus.className = 'status-indicator';
    connectionStatus.classList.add(status);

    const titles = {
        connected: 'Connected to Morse CLI',
        error: 'Connection error - click to retry',
        connecting: 'Connecting to Morse CLI...',
    };
    connectionStatus.title = titles[status] || 'Unknown status';
}

function addAttachment(file) {
    attachments.push(file);
    renderAttachments();
}

function removeAttachment(index) {
    attachments.splice(index, 1);
    renderAttachments();
}

function renderAttachments() {
    attachmentsContainer.innerHTML = '';

    attachments.forEach((att, index) => {
        const el = document.createElement('div');
        el.className = 'attachment';
        el.innerHTML = `
            <span>📎 ${att.name}</span>
            <span class="attachment-remove" data-index="${index}">✕</span>
        `;
        attachmentsContainer.appendChild(el);
    });

    document.querySelectorAll('.attachment-remove').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.dataset.index);
            removeAttachment(index);
        });
    });
}

function addHunk(hunk) {
    hunks.push({ ...hunk, id: `hunk-${Date.now()}` });
    renderHunks();
}

function removeHunk(id) {
    hunks = hunks.filter((h) => h.id !== id);
    renderHunks();
}

function handleHunkAction(id, action) {
    vscode.postMessage({
        command: 'hunkAction',
        hunkId: id,
        action: action,
    });
    removeHunk(id);
}

function handleAllHunks(action) {
    hunks.forEach((hunk) => {
        vscode.postMessage({
            command: 'hunkAction',
            hunkId: hunk.id,
            action: action,
        });
    });
    hunks = [];
    renderHunks();
}

function renderHunks() {
    if (hunks.length === 0) {
        hunksContainer.classList.add('hidden');
        return;
    }

    hunksContainer.classList.remove('hidden');
    hunksList.innerHTML = '';

    hunks.forEach((hunk) => {
        const el = document.createElement('div');
        el.className = 'hunk-item';
        el.innerHTML = `
            <div class="hunk-info">
                <span class="hunk-file">${hunk.fileName}</span>
                <span class="hunk-stats">+${hunk.additions} -${hunk.deletions}</span>
            </div>
            <div class="hunk-actions">
                <button class="btn btn-primary btn-sm" data-id="${hunk.id}" data-action="accept">Accept</button>
                <button class="btn btn-secondary btn-sm" data-id="${hunk.id}" data-action="reject">Reject</button>
            </div>
        `;
        hunksList.appendChild(el);
    });

    document.querySelectorAll('.hunk-actions .btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            const id = e.target.dataset.id;
            const action = e.target.dataset.action;
            handleHunkAction(id, action);
        });
    });
}

function renderMessages(scroll = true) {
    if (messages.length === 0) {
        showWelcomeMessage();
        return;
    }

    messagesContainer.innerHTML = '';

    messages.forEach((message) => {
        const el = createMessageElement(message);
        messagesContainer.appendChild(el);
    });

    // Highlight code blocks
    if (window.Prism) {
        Prism.highlightAllUnder(messagesContainer);
    }

    if (scroll) {
        scrollToBottom();
    }
}

function showWelcomeMessage() {
    messagesContainer.innerHTML = `
        <div class="welcome-message">
            <div class="welcome-icon">⚡</div>
            <h2>Welcome to Morse Chat</h2>
            <p>I'm your AI coding assistant. I can help you with:</p>
            <ul>
                <li>💻 Writing and editing code</li>
                <li>📚 Explaining complex functions</li>
                <li>🧪 Generating tests</li>
                <li>🔍 Debugging issues</li>
                <li>📝 Writing documentation</li>
            </ul>
            <p class="tip">Tip: Select code in the editor and use context menu commands!</p>
        </div>
    `;
}

function createMessageElement(message) {
    const el = document.createElement('div');
    el.className = `message ${message.role}`;
    el.id = message.id;

    const avatar = message.role === 'user' ? '👤' : message.role === 'error' ? '⚠️' : '⚡';
    const author = message.role === 'user' ? 'You' : message.role === 'error' ? 'Error' : 'Morse';

    const time = new Date(message.timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
    });

    el.innerHTML = `
        <div class="message-avatar">${avatar}</div>
        <div class="message-content">
            <div class="message-header">
                <span class="message-author">${author}</span>
                <span class="message-time">${time}</span>
            </div>
            <div class="message-body">
                ${formatMessageContent(message.content)}
                ${message.streaming ? '<span class="streaming-cursor"></span>' : ''}
            </div>
        </div>
    `;

    // Add copy buttons to code blocks
    el.querySelectorAll('.code-block').forEach((block) => {
        const copyBtn = block.querySelector('.copy-btn');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                const code = block.querySelector('code').textContent;
                navigator.clipboard.writeText(code);
                copyBtn.textContent = 'Copied!';
                copyBtn.classList.add('copied');
                setTimeout(() => {
                    copyBtn.textContent = 'Copy';
                    copyBtn.classList.remove('copied');
                }, 2000);
            });
        }
    });

    return el;
}

function formatMessageContent(content) {
    if (!content) return '';

    // Escape HTML
    let html = escapeHtml(content);

    // Code blocks with language
    html = html.replace(
        /```(\w+)?\n([\s\S]*?)```/g,
        (match, lang, code) => {
            const language = lang || 'text';
            const escapedCode = escapeHtml(code.trim());
            return createCodeBlock(language, escapedCode);
        }
    );

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

    // Bold
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Italic
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

    // Links
    html = html.replace(
        /\[([^\]]+)\]\(([^)]+)\)/g,
        '<a href="#" data-url="$2">$1</a>'
    );

    // Diff blocks
    html = html.replace(
        /<<<<<<< SEARCH\n([\s\S]*?)=======\n([\s\S]*?)>>>>>>> REPLACE/g,
        (match, search, replace) => createDiffBlock(search, replace)
    );

    // Line breaks
    html = html.replace(/\n/g, '<br>');

    return html;
}

function createCodeBlock(language, code) {
    return `
        <div class="code-block">
            <div class="code-header">
                <span class="code-language">${language}</span>
                <div class="code-actions">
                    <button class="copy-btn">Copy</button>
                </div>
            </div>
            <pre class="line-numbers"><code class="language-${language}">${code}</code></pre>
        </div>
    `;
}

function createDiffBlock(search, replace) {
    const searchLines = search.trim().split('\n');
    const replaceLines = replace.trim().split('\n');

    let diffHtml = '<div class="diff-block">';
    diffHtml += '<div class="diff-header">';
    diffHtml += '<span class="diff-filename">Suggested Changes</span>';
    diffHtml += '<div class="diff-actions">';
    diffHtml += '<button class="btn btn-primary btn-sm diff-accept">Accept</button>';
    diffHtml += '<button class="btn btn-secondary btn-sm diff-reject">Reject</button>';
    diffHtml += '</div></div><div class="diff-content">';

    searchLines.forEach((line) => {
        if (line.trim()) {
            diffHtml += `<div class="diff-line removed"><span class="diff-line-number">-</span>${escapeHtml(line)}</div>`;
        }
    });

    replaceLines.forEach((line) => {
        if (line.trim()) {
            diffHtml += `<div class="diff-line added"><span class="diff-line-number">+</span>${escapeHtml(line)}</div>`;
        }
    });

    diffHtml += '</div></div>';
    return diffHtml;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function saveState() {
    vscode.setState({ messages });
}

// Initialize on load
document.addEventListener('DOMContentLoaded', init);
