"use strict";
/**
 * Morse Keybindings
 * Custom keybinding configuration and management
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
exports.MorseKeybindingsManager = exports.DEFAULT_KEYBINDINGS = void 0;
exports.registerKeybindingFeatures = registerKeybindingFeatures;
const vscode = __importStar(require("vscode"));
// Default Morse keybindings
exports.DEFAULT_KEYBINDINGS = [
    {
        command: 'morse.chat',
        key: 'ctrl+shift+m',
        when: 'editorTextFocus',
        description: 'Open Morse chat panel',
    },
    {
        command: 'morse.fix',
        key: 'ctrl+shift+f',
        when: 'editorTextFocus',
        description: 'Fix code issues in selection',
    },
    {
        command: 'morse.edit',
        key: 'ctrl+shift+e',
        when: 'editorTextFocus',
        description: 'Edit code with AI assistance',
    },
    {
        command: 'morse.explain',
        key: 'ctrl+shift+x',
        when: 'editorTextFocus',
        description: 'Explain selected code',
    },
    {
        command: 'morse.test',
        key: 'ctrl+shift+t',
        when: 'editorTextFocus',
        description: 'Generate tests for selected code',
    },
    {
        command: 'morse.commit',
        key: 'ctrl+shift+g',
        when: 'scmViewletFocus',
        description: 'Generate git commit message',
    },
    {
        command: 'morse.selectModel',
        key: 'ctrl+shift+,',
        when: 'editorTextFocus',
        description: 'Select AI model',
    },
    {
        command: 'morse.terminal.startREPL',
        key: 'ctrl+shift+r',
        when: 'editorTextFocus',
        description: 'Start Morse REPL terminal',
    },
];
class MorseKeybindingsManager {
    context;
    client;
    customKeybindings = [];
    constructor(context, client) {
        this.context = context;
        this.client = client;
        this.loadCustomKeybindings();
    }
    loadCustomKeybindings() {
        const stored = this.context.globalState.get('morse.customKeybindings');
        if (stored) {
            this.customKeybindings = stored;
        }
    }
    async saveCustomKeybindings() {
        await this.context.globalState.update('morse.customKeybindings', this.customKeybindings);
    }
    async registerDefaultKeybindings() {
        for (const kb of exports.DEFAULT_KEYBINDINGS) {
            // Check if keybinding already exists
            const existing = await this.getKeybinding(kb.key);
            if (!existing) {
                await this.registerKeybinding(kb);
            }
        }
    }
    async registerKeybinding(keybinding) {
        const disposable = vscode.commands.registerCommand(keybinding.command, async () => {
            // Execute the command
            await vscode.commands.executeCommand(keybinding.command);
        });
        this.context.subscriptions.push(disposable);
    }
    async getKeybinding(key) {
        const allKeybindings = [...exports.DEFAULT_KEYBINDINGS, ...this.customKeybindings];
        return allKeybindings.find(kb => kb.key === key);
    }
    async addCustomKeybinding(keybinding) {
        // Check for conflicts
        const existing = await this.getKeybinding(keybinding.key);
        if (existing) {
            vscode.window.showWarningMessage(`Keybinding ${keybinding.key} is already used for ${existing.command}`);
            return;
        }
        this.customKeybindings.push(keybinding);
        await this.saveCustomKeybindings();
        await this.registerKeybinding(keybinding);
        vscode.window.showInformationMessage(`Keybinding ${keybinding.key} registered for ${keybinding.command}`);
    }
    async removeCustomKeybinding(key) {
        const index = this.customKeybindings.findIndex(kb => kb.key === key);
        if (index !== -1) {
            this.customKeybindings.splice(index, 1);
            await this.saveCustomKeybindings();
        }
    }
    getAllKeybindings() {
        return [...exports.DEFAULT_KEYBINDINGS, ...this.customKeybindings];
    }
    getCustomKeybindings() {
        return [...this.customKeybindings];
    }
    async showKeybindingsUI() {
        const panel = vscode.window.createWebviewPanel('morseKeybindings', 'Morse Keybindings', vscode.ViewColumn.One, {
            enableScripts: true,
            retainContextWhenHidden: true,
        });
        const html = this.generateKeybindingsHTML();
        panel.webview.html = html;
        panel.webview.onDidReceiveMessage(async (message) => {
            if (message.command === 'addKeybinding') {
                const data = message.data;
                await this.addCustomKeybinding(data);
                panel.webview.html = this.generateKeybindingsHTML();
            }
            else if (message.command === 'removeKeybinding') {
                const data = message.data;
                await this.removeCustomKeybinding(data.key);
                panel.webview.html = this.generateKeybindingsHTML();
            }
            else if (message.command === 'resetKeybindings') {
                this.customKeybindings = [];
                await this.saveCustomKeybindings();
                panel.webview.html = this.generateKeybindingsHTML();
            }
        });
    }
    generateKeybindingsHTML() {
        const allKeybindings = this.getAllKeybindings();
        const defaultKeybindings = exports.DEFAULT_KEYBINDINGS;
        const customKeybindings = this.getCustomKeybindings();
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Morse Keybindings</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            padding: 20px;
            background: #1e1e1e;
            color: #cccccc;
        }
        h1 {
            color: #569cd6;
        }
        h2 {
            color: #4ec9b0;
            margin-top: 30px;
        }
        .keybinding-list {
            list-style: none;
            padding: 0;
        }
        .keybinding-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px;
            border-bottom: 1px solid #3c3c3c;
        }
        .keybinding-item:hover {
            background: #2d2d2d;
        }
        .key {
            background: #3c3c3c;
            padding: 4px 8px;
            border-radius: 4px;
            font-family: monospace;
            color: #ce9178;
        }
        .command {
            color: #9cdcfe;
        }
        .description {
            color: #888;
            font-size: 12px;
        }
        .badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 10px;
            font-size: 10px;
            margin-left: 8px;
        }
        .badge-default {
            background: #007acc;
            color: white;
        }
        .badge-custom {
            background: #4ec9b0;
            color: #1e1e1e;
        }
        .button-container {
            margin-top: 20px;
        }
        button {
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            margin-right: 10px;
        }
        .primary-button {
            background: #007acc;
            color: white;
        }
        .danger-button {
            background: #f44336;
            color: white;
        }
        .add-form {
            background: #252526;
            padding: 20px;
            border-radius: 8px;
            margin-top: 20px;
        }
        .form-group {
            margin-bottom: 15px;
        }
        .form-group label {
            display: block;
            margin-bottom: 5px;
            color: #888;
        }
        .form-group input {
            width: 100%;
            padding: 8px;
            background: #3c3c3c;
            border: 1px solid #555;
            border-radius: 4px;
            color: #ccc;
        }
        .remove-btn {
            background: #f44336;
            color: white;
            padding: 4px 8px;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <h1>⌨️ Morse Keybindings</h1>
    
    <h2>Default Keybindings</h2>
    <ul class="keybinding-list">
        ${defaultKeybindings.map(kb => `
        <li class="keybinding-item">
            <div>
                <span class="command">${kb.command}</span>
                <span class="description"> - ${kb.description}</span>
            </div>
            <span class="key">${kb.key}</span>
        </li>
        `).join('')}
    </ul>

    <h2>Custom Keybindings <span class="badge badge-custom">Custom</span></h2>
    <ul class="keybinding-list">
        ${customKeybindings.length === 0 ? '<li class="keybinding-item">No custom keybindings</li>' : ''}
        ${customKeybindings.map(kb => `
        <li class="keybinding-item">
            <div>
                <span class="command">${kb.command}</span>
                <span class="description"> - ${kb.description}</span>
            </div>
            <div>
                <span class="key">${kb.key}</span>
                <button class="remove-btn" onclick="removeKeybinding('${kb.key}')">Remove</button>
            </div>
        </li>
        `).join('')}
    </ul>

    <div class="button-container">
        <button class="primary-button" onclick="showAddForm()">Add Custom Keybinding</button>
        <button class="danger-button" onclick="resetKeybindings()">Reset All</button>
    </div>

    <div class="add-form" id="addForm" style="display: none;">
        <h3>Add Custom Keybinding</h3>
        <div class="form-group">
            <label>Command</label>
            <input type="text" id="commandInput" placeholder="e.g., morse.chat">
        </div>
        <div class="form-group">
            <label>Keybinding</label>
            <input type="text" id="keyInput" placeholder="e.g., ctrl+shift+k">
        </div>
        <div class="form-group">
            <label>Description</label>
            <input type="text" id="descInput" placeholder="Description">
        </div>
        <button class="primary-button" onclick="addKeybinding()">Add</button>
        <button class="danger-button" onclick="hideAddForm()">Cancel</button>
    </div>

    <script>
        function showAddForm() {
            document.getElementById('addForm').style.display = 'block';
        }

        function hideAddForm() {
            document.getElementById('addForm').style.display = 'none';
        }

        function addKeybinding() {
            const command = document.getElementById('commandInput').value;
            const key = document.getElementById('keyInput').value;
            const description = document.getElementById('descInput').value;

            if (!command || !key || !description) {
                alert('Please fill in all fields');
                return;
            }

            vscode.postMessage({
                command: 'addKeybinding',
                data: { command, key, description }
            });
        }

        function removeKeybinding(key) {
            vscode.postMessage({
                command: 'removeKeybinding',
                data: { key }
            });
        }

        function resetKeybindings() {
            if (confirm('Are you sure you want to reset all custom keybindings?')) {
                vscode.postMessage({ command: 'resetKeybindings' });
            }
        }
    </script>
</body>
</html>`;
    }
}
exports.MorseKeybindingsManager = MorseKeybindingsManager;
function registerKeybindingFeatures(context, client) {
    const keybindingsManager = new MorseKeybindingsManager(context, client);
    // Register default keybindings
    keybindingsManager.registerDefaultKeybindings();
    // Register commands
    context.subscriptions.push(vscode.commands.registerCommand('morse.keybindings.show', () => {
        keybindingsManager.showKeybindingsUI();
    }));
    context.subscriptions.push(vscode.commands.registerCommand('morse.keybindings.reset', async () => {
        // Reset all custom keybindings
        await context.globalState.update('morse.customKeybindings', []);
        vscode.window.showInformationMessage('Custom keybindings have been reset');
    }));
}
//# sourceMappingURL=MorseKeybindings.js.map