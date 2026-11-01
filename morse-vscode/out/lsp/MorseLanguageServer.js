"use strict";
/**
 * Morse Language Server
 * Enhanced LSP support for code completion, diagnostics, and hover information
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
exports.MorseLanguageServer = exports.DEFAULT_LANGUAGE_SERVER_CONFIG = void 0;
exports.createMorseLanguageServer = createMorseLanguageServer;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
/**
 * Default language server configuration
 */
exports.DEFAULT_LANGUAGE_SERVER_CONFIG = {
    enabled: true,
    languages: ['javascript', 'typescript', 'python', 'go', 'rust', 'java'],
    maxCompletions: 50,
    enableDiagnostics: true,
    enableHover: true,
    diagnosticSeverity: vscode.DiagnosticSeverity.Warning,
};
/**
 * Morse Language Server
 * Provides enhanced LSP features for the Morse extension
 */
class MorseLanguageServer {
    client;
    config;
    completionProvider = null;
    hoverProvider = null;
    diagnosticCollection;
    signatureProvider = null;
    definitionProvider = null;
    referenceProvider = null;
    documentSymbolProvider = null;
    constructor(client, config) {
        this.client = client;
        this.config = { ...exports.DEFAULT_LANGUAGE_SERVER_CONFIG, ...config };
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('morse');
    }
    /**
     * Initialize the language server
     */
    async initialize(context) {
        if (!this.config.enabled) {
            return;
        }
        // Register completion provider
        this.registerCompletionProvider(context);
        // Register hover provider
        if (this.config.enableHover) {
            this.registerHoverProvider(context);
        }
        // Register signature help provider
        this.registerSignatureProvider(context);
        // Register definition provider
        this.registerDefinitionProvider(context);
        // Register references provider
        this.registerReferencesProvider(context);
        // Register document symbols provider
        this.registerDocumentSymbolProvider(context);
        // Set up workspace diagnostics
        this.registerDiagnostics(context);
        // Listen for configuration changes
        context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(() => {
            this.updateConfiguration();
        }));
        console.log('Morse Language Server initialized');
    }
    /**
     * Register code completion provider
     */
    registerCompletionProvider(context) {
        this.completionProvider = {
            provideCompletionItems: async (document, position, token, context) => {
                const completions = [];
                // Get word at cursor
                const range = document.getWordRangeAtPosition(position);
                const word = range ? document.getText(range) : '';
                // Get line text for context
                const lineText = document.lineAt(position.line).text;
                const beforeCursor = lineText.substring(0, position.character);
                // Try to get Morse completions
                try {
                    const morseCompletions = await this.getMorseCompletions(document, position, word, beforeCursor);
                    completions.push(...morseCompletions);
                }
                catch (error) {
                    console.error('Error getting Morse completions:', error);
                }
                // Add Morse-specific keywords
                const morseKeywords = this.getMorseKeywords();
                for (const keyword of morseKeywords) {
                    const item = new vscode.CompletionItem(keyword.label, keyword.kind);
                    item.detail = keyword.detail;
                    item.documentation = keyword.documentation;
                    item.insertText = keyword.insertText;
                    item.sortText = keyword.sortText;
                    completions.push(item);
                }
                // Limit completions
                return completions.slice(0, this.config.maxCompletions);
            },
            resolveCompletionItem: async (item, token) => {
                // Add more details to the completion item
                if (!item.detail) {
                    item.detail = 'Morse AI suggestion';
                }
                if (!item.documentation) {
                    item.documentation = new vscode.MarkdownString('Suggested by Morse AI');
                }
                return item;
            },
        };
        // Register for all configured languages
        for (const language of this.config.languages) {
            context.subscriptions.push(vscode.languages.registerCompletionItemProvider({ language, scheme: 'file' }, this.completionProvider, ...this.getTriggerCharacters(language)));
        }
    }
    /**
     * Get trigger characters for a language
     */
    getTriggerCharacters(language) {
        const triggerChars = {
            javascript: ['.', '('],
            typescript: ['.', '('],
            python: ['.', '('],
            go: ['.', '('],
            rust: ['.', '::'],
            java: ['.', '('],
        };
        return triggerChars[language] || ['.'];
    }
    /**
     * Get Morse completions from AI
     */
    async getMorseCompletions(document, position, word, context) {
        const completions = [];
        // Only request completions if we have enough context
        if (word.length < 2 && context.length < 5) {
            return completions;
        }
        try {
            // Get file context
            const filePath = document.uri.fsPath;
            const fileName = path.basename(filePath);
            const ext = path.extname(filePath).slice(1);
            // Create a completion request
            const request = {
                type: 'completion',
                fileName,
                fileType: ext,
                context: context.slice(-200), // Last 200 chars
                cursorWord: word,
                line: position.line + 1,
                column: position.character + 1,
            };
            // The client would handle the actual request to the Morse process
            // For now, we'll return some basic completions based on the context
        }
        catch (error) {
            console.error('Error in getMorseCompletions:', error);
        }
        return completions;
    }
    /**
     * Get Morse-specific keywords for completion
     */
    getMorseKeywords() {
        return [
            {
                label: '// morse:explain',
                kind: 15,
                detail: 'Explain the selected code',
                documentation: 'Use Morse AI to explain the selected code',
                insertText: '// morse:explain ',
                sortText: '0',
            },
            {
                label: '// morse:fix',
                kind: 15,
                detail: 'Fix issues in the selected code',
                documentation: 'Use Morse AI to fix issues in the selected code',
                insertText: '// morse:fix ',
                sortText: '1',
            },
            {
                label: '// morse:refactor',
                kind: 15,
                detail: 'Refactor the selected code',
                documentation: 'Use Morse AI to refactor the selected code',
                insertText: '// morse:refactor ',
                sortText: '2',
            },
            {
                label: '// morse:test',
                kind: 15,
                detail: 'Generate tests for the selected code',
                documentation: 'Use Morse AI to generate tests for the selected code',
                insertText: '// morse:test ',
                sortText: '3',
            },
            {
                label: '// morse:doc',
                kind: 15,
                detail: 'Generate documentation for the selected code',
                documentation: 'Use Morse AI to generate documentation for the selected code',
                insertText: '// morse:doc ',
                sortText: '4',
            },
            {
                label: '// morse:commit',
                kind: 15,
                detail: 'Generate a git commit message',
                documentation: 'Use Morse AI to generate a git commit message',
                insertText: '// morse:commit ',
                sortText: '5',
            },
        ];
    }
    /**
     * Register hover provider
     */
    registerHoverProvider(context) {
        this.hoverProvider = {
            provideHover: async (document, position, token) => {
                // Get the word at position
                const range = document.getWordRangeAtPosition(position);
                if (!range) {
                    return null;
                }
                const word = document.getText(range);
                // Check if it's a Morse command
                if (word.startsWith('morse:')) {
                    const command = word.replace('morse:', '');
                    return new vscode.Hover(new vscode.MarkdownString(`**Morse Command: ${command}**\n\nUse this command to trigger Morse AI assistance.`), range);
                }
                // Try to get AI-powered hover information
                try {
                    const hoverInfo = await this.getHoverInfo(document, position, word);
                    if (hoverInfo) {
                        return new vscode.Hover(new vscode.MarkdownString(hoverInfo), range);
                    }
                }
                catch (error) {
                    console.error('Error getting hover info:', error);
                }
                return null;
            },
        };
        for (const language of this.config.languages) {
            context.subscriptions.push(vscode.languages.registerHoverProvider({ language, scheme: 'file' }, this.hoverProvider));
        }
    }
    /**
     * Get hover information from Morse
     */
    async getHoverInfo(document, position, word) {
        // This would integrate with the Morse process to get AI-powered hover info
        // For now, return null to use default VS Code behavior
        return null;
    }
    /**
     * Register signature help provider
     */
    registerSignatureProvider(context) {
        this.signatureProvider = {
            provideSignatureHelp: async (document, position, token, context) => {
                // Get the function call context
                const line = document.lineAt(position.line).text;
                const beforeCursor = line.substring(0, position.character);
                // Try to identify the function being called
                const funcMatch = beforeCursor.match(/(\w+)\s*\(/);
                if (!funcMatch) {
                    return null;
                }
                const funcName = funcMatch[1];
                // Get signature help
                const signatures = this.getFunctionSignatures(funcName);
                if (signatures.length === 0) {
                    return null;
                }
                const sigHelp = new vscode.SignatureHelp();
                sigHelp.signatures = signatures;
                sigHelp.activeSignature = 0;
                sigHelp.activeParameter = this.countParameters(beforeCursor.substring(beforeCursor.lastIndexOf('(')));
                return sigHelp;
            },
        };
        for (const language of this.config.languages) {
            context.subscriptions.push(vscode.languages.registerSignatureHelpProvider({ language, scheme: 'file' }, this.signatureProvider, '(', ','));
        }
    }
    /**
     * Get function signatures
     */
    getFunctionSignatures(funcName) {
        // Common function signatures that might help
        const signatures = {
            'console.log': [
                {
                    label: 'console.log(...args: any[]): void',
                    documentation: 'Outputs a message to the console',
                    parameters: [
                        {
                            label: 'args',
                            documentation: 'The values to output',
                        },
                    ],
                },
            ],
            'fetch': [
                {
                    label: 'fetch(url: string, options?: RequestInit): Promise<Response>',
                    documentation: 'Fetches a resource from the network',
                    parameters: [
                        {
                            label: 'url',
                            documentation: 'The resource to fetch',
                        },
                        {
                            label: 'options',
                            documentation: 'Optional request options',
                        },
                    ],
                },
            ],
        };
        return signatures[funcName] || [];
    }
    /**
     * Count parameters in a function call
     */
    countParameters(argString) {
        let count = 0;
        let depth = 0;
        let inString = false;
        let stringChar = '';
        for (const char of argString) {
            if (inString) {
                if (char === stringChar && argString[argString.indexOf(char) - 1] !== '\\') {
                    inString = false;
                }
            }
            else if (char === '"' || char === "'" || char === '`') {
                inString = true;
                stringChar = char;
            }
            else if (char === '(') {
                depth++;
            }
            else if (char === ')') {
                depth--;
            }
            else if (char === ',' && depth === 1) {
                count++;
            }
        }
        return count;
    }
    /**
     * Register definition provider
     */
    registerDefinitionProvider(context) {
        this.definitionProvider = {
            provideDefinition: async (document, position, token) => {
                // This would use AI to find the definition of a symbol
                // For now, return null to use default VS Code behavior
                return null;
            },
        };
        for (const language of this.config.languages) {
            context.subscriptions.push(vscode.languages.registerDefinitionProvider({ language, scheme: 'file' }, this.definitionProvider));
        }
    }
    /**
     * Register references provider
     */
    registerReferencesProvider(context) {
        this.referenceProvider = {
            provideReferences: async (document, position, context, token) => {
                // This would use AI to find all references to a symbol
                return null;
            },
        };
        for (const language of this.config.languages) {
            context.subscriptions.push(vscode.languages.registerReferenceProvider({ language, scheme: 'file' }, this.referenceProvider));
        }
    }
    /**
     * Register document symbols provider
     */
    registerDocumentSymbolProvider(context) {
        this.documentSymbolProvider = {
            provideDocumentSymbols: async (document, token) => {
                // This would use AI to identify document symbols
                return null;
            },
        };
        for (const language of this.config.languages) {
            context.subscriptions.push(vscode.languages.registerDocumentSymbolProvider({ language, scheme: 'file' }, this.documentSymbolProvider));
        }
    }
    /**
     * Register diagnostics
     */
    registerDiagnostics(context) {
        if (!this.config.enableDiagnostics) {
            return;
        }
        // Listen for document changes
        context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(async (event) => {
            if (!this.config.enableDiagnostics) {
                return;
            }
            const document = event.document;
            if (!this.config.languages.includes(document.languageId)) {
                return;
            }
            // Debounce diagnostics
            await this.updateDiagnostics(document);
        }));
        // Initial diagnostics for open documents
        vscode.workspace.textDocuments.forEach(async (document) => {
            if (this.config.languages.includes(document.languageId)) {
                await this.updateDiagnostics(document);
            }
        });
    }
    /**
     * Update diagnostics for a document
     */
    async updateDiagnostics(document) {
        const diagnostics = [];
        // Check for Morse-specific issues
        const text = document.getText();
        // Check for common issues in Morse comments
        const lines = text.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            // Check for malformed morse commands
            const morseCommandMatch = line.match(/\/\/\s*morse:(\w+)/);
            if (morseCommandMatch) {
                const command = morseCommandMatch[1];
                const validCommands = [
                    'explain', 'fix', 'refactor', 'test', 'doc', 'commit',
                    'improve', 'optimize', 'security', 'review'
                ];
                if (!validCommands.includes(command)) {
                    const range = new vscode.Range(new vscode.Position(i, line.indexOf('morse:')), new vscode.Position(i, line.indexOf('morse:') + command.length + 6));
                    const diagnostic = new vscode.Diagnostic(range, `Unknown Morse command: ${command}`, vscode.DiagnosticSeverity.Information);
                    diagnostic.code = 'morse-unknown-command';
                    diagnostic.source = 'Morse';
                    diagnostics.push(diagnostic);
                }
            }
            // Check for incomplete Morse commands
            if (line.includes('// morse:') && !line.match(/\/\/\s*morse:\w+/)) {
                const range = new vscode.Range(new vscode.Position(i, line.indexOf('// morse:')), new vscode.Position(i, line.indexOf('// morse:') + 10));
                const diagnostic = new vscode.Diagnostic(range, 'Incomplete Morse command', this.config.diagnosticSeverity);
                diagnostic.code = 'morse-incomplete-command';
                diagnostic.source = 'Morse';
                diagnostics.push(diagnostic);
            }
        }
        this.diagnosticCollection.set(document.uri, diagnostics);
    }
    /**
     * Update configuration from workspace settings
     */
    updateConfiguration() {
        const config = vscode.workspace.getConfiguration('morse');
        const enabled = config.get('languageServer.enabled', true);
        const maxCompletions = config.get('languageServer.maxCompletions', 50);
        const enableDiagnostics = config.get('languageServer.diagnostics', true);
        const enableHover = config.get('languageServer.hover', true);
        this.config.enabled = enabled;
        this.config.maxCompletions = maxCompletions;
        this.config.enableDiagnostics = enableDiagnostics;
        this.config.enableHover = enableHover;
    }
    /**
     * Dispose of the language server
     */
    dispose() {
        this.diagnosticCollection.clear();
        this.diagnosticCollection.dispose();
    }
}
exports.MorseLanguageServer = MorseLanguageServer;
/**
 * Create and register the Morse language server
 */
function createMorseLanguageServer(context, client) {
    const server = new MorseLanguageServer(client);
    server.initialize(context);
    return server;
}
//# sourceMappingURL=MorseLanguageServer.js.map