"use strict";
/**
 * Symbol Provider for Morse AI-defined symbols and quick navigation
 * Provides AI-powered symbol detection and navigation
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
exports.MorseSymbolProvider = void 0;
exports.registerSymbolProvider = registerSymbolProvider;
const vscode = __importStar(require("vscode"));
class MorseSymbolProvider {
    aiSymbols = new Map();
    _onDidChangeSymbols = new vscode.EventEmitter();
    onDidChangeSymbols = this._onDidChangeSymbols.event;
    provideDocumentSymbols(document, token) {
        const symbols = [];
        const text = document.getText();
        // Find function declarations
        const functionPatterns = [
            /^(?:export\s+)?(?:async\s+)?function\s+(\w+)/gm,
            /^(?:export\s+)?(?:async\s+)?(?:\w+)\s*[:=]\s*(?:async\s*)?(?:\([^)]*\)|[^=])\s*=>/gm,
            /^(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[^=])\s*=>/gm,
        ];
        // Find class declarations
        const classPattern = /^(?:export\s+)?class\s+(\w+)(?:\s+extends\s+\w+)?(?:\s+implements\s+[\w,\s]+)?/gm;
        // Find interface/type declarations
        const typePattern = /^(?:export\s+)?(?:interface|type)\s+(\w+)/gm;
        // Find constant declarations
        const constPattern = /^(?:export\s+)?const\s+(\w+)\s*=/gm;
        // Find variable declarations
        const varPattern = /^(?:export\s+)?(?:let|var)\s+(\w+)\s*=/gm;
        // Process each pattern
        for (const pattern of functionPatterns) {
            let match;
            while ((match = pattern.exec(text)) !== null) {
                const name = match[1];
                if (name) {
                    const position = document.positionAt(match.index);
                    const range = new vscode.Range(position, position);
                    symbols.push(new vscode.DocumentSymbol(name, 'function', vscode.SymbolKind.Function, range, range));
                }
            }
        }
        // Process classes
        let match;
        while ((match = classPattern.exec(text)) !== null) {
            const name = match[1];
            if (name) {
                const position = document.positionAt(match.index);
                const range = new vscode.Range(position, position);
                symbols.push(new vscode.DocumentSymbol(name, 'class', vscode.SymbolKind.Class, range, range));
            }
        }
        // Process types/interfaces
        while ((match = typePattern.exec(text)) !== null) {
            const name = match[1];
            if (name) {
                const position = document.positionAt(match.index);
                const range = new vscode.Range(position, position);
                symbols.push(new vscode.DocumentSymbol(name, 'type', vscode.SymbolKind.Interface, range, range));
            }
        }
        // Process constants
        while ((match = constPattern.exec(text)) !== null) {
            const name = match[1];
            if (name && !name.startsWith('_')) {
                const position = document.positionAt(match.index);
                const range = new vscode.Range(position, position);
                symbols.push(new vscode.DocumentSymbol(name, 'constant', vscode.SymbolKind.Constant, range, range));
            }
        }
        return symbols;
    }
    /**
     * Add AI-detected symbol
     */
    addAISymbol(uri, symbol) {
        const existing = this.aiSymbols.get(uri) || [];
        existing.push({ ...symbol, source: 'ai-detected' });
        this.aiSymbols.set(uri, existing);
        this._onDidChangeSymbols.fire(uri);
    }
    /**
     * Get AI symbols for a document
     */
    getAISymbols(uri) {
        return this.aiSymbols.get(uri) || [];
    }
    /**
     * Clear AI symbols for a document
     */
    clearAISymbols(uri) {
        this.aiSymbols.delete(uri);
        this._onDidChangeSymbols.fire(uri);
    }
    /**
     * Search symbols across workspace
     */
    async searchSymbols(query) {
        const results = [];
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders)
            return results;
        for (const folder of workspaceFolders) {
            const pattern = new vscode.RelativePattern(folder, '**/*.{ts,js,tsx,jsx,py,go,rs}');
            const files = await vscode.workspace.findFiles(pattern, '**/node_modules/**', 100);
            for (const file of files) {
                try {
                    const document = await vscode.workspace.openTextDocument(file);
                    const text = document.getText();
                    // Simple search for the query in code
                    const regex = new RegExp(`\\b${query}\\b`, 'gi');
                    let match;
                    while ((match = regex.exec(text)) !== null) {
                        const line = document.positionAt(match.index).line;
                        const lineText = document.lineAt(line).text;
                        results.push({
                            name: query,
                            kind: 'function',
                            description: lineText.trim(),
                            file: file.path,
                            line: line,
                            confidence: 0.8,
                            source: 'code-analysis'
                        });
                    }
                }
                catch {
                    // Skip files that can't be read
                }
            }
        }
        return results;
    }
    dispose() {
        this._onDidChangeSymbols.dispose();
    }
}
exports.MorseSymbolProvider = MorseSymbolProvider;
/**
 * Register the symbol provider
 */
