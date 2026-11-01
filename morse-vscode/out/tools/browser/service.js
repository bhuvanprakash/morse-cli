"use strict";
/**
 * Browser Service
 * Handles browser automation through morse-cli
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrowserService = void 0;
exports.createBrowserService = createBrowserService;
const types_1 = require("./types");
/**
 * Browser service for managing browser sessions and executing browser actions
 */
class BrowserService {
    client;
    config;
    currentSession = null;
    events = {};
    isInitialized = false;
    constructor(client, config = {}) {
        this.client = client;
        this.config = { ...types_1.DEFAULT_BROWSER_CONFIG, ...config };
    }
    /**
     * Set event handlers
     */
    setEvents(events) {
        this.events = events;
    }
    /**
     * Initialize the browser service
     */
    async initialize() {
        this.isInitialized = true;
    }
    /**
     * Check if browser is available
     */
    isAvailable() {
        return this.isInitialized;
    }
    /**
     * Get current session
     */
    getCurrentSession() {
        return this.currentSession;
    }
    /**
     * Execute a browser action
     */
    async executeAction(args) {
        try {
            // For now, we delegate to morse-cli through streaming tool execution
            const result = await this.streamAction(args);
            if (result.success) {
                const sessionId = this.currentSession?.id || this.generateSessionId();
                this.currentSession = {
                    id: sessionId,
                    url: result.snapshot?.url || '',
                    title: result.snapshot?.title || '',
                    createdAt: this.currentSession?.createdAt || new Date(),
                    lastActivity: new Date(),
                    isActive: true,
                };
            }
            return result;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.events.onError?.(errorMessage);
            return {
                success: false,
                message: '',
                error: errorMessage,
            };
        }
    }
    /**
     * Stream browser action execution
     */
    async streamAction(args) {
        let output = '';
        let snapshot;
        let success = false;
        // Convert action args to morse-cli format
        const toolArgs = this.convertArgs(args);
        for await (const chunk of this.client.streamToolExecution('browser_action', toolArgs)) {
            if (chunk.output) {
                output += chunk.output;
            }
            if (chunk.error) {
                output += `[Error]: ${chunk.error}\n`;
            }
            if (chunk.status === 'completed') {
                success = true;
            }
            if (chunk.status === 'failed') {
                success = false;
            }
        }
        // Parse output to extract snapshot
        snapshot = this.parseSnapshot(output);
        return {
            success,
            message: output,
            snapshot,
        };
    }
    /**
     * Convert action args to morse-cli format
     */
    convertArgs(args) {
        const result = {
            action: args.action,
        };
        if (args.url) {
            result.url = args.url;
        }
        if (args.targetId) {
            result.target_id = args.targetId;
        }
        if (args.text) {
            result.text = args.text;
        }
        return result;
    }
    /**
     * Parse page snapshot from output
     */
    parseSnapshot(output) {
        // Try to parse URL and title from output
        const urlMatch = output.match(/URL:\s*(.+)/);
        const titleMatch = output.match(/Title:\s*(.+)/);
        if (!urlMatch) {
            return undefined;
        }
        const url = urlMatch[1].trim();
        const title = titleMatch ? titleMatch[1].trim() : '';
        // Parse interactive elements
        const elements = [];
        const elementRegex = /\[(\d+)\]\s*(\w+)\s*'([^']+)'/g;
        let match;
        while ((match = elementRegex.exec(output)) !== null) {
            const [, id, tagName, label] = match;
            const type = this.getElementType(tagName);
            elements.push({
                id,
                tagName: tagName.toLowerCase(),
                label,
                selector: `[data-morse-id='${id}']`,
                type,
                isVisible: true,
            });
        }
        return {
            url,
            title,
            elements,
        };
    }
    /**
     * Get element type from tag name
     */
    getElementType(tagName) {
        const tag = tagName.toLowerCase();
        switch (tag) {
            case 'button':
            case 'a':
                return tag === 'a' ? 'link' : 'button';
            case 'input':
            case 'select':
            case 'textarea':
                return tag;
            default:
                return 'other';
        }
    }
    /**
     * Navigate to a URL
     */
    async navigate(url) {
        return this.executeAction({
            action: 'goto',
            url,
        });
    }
    /**
     * Click an element by ID
     */
    async click(targetId) {
        return this.executeAction({
            action: 'click',
            targetId,
        });
    }
    /**
     * Type text into an element
     */
    async fill(targetId, text) {
        return this.executeAction({
            action: 'type',
            targetId,
            text,
        });
    }
    /**
     * Read current page state
     */
    async read() {
        return this.executeAction({
            action: 'read',
        });
    }
    /**
     * Take a screenshot
     */
    async screenshot() {
        if (!this.currentSession) {
            return undefined;
        }
        try {
            const result = await this.executeAction({
                action: 'screenshot',
            });
            return result.snapshot?.screenshot;
        }
        catch {
            return undefined;
        }
    }
    /**
     * Extract content from page using selector
     */
    async extract(selector, mode = 'text') {
        return this.executeAction({
            action: 'extract',
            selector,
            extractMode: mode,
        });
    }
    /**
     * Close the browser session
     */
    async close() {
        // Close the browser session
        const sessionIdToEnd = this.currentSession?.id ?? '';
        const result = await this.executeAction({
            action: 'close',
        });
        if (result.success) {
            this.currentSession = null;
            if (sessionIdToEnd) {
                this.events.onSessionEnd?.(sessionIdToEnd);
            }
        }
        return result;
    }
    /**
     * Generate a unique session ID
     */
    generateSessionId() {
        return `browser-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    /**
     * Dispose the browser service
     */
    dispose() {
        if (this.currentSession) {
            this.close();
        }
        this.events = {};
    }
}
exports.BrowserService = BrowserService;
/**
 * Create a browser service instance
 */
function createBrowserService(client, config) {
    return new BrowserService(client, config);
}
//# sourceMappingURL=service.js.map