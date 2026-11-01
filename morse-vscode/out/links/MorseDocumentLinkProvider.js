"use strict";
/**
 * Document Link Provider for Morse documentation links
 * Provides context-aware documentation links for code elements
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
exports.MorseDocumentLinkProvider = void 0;
exports.registerDocumentLinkProvider = registerDocumentLinkProvider;
const vscode = __importStar(require("vscode"));
class MorseDocumentLinkProvider {
    documentationLinks = new Map();
    _onDidChangeLinks = new vscode.EventEmitter();
    onDidChangeLinks = this._onDidChangeLinks.event;
    // Common documentation URL patterns
    docUrls = {
        'typescript': 'https://www.typescriptlang.org/docs/',
        'javascript': 'https://developer.mozilla.org/en-US/docs/Web/JavaScript',
        'python': 'https://docs.python.org/3/',
        'go': 'https://go.dev/doc/',
        'rust': 'https://doc.rust-lang.org/book/',
        'react': 'https://react.dev/',
        'vue': 'https://vuejs.org/guide/',
        'angular': 'https://angular.io/docs',
        'node': 'https://nodejs.org/docs/',
        'vscode': 'https://code.visualstudio.com/api',
    };
    // Common error patterns and their documentation
    errorPatterns = [
        { pattern: /Cannot find module ['"](\w+)['"]/g, url: 'https://stackoverflow.com/search?q=TypeScript+Cannot+find+module', title: 'Module not found' },
        { pattern: /Property ['"](\w+)['"] does not exist/g, url: 'https://stackoverflow.com/search?q=TypeScript+Property+does+not+exist', title: 'Property does not exist' },
        { pattern: /Type ['"](\w+)['"] is not assignable to type/g, url: 'https://stackoverflow.com/search?q=TypeScript+type+not+assignable', title: 'Type mismatch' },
        { pattern: /SyntaxError:/g, url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Errors', title: 'Syntax Error' },
        { pattern: /ReferenceError:/g, url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Errors/ReferenceError', title: 'Reference Error' },
        { pattern: /TypeError:/g, url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Errors/TypeError', title: 'Type Error' },
    ];
    provideDocumentLinks(document, token) {
        const links = [];
        const text = document.getText();
        const languageId = document.languageId;
        // Add language documentation link at the top of the file
        if (this.docUrls[languageId]) {
            const range = new vscode.Range(0, 0, 0, 0);
            links.push(new vscode.DocumentLink(range, vscode.Uri.parse(this.docUrls[languageId])));
        }
        // Find import/require statements and add links to documentation
        const importRegex = /(?:import\s+(?:.*?)\s+from\s+['"]|require\s*\()['"](\@?[\w/-]+)['"]/g;
        let match;
        while ((match = importRegex.exec(text)) !== null) {
            const moduleName = match[1];
            const position = document.positionAt(match.index);
            const endPosition = document.positionAt(match.index + match[0].length);
            // Try to find documentation for the module
            const docUrl = this.getModuleDocumentationUrl(moduleName, languageId);
            if (docUrl) {
                links.push(new vscode.DocumentLink(new vscode.Range(position, endPosition), vscode.Uri.parse(docUrl)));
            }
        }
        // Find error messages in comments and add links
        const commentRegex = /\/\/.*?(error|warning|hack|todo|fixme):\s*(.*)/gi;
        while ((match = commentRegex.exec(text)) !== null) {
            const position = document.positionAt(match.index);
            const endPosition = document.positionAt(match.index + match[0].length);
            // Find matching error pattern
            for (const errorPattern of this.errorPatterns) {
                if (errorPattern.pattern.test(match[2])) {
                    links.push(new vscode.DocumentLink(new vscode.Range(position, endPosition), vscode.Uri.parse(errorPattern.url)));
                    break;
                }
            }
        }
        // Check for TODO/FIXME comments with links
        const todoRegex = /(?:TODO|FIXME|HACK):\s*(.*?)(?:\s+see\s+(https?:\/\/\S+))?/gi;
        while ((match = todoRegex.exec(text)) !== null) {
            const position = document.positionAt(match.index);
            const endPosition = document.positionAt(match.index + match[0].length);
            if (match[2]) {
                // Use the explicit URL from the comment
                links.push(new vscode.DocumentLink(new vscode.Range(position, endPosition), vscode.Uri.parse(match[2])));
            }
        }
        return links;
    }
    /**
     * Get documentation URL for a module
     */
    getModuleDocumentationUrl(moduleName, languageId) {
        // Check if it's a known framework/library
        const knownModules = {
            'react': 'https://react.dev/reference',
            'react-dom': 'https://react.dev/reference/react-dom',
            'lodash': 'https://lodash.com/docs/',
            'axios': 'https://axios-http.com/docs/intro',
            'express': 'https://expressjs.com/en/api/',
            'mongoose': 'https://mongoosejs.com/docs/',
            'vue': 'https://vuejs.org/api/',
            '@angular/core': 'https://angular.io/api/core',
            'next': 'https://nextjs.org/docs',
            'svelte': 'https://svelte.dev/docs',
        };
        if (knownModules[moduleName]) {
            return knownModules[moduleName];
        }
        // Check for scoped packages
        if (moduleName.startsWith('@')) {
            return `https://www.npmjs.com/package/${moduleName}`;
        }
        return null;
    }
    /**
     * Add custom documentation link
     */
    addDocumentationLink(pattern, link) {
        const existing = this.documentationLinks.get(pattern) || [];
        existing.push(link);
        this.documentationLinks.set(pattern, existing);
        this._onDidChangeLinks.fire();
    }
    /**
     * Get all registered documentation links
     */
    getDocumentationLinks() {
        return new Map(this.documentationLinks);
    }
    /**
     * Resolve a document link
     */
    resolveDocumentLink(link, token) {
        // Pre-resolve links - VS Code handles most resolution automatically
        return link;
    }
    dispose() {
        this._onDidChangeLinks.dispose();
    }
}
exports.MorseDocumentLinkProvider = MorseDocumentLinkProvider;
/**
 * Register the document link provider
 */
