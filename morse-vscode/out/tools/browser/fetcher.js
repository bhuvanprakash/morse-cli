"use strict";
/**
 * URL Fetcher
 * Fetch web page content and parse HTML
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
exports.UrlFetcher = void 0;
exports.createUrlFetcher = createUrlFetcher;
exports.fetchUrl = fetchUrl;
exports.quickFetchUrl = quickFetchUrl;
const vscode = __importStar(require("vscode"));
/**
 * URL Fetcher for fetching web content
 */
class UrlFetcher {
    client;
    constructor(client) {
        this.client = client;
    }
    /**
     * Fetch a URL and return the content
     */
    async fetch(url, options) {
        const fetchOptions = {
            method: 'GET',
            timeout: 30000,
            parseHtml: true,
            followRedirects: true,
            ...options,
        };
        try {
            // Use morse-cli fetch tool
            const result = await this.streamFetch(url, fetchOptions);
            return result;
        }
        catch (error) {
            throw new Error(`Fetch failed: ${error}`);
        }
    }
    /**
     * Stream fetch results
     */
    async streamFetch(url, options) {
        let output = '';
        let status = 200;
        let statusText = 'OK';
        const headers = {};
        const toolArgs = {
            url,
            method: options.method,
            body: options.body,
            headers: options.headers,
            timeout: options.timeout,
        };
        for await (const chunk of this.client.streamToolExecution('fetch', toolArgs)) {
            if (chunk.output) {
                output += chunk.output;
            }
            if (chunk.error) {
                output += `[Error]: ${chunk.error}\n`;
            }
        }
        // Parse the response - try to extract JSON or use raw text
        let body = output;
        let html;
        if (options.parseHtml) {
            html = this.parseHtml(output);
        }
        // Try to parse status from output
        const statusMatch = output.match(/Status:\s*(\d+)/i);
        if (statusMatch) {
            status = parseInt(statusMatch[1], 10);
        }
        // Extract headers if present
        const headerMatches = output.matchAll(/([A-Za-z-]+):\s*(.+)/g);
        // Note: Using Array.from to handle iterator in ES5
        const headerArray = Array.from(headerMatches);
        for (const match of headerArray) {
            headers[match[1]] = match[2];
        }
        return {
            url,
            status,
            statusText,
            headers,
            body,
            html,
        };
    }
    /**
     * Parse HTML and extract structured data
     */
    parseHtml(htmlContent) {
        // Extract title
        const titleMatch = htmlContent.match(/<title[^>]*>([^<]+)<\/title>/i);
        const title = titleMatch ? titleMatch[1].trim() : '';
        // Extract meta description
        const descMatch = htmlContent.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
        const description = descMatch ? descMatch[1].trim() : undefined;
        // Extract links
        const links = [];
        const linkRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>/gi;
        let linkMatch;
        while ((linkMatch = linkRegex.exec(htmlContent)) !== null) {
            const href = linkMatch[1];
            if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
                links.push(href);
            }
        }
        // Dedupe and limit
        const linkSet = new Set(links);
        const uniqueLinks = [];
        let count = 0;
        linkSet.forEach((link) => {
            if (count < 100) {
                uniqueLinks.push(link);
                count++;
            }
        });
        // Extract images
        const images = [];
        const imgRegex = /<img[^>]*src=["']([^"']+)["'][^>]*>/gi;
        let imgMatch;
        while ((imgMatch = imgRegex.exec(htmlContent)) !== null) {
            const src = imgMatch[1];
            if (src) {
                images.push(src);
            }
        }
        // Dedupe and limit
        const imgSet = new Set(images);
        const uniqueImages = [];
        count = 0;
        imgSet.forEach((img) => {
            if (count < 50) {
                uniqueImages.push(img);
                count++;
            }
        });
        // Extract structured data (JSON-LD)
        const data = {};
        const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
        let jsonMatch;
        while ((jsonMatch = jsonLdRegex.exec(htmlContent)) !== null) {
            try {
                const jsonData = JSON.parse(jsonMatch[1]);
                Object.assign(data, jsonData);
            }
            catch {
                // Invalid JSON, skip
            }
        }
        return {
            title,
            description,
            links: uniqueLinks,
            images: uniqueImages,
            data,
        };
    }
    /**
     * Quick fetch - get page content
     */
    async quickFetch(url) {
        const result = await this.fetch(url);
        return result.body;
    }
    /**
     * Get page metadata
     */
    async getMetadata(url) {
        const result = await this.fetch(url, { parseHtml: true });
        return {
            title: result.html?.title || '',
            description: result.html?.description,
            images: result.html?.images || [],
        };
    }
    /**
     * Extract specific content using CSS selector
     */
    async extract(url, selector) {
        // For now, we'll use a simple regex-based extraction
        // In a full implementation, you'd use a proper HTML parser
        const result = await this.fetch(url);
        // Simple CSS selector emulation
        if (selector.startsWith('.')) {
            // Class selector
            const className = selector.slice(1);
            const regex = new RegExp(`<[^>]*class=["'][^"']*\\b${className}\\b[^"']*["'][^>]*>([\\s\\S]*?)</[^>]*>`, 'gi');
            const matches = [];
            let match;
            while ((match = regex.exec(result.body)) !== null) {
                matches.push(match[1].trim());
            }
            return matches.join('\n---\n');
        }
        else if (selector.startsWith('#')) {
            // ID selector
            const id = selector.slice(1);
            const regex = new RegExp(`<[^>]*id=["']${id}["'][^>]*>([\\s\\S]*?)</[^>]*>`, 'gi');
            const match = regex.exec(result.body);
            return match ? match[1].trim() : '';
        }
        else {
            // Tag selector
            const regex = new RegExp(`<${selector}[^>]*>([\\s\\S]*?)</${selector}>`, 'gi');
            const matches = [];
            let match;
            while ((match = regex.exec(result.body)) !== null) {
                matches.push(match[1].trim());
            }
            return matches.join('\n---\n');
        }
    }
}
exports.UrlFetcher = UrlFetcher;
/**
 * Create URL fetcher instance
 */
function createUrlFetcher(client) {
    return new UrlFetcher(client);
}
/**
 * Fetch URL command
 */
async function fetchUrl(client, url, options) {
    const fetcher = createUrlFetcher(client);
    return fetcher.fetch(url, options);
}
/**
 * Quick fetch command - simple fetch to output panel
 */
async function quickFetchUrl(client, url) {
    const fetcher = createUrlFetcher(client);
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Fetching: ${url}`,
        cancellable: true,
    }, async () => {
        const result = await fetcher.fetch(url);
        // Show result in a new document
        const doc = await vscode.workspace.openTextDocument({
            language: 'html',
            content: result.body,
        });
        await vscode.window.showTextDocument(doc, {
            viewColumn: vscode.ViewColumn.Beside,
            preview: false,
        });
        vscode.window.showInformationMessage(`Fetched ${url} (${result.status})`);
    });
}
//# sourceMappingURL=fetcher.js.map