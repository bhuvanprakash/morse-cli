"use strict";
/**
 * Browser Panel
 * Embedded browser preview panel for VS Code
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
exports.BrowserPanel = void 0;
exports.createBrowserPanel = createBrowserPanel;
const vscode = __importStar(require("vscode"));
/**
 * Browser Panel for displaying and interacting with browser content
 */
class BrowserPanel {
    static viewType = 'morse.browser';
    static currentPanel;
    panel;
    extensionUri;
    browserService;
    disposables = [];
    state;
    constructor(extensionUri, browserService) {
        this.extensionUri = extensionUri;
        this.browserService = browserService;
        this.state = {
            isVisible: false,
            sessionId: null,
            isRecording: false,
            isInspecting: false,
            consoleOutput: [],
            networkRequests: [],
        };
        // Create the webview panel
        this.panel = vscode.window.createWebviewPanel(BrowserPanel.viewType, 'Browser Preview', vscode.ViewColumn.Two, {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [extensionUri],
        });
        this.panel.iconPath = vscode.Uri.joinPath(extensionUri, 'media', 'browser.svg');
        this.initializePanel();
    }
    /**
     * Initialize the panel with content
     */
    initializePanel() {
        // Set initial HTML content
        this.panel.webview.html = this.getHtmlContent();
        // Handle messages from the webview
        this.panel.webview.onDidReceiveMessage((message) => this.handleWebviewMessage(message), null, this.disposables);
        // Handle panel disposal
        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
        // Set up browser service events
        this.browserService.setEvents({
            onSessionStart: (session) => {
                this.state.sessionId = session.id;
                this.updatePanel();
            },
            onSessionEnd: () => {
                this.state.sessionId = null;
                this.updatePanel();
            },
            onConsoleMessage: (msg) => {
                this.state.consoleOutput.push(msg);
                this.updateConsole();
            },
            onNetworkRequest: (req) => {
                this.state.networkRequests.push(req);
                this.updateNetwork();
            },
            onScreenshot: (screenshot) => {
                this.updateScreenshot(screenshot);
            },
            onError: (error) => {
                this.showError(error);
            },
        });
    }
    /**
     * Handle messages from the webview
     */
    async handleWebviewMessage(message) {
        switch (message.command) {
            case 'navigate':
                await this.navigate(message.payload);
                break;
            case 'click':
                await this.clickElement(message.payload);
                break;
            case 'fill':
                const fillPayload = message.payload;
                await this.fillElement(fillPayload.targetId, fillPayload.text);
                break;
            case 'read':
                await this.readPage();
                break;
            case 'screenshot':
                await this.takeScreenshot();
                break;
            case 'close':
                await this.closeBrowser();
                break;
            case 'toggleRecording':
                this.toggleRecording();
                break;
            case 'toggleInspector':
                this.toggleInspector();
                break;
            case 'clearConsole':
                this.clearConsole();
                break;
            case 'refresh':
                await this.refreshPanel();
                break;
        }
    }
    /**
     * Navigate to a URL
     */
    async navigate(url) {
        try {
            const result = await this.browserService.navigate(url);
            if (result.success && result.snapshot) {
                this.updatePageSnapshot(result.snapshot);
            }
            else if (result.error) {
                this.showError(result.error);
            }
        }
        catch (error) {
            this.showError(error instanceof Error ? error.message : String(error));
        }
    }
    /**
     * Click an element by ID
     */
    async clickElement(targetId) {
        try {
            const result = await this.browserService.click(targetId);
            if (result.success && result.snapshot) {
                this.updatePageSnapshot(result.snapshot);
            }
            else if (result.error) {
                this.showError(result.error);
            }
        }
        catch (error) {
            this.showError(error instanceof Error ? error.message : String(error));
        }
    }
    /**
     * Fill an input element
     */
    async fillElement(targetId, text) {
        try {
            const result = await this.browserService.fill(targetId, text);
            if (result.success && result.snapshot) {
                this.updatePageSnapshot(result.snapshot);
            }
            else if (result.error) {
                this.showError(result.error);
            }
        }
        catch (error) {
            this.showError(error instanceof Error ? error.message : String(error));
        }
    }
    /**
     * Read current page state
     */
    async readPage() {
        try {
            const result = await this.browserService.read();
            if (result.success && result.snapshot) {
                this.updatePageSnapshot(result.snapshot);
            }
            else if (result.error) {
                this.showError(result.error);
            }
        }
        catch (error) {
            this.showError(error instanceof Error ? error.message : String(error));
        }
    }
    /**
     * Take a screenshot
     */
    async takeScreenshot() {
        try {
            const screenshot = await this.browserService.screenshot();
            if (screenshot) {
                this.updateScreenshot(screenshot);
            }
        }
        catch (error) {
            this.showError(error instanceof Error ? error.message : String(error));
        }
    }
    /**
     * Close the browser
     */
    async closeBrowser() {
        try {
            await this.browserService.close();
        }
        catch (error) {
            this.showError(error instanceof Error ? error.message : String(error));
        }
    }
    /**
     * Toggle recording mode
     */
    toggleRecording() {
        this.state.isRecording = !this.state.isRecording;
        this.updatePanel();
    }
    /**
     * Toggle inspector mode
     */
    toggleInspector() {
        this.state.isInspecting = !this.state.isInspecting;
        this.panel.webview.postMessage({
            command: 'setInspectorMode',
            payload: this.state.isInspecting,
        });
    }
    /**
     * Clear console output
     */
    clearConsole() {
        this.state.consoleOutput = [];
        this.updateConsole();
    }
    /**
     * Refresh the panel
     */
    async refreshPanel() {
        await this.readPage();
    }
    /**
     * Update page snapshot in the webview
     */
    updatePageSnapshot(snapshot) {
        this.panel.webview.postMessage({
            command: 'updateSnapshot',
            payload: snapshot,
        });
    }
    /**
     * Update screenshot in the webview
     */
    updateScreenshot(screenshot) {
        this.panel.webview.postMessage({
            command: 'updateScreenshot',
            payload: screenshot,
        });
    }
    /**
     * Update console output
     */
    updateConsole() {
        this.panel.webview.postMessage({
            command: 'updateConsole',
            payload: this.state.consoleOutput,
        });
    }
    /**
     * Update network requests
     */
    updateNetwork() {
        this.panel.webview.postMessage({
            command: 'updateNetwork',
            payload: this.state.networkRequests,
        });
    }
    /**
     * Update the entire panel
     */
    updatePanel() {
        this.panel.webview.postMessage({
            command: 'updateState',
            payload: this.state,
        });
    }
    /**
     * Show an error message
     */
    showError(message) {
        vscode.window.showErrorMessage(`Browser Error: ${message}`);
        this.panel.webview.postMessage({
            command: 'showError',
            payload: message,
        });
    }
    /**
     * Get HTML content for the panel
     */
    getHtmlContent() {
        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Browser Preview</title>
    <style>
        * {
            box-sizing: border-box;
        }
        body {
            margin: 0;
            padding: 0;
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
        }
        .container {
            display: flex;
            flex-direction: column;
            height: 100vh;
        }
        .toolbar {
            display: flex;
            gap: 8px;
            padding: 8px;
            background-color: var(--vscode-editor-background);
            border-bottom: 1px solid var(--vscode-editor-border);
        }
        .url-input {
            flex: 1;
            padding: 6px 12px;
            border: 1px solid var(--vscode-editor-border);
            border-radius: 4px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
        }
        .url-input:focus {
            outline: none;
            border-color: var(--vscode-focusBorder);
        }
        .btn {
            padding: 6px 12px;
            border: none;
            border-radius: 4px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            cursor: pointer;
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
        }
        .btn:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .btn.active {
            background-color: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
        }
        .content {
            display: flex;
            flex: 1;
            overflow: hidden;
        }
        .preview {
            flex: 2;
            border-right: 1px solid var(--vscode-editor-border);
            display: flex;
            flex-direction: column;
        }
        .preview-header {
            padding: 8px;
            background-color: var(--vscode-editor-background);
            border-bottom: 1px solid var(--vscode-editor-border);
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }
        .preview-content {
            flex: 1;
            overflow: auto;
            padding: 8px;
        }
        .screenshot {
            max-width: 100%;
            height: auto;
        }
        .elements {
            flex: 1;
            border-left: 1px solid var(--vscode-editor-border);
            overflow: auto;
            background-color: var(--vscode-editor-background);
        }
        .elements-header {
            padding: 8px;
            font-weight: bold;
            border-bottom: 1px solid var(--vscode-editor-border);
        }
        .element-item {
            padding: 8px;
            cursor: pointer;
            border-bottom: 1px solid var(--vscode-editor-border);
        }
        .element-item:hover {
            background-color: var(--vscode-list-hoverBackground);
        }
        .element-id {
            color: var(--vscode-charts-blue);
            font-weight: bold;
            margin-right: 8px;
        }
        .element-tag {
            color: var(--vscode-charts-purple);
            margin-right: 4px;
        }
        .element-label {
            color: var(--vscode-descriptionForeground);
        }
        .sidebar {
            width: 300px;
            display: flex;
            flex-direction: column;
        }
        .console, .network {
            flex: 1;
            overflow: auto;
            border-top: 1px solid var(--vscode-editor-border);
        }
        .console-header, .network-header {
            padding: 8px;
            font-weight: bold;
            background-color: var(--vscode-editor-background);
            border-bottom: 1px solid var(--vscode-editor-border);
        }
        .console-content, .network-content {
            padding: 8px;
            font-family: monospace;
            font-size: 12px;
        }
        .log-entry {
            padding: 4px 0;
            border-bottom: 1px solid var(--vscode-editor-border);
        }
        .log-warn {
            color: var(--vscode-charts-yellow);
        }
        .log-error {
            color: var(--vscode-charts-red);
        }
        .log-info {
            color: var(--vscode-charts-blue);
        }
        .network-entry {
            padding: 4px 0;
            border-bottom: 1px solid var(--vscode-editor-border);
            font-size: 11px;
        }
        .status-2xx {
            color: var(--vscode-charts-green);
        }
        .status-4xx, .status-5xx {
            color: var(--vscode-charts-red);
        }
        .no-session {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100%;
            color: var(--vscode-descriptionForeground);
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="toolbar">
            <input type="text" class="url-input" id="urlInput" placeholder="Enter URL to navigate..." />
            <button class="btn" id="goBtn">Go</button>
            <button class="btn" id="refreshBtn">Refresh</button>
            <button class="btn" id="screenshotBtn">Screenshot</button>
            <button class="btn" id="recordBtn">Record</button>
            <button class="btn" id="inspectBtn">Inspect</button>
            <button class="btn" id="closeBtn">Close</button>
        </div>
        <div class="content">
            <div class="preview">
                <div class="preview-header" id="previewHeader">No active session</div>
                <div class="preview-content" id="previewContent">
                    <div class="no-session">Start browsing to see preview</div>
                </div>
            </div>
            <div class="elements">
                <div class="elements-header">Interactive Elements</div>
                <div id="elementsList"></div>
            </div>
            <div class="sidebar">
                <div class="console">
                    <div class="console-header">
                        Console
                        <button class="btn" id="clearConsoleBtn" style="float: right; padding: 2px 8px; font-size: 11px;">Clear</button>
                    </div>
                    <div class="console-content" id="consoleContent"></div>
                </div>
                <div class="network">
                    <div class="network-header">Network</div>
                    <div class="network-content" id="networkContent"></div>
                </div>
            </div>
        </div>
    </div>
    <script>
        const vscode = acquireVsCodeApi();

        // UI Elements
        const urlInput = document.getElementById('urlInput');
        const goBtn = document.getElementById('goBtn');
        const refreshBtn = document.getElementById('refreshBtn');
        const screenshotBtn = document.getElementById('screenshotBtn');
        const recordBtn = document.getElementById('recordBtn');
        const inspectBtn = document.getElementById('inspectBtn');
        const closeBtn = document.getElementById('closeBtn');
        const clearConsoleBtn = document.getElementById('clearConsoleBtn');
        const previewHeader = document.getElementById('previewHeader');
        const previewContent = document.getElementById('previewContent');
        const elementsList = document.getElementById('elementsList');
        const consoleContent = document.getElementById('consoleContent');
        const networkContent = document.getElementById('networkContent');

        // Event Listeners
        goBtn.addEventListener('click', () => {
            const url = urlInput.value.trim();
            if (url) {
                vscode.postMessage({ command: 'navigate', payload: url });
            }
        });

        urlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const url = urlInput.value.trim();
                if (url) {
                    vscode.postMessage({ command: 'navigate', payload: url });
                }
            }
        });

        refreshBtn.addEventListener('click', () => {
            vscode.postMessage({ command: 'read' });
        });

        screenshotBtn.addEventListener('click', () => {
            vscode.postMessage({ command: 'screenshot' });
        });

        recordBtn.addEventListener('click', () => {
            vscode.postMessage({ command: 'toggleRecording' });
        });

        inspectBtn.addEventListener('click', () => {
            vscode.postMessage({ command: 'toggleInspector' });
        });

        closeBtn.addEventListener('click', () => {
            vscode.postMessage({ command: 'close' });
        });

        clearConsoleBtn.addEventListener('click', () => {
            vscode.postMessage({ command: 'clearConsole' });
        });

        // Handle messages from extension
        window.addEventListener('message', (event) => {
            const message = event.data;

            switch (message.command) {
                case 'updateSnapshot':
                    updateSnapshot(message.payload);
                    break;
                case 'updateScreenshot':
                    updateScreenshot(message.payload);
                    break;
                case 'updateConsole':
                    updateConsole(message.payload);
                    break;
                case 'updateNetwork':
                    updateNetwork(message.payload);
                    break;
                case 'updateState':
                    updateState(message.payload);
                    break;
                case 'setInspectorMode':
                    setInspectorMode(message.payload);
                    break;
                case 'showError':
                    showError(message.payload);
                    break;
            }
        });

        function updateSnapshot(snapshot) {
            urlInput.value = snapshot.url;
            previewHeader.textContent = snapshot.title + ' - ' + snapshot.url;

            // Clear and rebuild elements list
            elementsList.innerHTML = '';

            snapshot.elements.forEach(element => {
                const item = document.createElement('div');
                item.className = 'element-item';
                item.innerHTML = '<span class="element-id">[' + element.id + ']</span>' +
                    '<span class="element-tag">' + element.tagName + '</span>' +
                    '<span class="element-label">' + element.label + '</span>';

                item.addEventListener('click', () => {
                    if (element.type === 'input' || element.type === 'textarea') {
                        const text = prompt('Enter text to fill:');
                        if (text) {
                            vscode.postMessage({
                                command: 'fill',
                                payload: { targetId: element.id, text }
                            });
                        }
                    } else {
                        vscode.postMessage({ command: 'click', payload: element.id });
                    }
                });

                elementsList.appendChild(item);
            });

            if (snapshot.elements.length === 0) {
                elementsList.innerHTML = '<div style="padding: 8px; color: var(--vscode-descriptionForeground);">No interactive elements found</div>';
            }
        }

        function updateScreenshot(screenshot) {
            if (screenshot) {
                previewContent.innerHTML = '<img class="screenshot" src="data:image/png;base64,' + screenshot + '" />';
            }
        }

        function updateConsole(messages) {
            consoleContent.innerHTML = '';
            messages.forEach(msg => {
                const entry = document.createElement('div');
                entry.className = 'log-entry log-' + msg.type;
                entry.textContent = '[' + msg.type + '] ' + msg.text;
                consoleContent.appendChild(entry);
            });

            if (messages.length === 0) {
                consoleContent.innerHTML = '<div style="color: var(--vscode-descriptionForeground);">No console output</div>';
            }
        }

        function updateNetwork(requests) {
            networkContent.innerHTML = '';
            requests.forEach(req => {
                const entry = document.createElement('div');
                entry.className = 'network-entry';

                const statusClass = req.status >= 200 && req.status < 300 ? 'status-2xx' :
                    req.status >= 400 ? 'status-4xx' : '';
                const statusText = req.status ? req.status : 'pending';

                entry.innerHTML = '<span class="' + statusClass + '">' + req.method + '</span> ' +
                    req.url.substring(0, 50) + '... <span class="' + statusClass + '">' + statusText + '</span>';

                networkContent.appendChild(entry);
            });

            if (requests.length === 0) {
                networkContent.innerHTML = '<div style="color: var(--vscode-descriptionForeground);">No network requests</div>';
            }
        }

        function updateState(state) {
            if (state.isRecording) {
                recordBtn.classList.add('active');
            } else {
                recordBtn.classList.remove('active');
            }

            if (state.isInspecting) {
                inspectBtn.classList.add('active');
            } else {
                inspectBtn.classList.remove('active');
            }
        }

        function setInspectorMode(enabled) {
            // Inspector mode can be used to highlight elements on hover
            console.log('Inspector mode:', enabled);
        }

        function showError(message) {
            console.error(message);
        }
    </script>
</body>
</html>`;
    }
    /**
     * Show the panel
     */
    show() {
        this.panel.reveal();
    }
    /**
     * Dispose of the panel
     */
    dispose() {
        BrowserPanel.currentPanel = undefined;
        this.disposables.forEach((d) => d.dispose());
        this.disposables = [];
    }
}
exports.BrowserPanel = BrowserPanel;
/**
 * Create or show the browser panel
 */
function createBrowserPanel(extensionUri, browserService) {
    if (BrowserPanel.currentPanel) {
        BrowserPanel.currentPanel.show();
        return BrowserPanel.currentPanel;
    }
    const panel = new BrowserPanel(extensionUri, browserService);
    BrowserPanel.currentPanel = panel;
    return panel;
}
//# sourceMappingURL=panel.js.map