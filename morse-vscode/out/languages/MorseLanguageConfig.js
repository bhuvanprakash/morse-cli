"use strict";
/**
 * Morse Language Configuration
 * Provides language support for .morse files including:
 * - File associations
 * - Syntax highlighting configuration
 * - Language indentation settings
 * - Auto-closing pairs
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
exports.MorseLanguageConfig = void 0;
exports.registerMorseLanguageFeatures = registerMorseLanguageFeatures;
const vscode = __importStar(require("vscode"));
/**
 * Morse language configuration provider
 * Registers .morse file support and syntax highlighting
 */
class MorseLanguageConfig {
    static MORSE_FILE_EXT = '.morse';
    static MORSE_LANGUAGE_ID = 'morse';
    /**
     * Register all language configurations for Morse files
     */
    static register() {
        // Register Morse language
        const languages = {
            comments: {
                lineComment: '#',
                blockComment: ['"""', '"""'],
            },
            brackets: [
                ['{', '}'],
                ['[', ']'],
                ['(', ')'],
            ],
            autoClosingPairs: [
                { open: '{', close: '}' },
                { open: '[', close: ']' },
                { open: '(', close: ')' },
                { open: '"', close: '"' },
                { open: "'", close: "'" },
                { open: '"""', close: '"""' },
            ],
            indentationRules: {
                increaseIndentPattern: /^\s*(?:def|class|if|elif|else|for|while|try|except|finally|with|async)\b.*:\s*$/,
                decreaseIndentPattern: /^\s*(?:elif|else|except|finally)\b.*:\s*$/,
            },
            wordPattern: /(-?\d*\.\d\w*)|([^\`\~\!\@\#\%\^\&\*\(\)\-\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\?\s]+)/g,
            onEnterRules: [
                {
                    beforeText: /^\s*(?:def|class|if|elif|else|for|while|try|except|finally|with)\b.*:\s*$/,
                    action: { indentAction: vscode.IndentAction.Indent },
                },
                {
                    beforeText: /^\s*#.*$/,
                    afterText: /^#.*$/,
                    action: { indentAction: vscode.IndentAction.None },
                },
            ],
        };
        // Register the language configuration
        vscode.languages.setLanguageConfiguration(this.MORSE_LANGUAGE_ID, languages);
    }
    /**
     * Register file associations for .morse files
     */
    static registerFileAssociations() {
        // File associations for .morse are in package.json contributes.languages
    }
    /**
     * Get syntax highlighting tokens provider for Morse
     * This provides semantic tokens for syntax highlighting
     */
    static registerSemanticTokens() {
        const tokenTypes = ['comment', 'variable', 'string', 'keyword', 'number'];
        const tokenModifiers = [];
        const legend = new vscode.SemanticTokensLegend(tokenTypes, tokenModifiers);
        const type = (name) => tokenTypes.indexOf(name);
        const provider = {
            provideDocumentSemanticTokens(document, _token) {
                const builder = new vscode.SemanticTokensBuilder(legend);
                const text = document.getText();
                const lines = text.split('\n');
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    if (!line.trim())
                        continue;
                    const commentMatch = line.match(/^(\s*)#(.*)$/);
                    if (commentMatch) {
                        const start = (commentMatch[1]?.length ?? 0);
                        builder.push(i, start, line.length - start, type('comment'), 0);
                        continue;
                    }
                    const keyValueMatch = line.match(/^(\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.*)$/);
                    if (keyValueMatch) {
                        const indentLen = keyValueMatch[1]?.length ?? 0;
                        const keyLen = keyValueMatch[2]?.length ?? 0;
                        builder.push(i, indentLen, keyLen, type('variable'), 0);
                        const value = keyValueMatch[3] ?? '';
                        const valueStart = indentLen + keyLen + 2;
                        if (value.startsWith('"') || value.startsWith("'")) {
                            builder.push(i, valueStart, value.length, type('string'), 0);
                        }
                        else if (value === 'true' || value === 'false') {
                            builder.push(i, valueStart, value.length, type('keyword'), 0);
                        }
                        else if (/^\d+(\.\d+)?$/.test(value.trim())) {
                            builder.push(i, valueStart, value.trim().length, type('number'), 0);
                        }
                        continue;
                    }
                    const listMatch = line.match(/^(\s*)[-*]\s+(.*)$/);
                    if (listMatch && (listMatch[2]?.startsWith('"') || listMatch[2]?.startsWith("'"))) {
                        const valueStart = (listMatch[1]?.length ?? 0) + 2;
                        builder.push(i, valueStart, listMatch[2].length, type('string'), 0);
                    }
                }
                return builder.build();
            },
        };
        return provider;
    }
    /**
     * Register completion provider for Morse files
     */
    static registerCompletionProvider() {
        const provider = {
            provideCompletionItems(document, position, token, context) {
                const items = [];
                // Common configuration keys
                const configKeys = [
                    { label: 'apiKey', detail: 'API key for the provider', insertText: 'apiKey: ' },
                    { label: 'model', detail: 'Model name to use', insertText: 'model: ' },
                    { label: 'provider', detail: 'Provider name (anthropic, openai, etc.)', insertText: 'provider: ' },
                    { label: 'temperature', detail: 'Temperature setting (0-1)', insertText: 'temperature: ' },
                    { label: 'maxTokens', detail: 'Maximum tokens to generate', insertText: 'maxTokens: ' },
                    { label: 'baseUrl', detail: 'Base URL for API endpoint', insertText: 'baseUrl: ' },
                    { label: 'timeout', detail: 'Request timeout in milliseconds', insertText: 'timeout: ' },
                    { label: 'retryAttempts', detail: 'Number of retry attempts', insertText: 'retryAttempts: ' },
                ];
                // Common values for provider
                const providers = [
                    'anthropic',
                    'openai',
                    'google',
                    'groq',
                    'mistral',
                    'cohere',
                    'local',
                ];
                // Add configuration key completions
                for (const key of configKeys) {
                    const item = new vscode.CompletionItem(key.label, vscode.CompletionItemKind.Property);
                    item.detail = key.detail;
                    item.insertText = new vscode.SnippetString(key.insertText);
                    items.push(item);
                }
                // Add provider completions when provider: is typed
                const line = document.lineAt(position.line).text;
                if (line.includes('provider:')) {
                    for (const provider of providers) {
                        const item = new vscode.CompletionItem(provider, vscode.CompletionItemKind.Value);
                        item.insertText = provider;
                        items.push(item);
                    }
                }
                return new vscode.CompletionList(items);
            },
        };
        return provider;
    }
    /**
     * Register hover provider for Morse files
     */
    static registerHoverProvider() {
        const provider = {
            provideHover(document, position, token) {
                const line = document.lineAt(position.line).text;
                const word = document.getWordRangeAtPosition(position);
                if (!word)
                    return null;
                const wordText = document.getText(word);
                // Provide hover for known configuration keys
                const hoverContent = {
                    apiKey: 'Your API key for the selected provider. Can use environment variable syntax: ${API_KEY}',
                    model: 'The model identifier to use for AI generation',
                    provider: 'The AI provider to use (anthropic, openai, google, groq, mistral, cohere, local)',
                    temperature: 'Controls randomness (0-1). Lower = more focused, higher = more creative',
                    maxTokens: 'Maximum number of tokens to generate in a single response',
                    baseUrl: 'Override the default API endpoint URL',
                    timeout: 'Request timeout in milliseconds',
                    retryAttempts: 'Number of times to retry failed requests',
                };
                if (hoverContent[wordText]) {
                    return new vscode.Hover(hoverContent[wordText]);
                }
                return null;
            },
        };
        return provider;
    }
}
exports.MorseLanguageConfig = MorseLanguageConfig;
/**
 * Register all language features for Morse files
 */
function registerMorseLanguageFeatures(context) {
    // Register language configuration
    MorseLanguageConfig.register();
    // Register semantic tokens provider
    const semanticTokensProvider = MorseLanguageConfig.registerSemanticTokens();
    context.subscriptions.push(vscode.languages.registerDocumentSemanticTokensProvider({ scheme: 'file', language: 'morse' }, semanticTokensProvider, new vscode.SemanticTokensLegend(['variable', 'string', 'keyword', 'number'], [])));
    // Register completion provider
    const completionProvider = MorseLanguageConfig.registerCompletionProvider();
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider({ scheme: 'file', language: 'morse' }, completionProvider, ':', ' ', '"'));
    // Register hover provider
    const hoverProvider = MorseLanguageConfig.registerHoverProvider();
    context.subscriptions.push(vscode.languages.registerHoverProvider({ scheme: 'file', language: 'morse' }, hoverProvider));
    console.log('[Morse] Language features registered');
}
//# sourceMappingURL=MorseLanguageConfig.js.map