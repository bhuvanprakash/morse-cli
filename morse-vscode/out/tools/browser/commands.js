"use strict";
/**
 * Browser Commands
 * VS Code commands for browser operations
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
exports.BrowserCommands = void 0;
exports.createBrowserCommands = createBrowserCommands;
exports.registerBrowserCommands = registerBrowserCommands;
const vscode = __importStar(require("vscode"));
const service_1 = require("./service");
const panel_1 = require("./panel");
/**
 * Browser command handlers
 */
class BrowserCommands {
    context;
    client;
    browserService;
    browserPanel = null;
    browserConfig;
    constructor(context, client, config) {
        this.context = context;
        this.client = client;
        this.browserConfig = {
            headless: true,
            viewportWidth: 1280,
            viewportHeight: 720,
            timeout: 30000,
            javaScriptEnabled: true,
            screenshotsEnabled: true,
            ...config,
        };
        this.browserService = (0, service_1.createBrowserService)(client, this.browserConfig);
    }
    /**
     * Initialize browser commands
     */
    async initialize() {
        await this.browserService.initialize();
    }
    /**
     * Register all browser commands
     */
    register() {
        // Open browser panel
        this.context.subscriptions.push(vscode.commands.registerCommand('morse.browser.open', async () => {
            await this.openBrowserPanel();
        }));
        // Navigate to URL
        this.context.subscriptions.push(vscode.commands.registerCommand('morse.browser.navigate', async (url) => {
            if (url) {
                await this.navigate(url);
            }
            else {
                await this.promptNavigate();
            }
        }));
        // Click element
        this.context.subscriptions.push(vscode.commands.registerCommand('morse.browser.click', async (targetId) => {
            await this.clickElement(targetId);
        }));
        // Fill element
        this.context.subscriptions.push(vscode.commands.registerCommand('morse.browser.fill', async (targetId, text) => {
            await this.fillElement(targetId, text);
        }));
        // Take screenshot
        this.context.subscriptions.push(vscode.commands.registerCommand('morse.browser.screenshot', async () => {
            await this.takeScreenshot();
        }));
        // Read page
        this.context.subscriptions.push(vscode.commands.registerCommand('morse.browser.read', async () => {
            await this.readPage();
        }));
        // Close browser
        this.context.subscriptions.push(vscode.commands.registerCommand('morse.browser.close', async () => {
            await this.closeBrowser();
        }));
        // Quick navigate - prompt for URL
        this.context.subscriptions.push(vscode.commands.registerCommand('morse.browser.goto', async () => {
            await this.promptNavigate();
        }));
        // Extract content
        this.context.subscriptions.push(vscode.commands.registerCommand('morse.browser.extract', async (selector) => {
            await this.extractContent(selector);
        }));
    }
    /**
     * Open browser panel
     */
    async openBrowserPanel() {
        if (!this.browserPanel) {
            this.browserPanel = (0, panel_1.createBrowserPanel)(this.context.extensionUri, this.browserService);
        }
        this.browserPanel.show();
    }
    /**
     * Navigate to URL
     */
    async navigate(url) {
        if (!url) {
            await this.promptNavigate();
            return;
        }
        // Ensure URL has protocol
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
        }
        try {
            const result = await this.browserService.navigate(url);
            if (result.success) {
                if (this.browserPanel) {
                    await this.browserPanel.refreshPanel();
                }
            }
            else if (result.error) {
                vscode.window.showErrorMessage(`Navigation failed: ${result.error}`);
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Navigation error: ${error}`);
        }
    }
    /**
     * Prompt for URL and navigate
     */
    async promptNavigate() {
        const url = await vscode.window.showInputBox({
            prompt: 'Enter URL to navigate to',
            placeHolder: 'https://example.com',
            validateInput: (value) => {
                if (!value || value.trim() === '') {
                    return 'Please enter a URL';
                }
                return null;
            },
        });
        if (url) {
            await this.navigate(url);
        }
    }
    /**
     * Click element by ID
     */
    async clickElement(targetId) {
        try {
            const result = await this.browserService.click(targetId);
            if (!result.success && result.error) {
                vscode.window.showErrorMessage(`Click failed: ${result.error}`);
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Click error: ${error}`);
        }
    }
    /**
     * Fill element with text
     */
    async fillElement(targetId, text) {
        try {
            const result = await this.browserService.fill(targetId, text);
            if (!result.success && result.error) {
                vscode.window.showErrorMessage(`Fill failed: ${result.error}`);
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Fill error: ${error}`);
        }
    }
    /**
     * Take screenshot
     */
    async takeScreenshot() {
        try {
            const screenshot = await this.browserService.screenshot();
            if (screenshot) {
                // Save screenshot to file
                const doc = await vscode.workspace.openTextDocument({
                    content: screenshot,
                });
                await vscode.window.showTextDocument(doc, {
                    viewColumn: vscode.ViewColumn.Beside,
                    preview: false,
                });
            }
            else {
                vscode.window.showInformationMessage('No active browser session');
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Screenshot error: ${error}`);
        }
    }
    /**
     * Read current page
     */
    async readPage() {
        try {
            const result = await this.browserService.read();
            if (result.success) {
                // Show page info in output channel
                const output = vscode.window.createOutputChannel('Browser Page');
                output.appendLine(`URL: ${result.snapshot?.url}`);
                output.appendLine(`Title: ${result.snapshot?.title}`);
                output.appendLine('');
                output.appendLine('Interactive Elements:');
                result.snapshot?.elements.forEach((el) => {
                    output.appendLine(`[${el.id}] ${el.tagName} - ${el.label}`);
                });
                output.show();
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Read error: ${error}`);
        }
    }
    /**
     * Close browser
     */
    async closeBrowser() {
        try {
            await this.browserService.close();
            vscode.window.showInformationMessage('Browser closed');
        }
        catch (error) {
            vscode.window.showErrorMessage(`Close error: ${error}`);
        }
    }
    /**
     * Extract content using selector
     */
    async extractContent(selector) {
        if (!selector) {
            selector = await vscode.window.showInputBox({
                prompt: 'Enter CSS selector to extract',
                placeHolder: 'e.g., .content, #main, article p',
            });
        }
        if (!selector) {
            return;
        }
        try {
            const result = await this.browserService.extract(selector, 'text');
            if (result.success) {
                // Show extracted content
                const doc = await vscode.workspace.openTextDocument({
                    language: 'text',
                    content: result.message,
                });
                await vscode.window.showTextDocument(doc, {
                    viewColumn: vscode.ViewColumn.Beside,
                    preview: false,
                });
            }
            else if (result.error) {
                vscode.window.showErrorMessage(`Extract failed: ${result.error}`);
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Extract error: ${error}`);
        }
    }
    /**
     * Get browser service
     */
    getService() {
        return this.browserService;
    }
    /**
     * Dispose
     */
    dispose() {
        this.browserService.dispose();
        if (this.browserPanel) {
            this.browserPanel.dispose();
        }
    }
}
exports.BrowserCommands = BrowserCommands;
/**
 * Create browser commands instance
 */
function createBrowserCommands(context, client, config) {
    return new BrowserCommands(context, client, config);
}
/**
 * Register browser commands
 */
function registerBrowserCommands(context, client) {
    const commands = createBrowserCommands(context, client);
    commands.register();
    return commands;
}
//# sourceMappingURL=commands.js.map