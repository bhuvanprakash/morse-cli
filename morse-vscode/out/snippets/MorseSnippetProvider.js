"use strict";
/**
 * Morse Snippet Provider
 * AI-powered code snippet management and generation
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
exports.MorseSnippetProvider = void 0;
const vscode = __importStar(require("vscode"));
class MorseSnippetProvider {
    context;
    client;
    snippets = new Map();
    _onDidChangeSnippets = new vscode.EventEmitter();
    onDidChangeSnippets = this._onDidChangeSnippets.event;
    constructor(context, client) {
        this.context = context;
        this.client = client;
        this.loadSnippets();
    }
    /**
     * Load snippets from workspace storage
     */
    async loadSnippets() {
        const stored = this.context.workspaceState.get('morseSnippets', []);
        stored.forEach(snippet => {
            this.snippets.set(snippet.id, snippet);
        });
    }
    /**
     * Save snippets to workspace storage
     */
    async saveSnippets() {
        const snippetsArray = Array.from(this.snippets.values());
        await this.context.workspaceState.update('morseSnippets', snippetsArray);
        this._onDidChangeSnippets.fire();
    }
    /**
     * Provide completion items for code snippets
     */
    provideCompletionItems(document, position, token, context) {
        const items = [];
        const linePrefix = document.lineAt(position).text.substring(0, position.character);
        // Get language of current document
        const language = document.languageId;
        // Add Morse AI snippets
        this.snippets.forEach((snippet) => {
            // Filter by language if applicable
            if (snippet.language && snippet.language !== language && snippet.language !== 'general') {
                return;
            }
            // Check if prefix matches
            if (snippet.prefix && linePrefix.endsWith(snippet.prefix)) {
                const item = new vscode.CompletionItem(snippet.name, vscode.CompletionItemKind.Snippet);
                item.detail = snippet.description || snippet.name;
                item.documentation = new vscode.MarkdownString(snippet.body);
                item.insertText = new vscode.SnippetString(snippet.body);
                item.additionalTextEdits = [];
                // Add tags as completion terms
                item.tags = snippet.tags.map(tag => vscode.CompletionItemTag.Deprecated);
                items.push(item);
            }
        });
        // Add AI-suggested completion if enabled
        this.provideAISuggestions(document, position, items, token);
        return items;
    }
    /**
     * Provide AI-suggested code completions
     */
    async provideAISuggestions(document, position, items, token) {
        const config = vscode.workspace.getConfiguration('morse');
        const enableAICompletion = config.get('snippetAICompletion', true);
        if (!enableAICompletion)
            return;
        // Get recent code context
        const range = new vscode.Range(Math.max(0, position.line - 20), 0, position.line, position.character);
        const codeContext = document.getText(range);
        if (codeContext.length < 10)
            return;
        try {
            // Request AI suggestion from Morse client
            const suggestion = await this.client.requestCompletion({
                context: codeContext,
                language: document.languageId,
                position: { line: position.line + 1, column: position.character + 1 }
            }, token);
            if (suggestion && suggestion.length > 0) {
                const aiItem = new vscode.CompletionItem('🤖 AI Suggestion', vscode.CompletionItemKind.Text);
                aiItem.detail = 'AI-generated code';
                aiItem.documentation = new vscode.MarkdownString(suggestion);
                aiItem.insertText = suggestion;
                aiItem.sortText = '~~~~~~~~~~'; // High priority
                items.push(aiItem);
            }
        }
        catch (error) {
            console.error('Failed to get AI suggestion:', error);
        }
    }
    /**
     * Resolve completion item details
     */
    resolveCompletionItem(item, token) {
        // Find the snippet
        for (const [, snippet] of this.snippets) {
            if (snippet.name === item.label) {
                item.detail = `${snippet.name} (${snippet.source}) - Used ${snippet.usageCount} times`;
                item.documentation = new vscode.MarkdownString()
                    .appendMarkdown(`**${snippet.name}**\n\n`)
                    .appendMarkdown(`${snippet.description || 'No description'}\n\n`)
                    .appendCodeblock(snippet.body, snippet.language);
                // Increment usage count
                snippet.usageCount++;
                this.saveSnippets();
                break;
            }
        }
        return item;
    }
    /**
     * Provide code actions for snippet-related operations
     */
    provideCodeActions(document, range, context, token) {
        const actions = [];
        // Add action to save selection as snippet
        const saveSnippetAction = new vscode.CodeAction('Save as Morse Snippet', vscode.CodeActionKind.RefactorExtract);
        saveSnippetAction.command = {
            command: 'morse.saveSnippet',
            title: 'Save as Morse Snippet'
        };
        actions.push(saveSnippetAction);
        // Add action to generate AI snippet
        const generateSnippetAction = new vscode.CodeAction('Generate AI Snippet', vscode.CodeActionKind.Source);
        generateSnippetAction.command = {
            command: 'morse.generateSnippet',
            title: 'Generate AI Snippet'
        };
        actions.push(generateSnippetAction);
        return actions;
    }
    /**
     * Create a new snippet from selection
     */
    async createSnippet(name, prefix, body, description, language) {
        const snippet = {
            id: `snippet-${Date.now()}-${Math.random().toString(36).substring(7)}`,
            name,
            prefix,
            body,
            description,
            language,
            tags: [],
            source: 'user-created',
            usageCount: 0,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        this.snippets.set(snippet.id, snippet);
        await this.saveSnippets();
        return snippet;
    }
    /**
     * Generate AI-powered snippet
     */
    async generateAISnippet(context, language) {
        try {
            const prompt = `Generate a useful code snippet for ${language} based on this code:\n${context}\n\nProvide a short name, prefix, and the improved snippet.`;
            const response = await this.client.generate({
                messages: [{ role: 'user', content: prompt }]
            });
            if (response && response.content) {
                // Parse the response to extract snippet details
                const snippetData = this.parseAISnippetResponse(response.content, language);
                if (snippetData) {
                    const snippet = {
                        id: `ai-snippet-${Date.now()}`,
                        name: snippetData.name ?? 'Snippet',
                        prefix: snippetData.prefix ?? '',
                        body: snippetData.body ?? '',
                        description: snippetData.description ?? '',
                        language: snippetData.language ?? language,
                        tags: snippetData.tags ?? [],
                        source: 'ai-generated',
                        usageCount: 0,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    };
                    this.snippets.set(snippet.id, snippet);
                    await this.saveSnippets();
                    return snippet;
                }
            }
        }
        catch (error) {
            console.error('Failed to generate AI snippet:', error);
        }
        return null;
    }
    /**
     * Parse AI response into snippet data
     */
    parseAISnippetResponse(response, language) {
        try {
            // Try to extract JSON from response
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const data = JSON.parse(jsonMatch[0]);
                return {
                    name: data.name || 'AI Snippet',
                    prefix: data.prefix || '',
                    body: data.body || response,
                    description: data.description || '',
                    language: data.language || language,
                    tags: data.tags || []
                };
            }
            // Fallback: create snippet from raw response
            return {
                name: 'AI Generated Snippet',
                prefix: 'ai',
                body: response,
                description: 'Generated by Morse AI',
                language,
                tags: ['ai-generated']
            };
        }
        catch {
            return null;
        }
    }
    /**
     * Delete a snippet
     */
    async deleteSnippet(id) {
        const deleted = this.snippets.delete(id);
        if (deleted) {
            await this.saveSnippets();
        }
        return deleted;
    }
    /**
     * Get all snippets
     */
    getAllSnippets() {
        return Array.from(this.snippets.values());
    }
    /**
     * Get snippets by language
     */
    getSnippetsByLanguage(language) {
        return Array.from(this.snippets.values()).filter(s => s.language === language || s.language === 'general');
    }
    /**
     * Search snippets by name or tags
     */
    searchSnippets(query) {
        const lowerQuery = query.toLowerCase();
        return Array.from(this.snippets.values()).filter(s => s.name.toLowerCase().includes(lowerQuery) ||
            s.tags.some(t => t.toLowerCase().includes(lowerQuery)) ||
            s.description.toLowerCase().includes(lowerQuery));
    }
    /**
     * Export snippets
     */
    exportSnippets() {
        const snippetsArray = this.getAllSnippets();
        return JSON.stringify(snippetsArray, null, 2);
    }
    /**
     * Import snippets
     */
    async importSnippets(json) {
        try {
            const imported = JSON.parse(json);
            let count = 0;
            for (const snippet of imported) {
                if (!this.snippets.has(snippet.id)) {
                    snippet.id = `imported-${Date.now()}-${Math.random().toString(36).substring(7)}`;
                    snippet.source = 'imported';
                    this.snippets.set(snippet.id, snippet);
                    count++;
                }
            }
            await this.saveSnippets();
            return count;
        }
        catch (error) {
            console.error('Failed to import snippets:', error);
            return 0;
        }
    }
    /**
     * Get snippet statistics
     */
    getStatistics() {
        const snippets = this.getAllSnippets();
        return {
            total: snippets.length,
            aiGenerated: snippets.filter(s => s.source === 'ai-generated').length,
            userCreated: snippets.filter(s => s.source === 'user-created').length,
            imported: snippets.filter(s => s.source === 'imported').length
        };
    }
}
exports.MorseSnippetProvider = MorseSnippetProvider;
//# sourceMappingURL=MorseSnippetProvider.js.map