function registerSymbolProvider(context) {
    const symbolProvider = new MorseSymbolProvider();
    // Register document symbol provider
    const registration = vscode.languages.registerDocumentSymbolProvider({ scheme: 'file', pattern: '**/*.{ts,js,tsx,jsx,py,go,rs}' }, symbolProvider, { label: 'Morse Symbols' });
    // Register command to search symbols
    const searchSymbolsCommand = vscode.commands.registerCommand('morse.searchSymbols', async () => {
        const query = await vscode.window.showInputBox({
            title: 'Search Symbols',
            placeHolder: 'Enter symbol name to search'
        });
        if (!query)
            return;
        const results = await symbolProvider.searchSymbols(query);
        if (results.length === 0) {
            vscode.window.showInformationMessage(`No symbols found for "${query}"`);
            return;
        }
        const items = results.slice(0, 20).map(symbol => ({
            label: `$(symbol-${symbol.kind}) ${symbol.name}`,
            description: `${symbol.file}:${symbol.line + 1}`,
            detail: symbol.description,
            symbol
        }));
        const selected = await vscode.window.showQuickPick(items, {
            title: `Search Results for "${query}"`,
            placeHolder: 'Select a symbol'
        });
        if (selected) {
            const doc = await vscode.workspace.openTextDocument(selected.symbol.file);
            const editor = await vscode.window.showTextDocument(doc);
            const position = new vscode.Position(selected.symbol.line, 0);
            editor.selection = new vscode.Selection(position, position);
            editor.revealRange(new vscode.Range(position, position));
        }
    });
    // Register command to add AI symbol
    const addAISymbolCommand = vscode.commands.registerCommand('morse.addAISymbol', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('No active editor');
            return;
        }
        const selection = editor.selection;
        const document = editor.document;
        const line = document.lineAt(selection.start.line);
        const text = selection.isEmpty ? line.text : document.getText(selection);
        const name = await vscode.window.showInputBox({
            title: 'Symbol Name',
            placeHolder: 'Enter symbol name',
            value: text.match(/\w+/)?.[0] || ''
        });
        if (!name)
            return;
        const kind = await vscode.window.showQuickPick(['function', 'class', 'variable', 'constant', 'type', 'interface', 'module'], { title: 'Symbol Kind', placeHolder: 'Select symbol kind' });
        if (!kind)
            return;
        symbolProvider.addAISymbol(document.uri.toString(), {
            name,
            kind,
            description: text,
            file: document.uri.path,
            line: selection.start.line,
            confidence: 1.0
        });
        vscode.window.showInformationMessage(`Symbol "${name}" added`);
    });
    context.subscriptions.push(registration, searchSymbolsCommand, addAISymbolCommand);
    return {
        dispose: () => {
            registration.dispose();
            searchSymbolsCommand.dispose();
            addAISymbolCommand.dispose();
            symbolProvider.dispose();
        }
    };
}
//# sourceMappingURL=MorseSymbolProvider.js.map