function registerDocumentLinkProvider(context) {
    const linkProvider = new MorseDocumentLinkProvider();
    // Register document link provider
    const registration = vscode.languages.registerDocumentLinkProvider({ scheme: 'file', pattern: '**/*.{ts,js,tsx,jsx,py,go,rs}' }, linkProvider);
    // Register command to open documentation
    const openDocsCommand = vscode.commands.registerCommand('morse.openDocumentation', async () => {
        const editor = vscode.window.activeTextEditor;
        // Get current word or selection
        let query = '';
        if (editor) {
            const selection = editor.selection;
            if (!selection.isEmpty) {
                query = editor.document.getText(selection);
            }
            else {
                const position = editor.selection.active;
                const word = editor.document.getWordRangeAtPosition(position);
                if (word) {
                    query = editor.document.getText(word);
                }
            }
        }
        // Show options for documentation
        const choice = await vscode.window.showQuickPick([
            { label: '$(book) MDN Web Docs', url: 'https://developer.mozilla.org/search?q=' },
            { label: '$(symbol-property) TypeScript', url: 'https://www.typescriptlang.org/docs/' },
            { label: '$(symbol-module) npm', url: 'https://www.npmjs.com/search?q=' },
            { label: '$(symbol-event) Stack Overflow', url: 'https://stackoverflow.com/search?q=' },
            { label: '$(link) GitHub', url: 'https://github.com/search?q=' },
            { label: '$( Globe) Custom URL...', url: 'custom' },
        ], {
            title: 'Open Documentation',
            placeHolder: 'Select documentation source'
        });
        if (!choice)
            return;
        if (choice.url === 'custom') {
            const url = await vscode.window.showInputBox({
                title: 'Custom Documentation URL',
                placeHolder: 'Enter URL'
            });
            if (url) {
                vscode.env.openExternal(vscode.Uri.parse(url));
            }
        }
        else {
            const searchQuery = query || await vscode.window.showInputBox({
                title: 'Search Query',
                placeHolder: 'Enter search query'
            }) || '';
            vscode.env.openExternal(vscode.Uri.parse(choice.url + encodeURIComponent(searchQuery)));
        }
    });
    // Register command to add custom link
    const addCustomLinkCommand = vscode.commands.registerCommand('morse.addCustomDocLink', async () => {
        const pattern = await vscode.window.showInputBox({
            title: 'Pattern',
            placeHolder: 'Enter pattern to match (e.g., "my-lib")'
        });
        if (!pattern)
            return;
        const title = await vscode.window.showInputBox({
            title: 'Title',
            placeHolder: 'Enter link title'
        });
        if (!title)
            return;
        const url = await vscode.window.showInputBox({
            title: 'URL',
            placeHolder: 'Enter documentation URL'
        });
        if (!url)
            return;
        const category = await vscode.window.showQuickPick(['api', 'guide', 'reference', 'example', 'error'], { title: 'Category', placeHolder: 'Select category' });
        linkProvider.addDocumentationLink(pattern, {
            url,
            title,
            description: '',
            category: category || 'reference'
        });
        vscode.window.showInformationMessage(`Custom documentation link added for "${pattern}"`);
    });
    context.subscriptions.push(registration, openDocsCommand, addCustomLinkCommand);
    return {
        dispose: () => {
            registration.dispose();
            openDocsCommand.dispose();
            addCustomLinkCommand.dispose();
            linkProvider.dispose();
        }
    };
}
//# sourceMappingURL=MorseDocumentLinkProvider.js.map