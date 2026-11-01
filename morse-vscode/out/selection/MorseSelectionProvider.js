"use strict";
/**
 * Selection Provider for Morse - smart code selection
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
exports.MorseSelectionProvider = void 0;
const vscode = __importStar(require("vscode"));
class MorseSelectionProvider {
    client = null;
    lastSelections = new Map();
    constructor(client) {
        this.client = client || null;
    }
    /**
     * Set the Morse client for AI-powered selection
     */
    setClient(client) {
        this.client = client;
    }
    /**
     * Register selection commands
     */
    registerCommands(context) {
        // Select containing element
        context.subscriptions.push(vscode.commands.registerCommand('morse.selection.expand', () => {
            return this.expandSelection();
        }));
        // Select current block
        context.subscriptions.push(vscode.commands.registerCommand('morse.selection.block', () => {
            return this.selectBlock();
        }));
        // Select function
        context.subscriptions.push(vscode.commands.registerCommand('morse.selection.function', () => {
            return this.selectFunction();
        }));
        // Select class
        context.subscriptions.push(vscode.commands.registerCommand('morse.selection.class', () => {
            return this.selectClass();
        }));
        // Select similar (select all occurrences of similar code)
        context.subscriptions.push(vscode.commands.registerCommand('morse.selection.similar', () => {
            return this.selectSimilar();
        }));
        // Select related (select related code based on context)
        context.subscriptions.push(vscode.commands.registerCommand('morse.selection.related', () => {
            return this.selectRelated();
        }));
        // Select all imports
        context.subscriptions.push(vscode.commands.registerCommand('morse.selection.imports', () => {
            return this.selectImports();
        }));
        // Shrink selection
        context.subscriptions.push(vscode.commands.registerCommand('morse.selection.shrink', () => {
            return this.shrinkSelection();
        }));
    }
    /**
     * Expand selection to next logical unit
     */
    async expandSelection() {
        const editor = vscode.window.activeTextEditor;
        if (!editor)
            return;
        const selection = editor.selection;
        const document = editor.document;
        const position = selection.isEmpty ? selection.active : selection.anchor;
        // Get possible selections
        const selections = await this.getSelectionRanges(document, position);
        if (selections.length === 0)
            return;
        // Find current selection and move to next
        const currentRange = new vscode.Range(selection.isEmpty ? position : selection.start, selection.isEmpty ? position : selection.end);
        let nextSelection = selections[0];
        for (const sel of selections) {
            if (sel.range.start.isAfterOrEqual(currentRange.start) &&
                sel.range.end.isAfter(currentRange.end)) {
                nextSelection = sel;
                break;
            }
            if (sel.range.contains(currentRange)) {
                nextSelection = sel;
            }
        }
        editor.selection = new vscode.Selection(nextSelection.range.start, nextSelection.range.end);
    }
    /**
     * Get all possible selection ranges at a position
     */
    async getSelectionRanges(document, position) {
        const selections = [];
        const languageId = document.languageId;
        // Get document symbols
        try {
            const symbols = await vscode.commands.executeCommand('vscode.executeDocumentSymbolProvider', document.uri);
            if (symbols) {
                for (const symbol of symbols) {
                    if (symbol.range.contains(position)) {
                        const type = this.getSymbolType(symbol.kind);
                        selections.push({
                            range: symbol.range,
                            type,
                            score: this.getTypeScore(type),
                        });
                    }
                }
            }
        }
        catch (error) {
            console.log('Error getting document symbols:', error);
        }
        // Add line-based selections
        const line = document.lineAt(position.line);
        selections.push({
            range: line.range,
            type: 'statement',
            score: 10,
        });
        // Add word selection
        const wordRange = document.getWordRangeAtPosition(position);
        if (wordRange) {
            selections.push({
                range: wordRange,
                type: 'string',
                score: 5,
            });
        }
        // Try to get enclosing blocks
        const enclosingBlocks = await this.getEnclosingBlocks(document, position);
        selections.push(...enclosingBlocks);
        // Sort by score (higher = bigger selection)
        selections.sort((a, b) => b.score - a.score);
        return selections;
    }
    /**
     * Get symbol kind as selection type
     */
    getSymbolType(kind) {
        switch (kind) {
            case vscode.SymbolKind.Class:
                return 'class';
            case vscode.SymbolKind.Function:
            case vscode.SymbolKind.Method:
                return 'function';
            case vscode.SymbolKind.Module:
            case vscode.SymbolKind.Namespace:
            case vscode.SymbolKind.Package:
                return 'import';
            default:
                return 'block';
        }
    }
    /**
     * Get score for selection type
     */
    getTypeScore(type) {
        const scores = {
            'class': 100,
            'function': 80,
            'block': 60,
            'jsx': 50,
            'import': 40,
            'statement': 30,
            'comment': 20,
            'string': 10,
        };
        return scores[type] || 0;
    }
    /**
     * Get enclosing blocks at position
     */
    async getEnclosingBlocks(document, position) {
        const blocks = [];
        // Simple bracket-based block detection
        const line = document.lineAt(position.line);
        const text = line.text;
        // Check for braces on current line
        const openBrace = text.indexOf('{');
        const closeBrace = text.indexOf('}');
        if (openBrace !== -1 && openBrace < position.character) {
            // Find matching close brace
            const match = await this.findMatchingBrace(document, position, '{', '}');
            if (match) {
                blocks.push({
                    range: new vscode.Range(new vscode.Position(position.line, openBrace), match),
                    type: 'block',
                    score: 70,
                });
            }
        }
        // Check for parentheses
        const openParen = text.indexOf('(');
        const closeParen = text.indexOf(')');
        if (openParen !== -1 && openParen < position.character) {
            const match = await this.findMatchingBrace(document, position, '(', ')');
            if (match) {
                blocks.push({
                    range: new vscode.Range(new vscode.Position(position.line, openParen), match),
                    type: 'block',
                    score: 65,
                });
            }
        }
        // Check for brackets
        const openBracket = text.indexOf('[');
        const closeBracket = text.indexOf(']');
        if (openBracket !== -1 && openBracket < position.character) {
            const match = await this.findMatchingBrace(document, position, '[', ']');
            if (match) {
                blocks.push({
                    range: new vscode.Range(new vscode.Position(position.line, openBracket), match),
                    type: 'block',
                    score: 65,
                });
            }
        }
        return blocks;
    }
    /**
     * Find matching brace
     */
    async findMatchingBrace(document, position, open, close) {
        let balance = 0;
        let startLine = position.line;
        // Look backwards for opening brace
        for (let i = position.line; i >= 0; i--) {
            const line = document.lineAt(i).text;
            for (let j = line.length - 1; j >= 0; j--) {
                if (line[j] === close)
                    balance--;
                if (line[j] === open) {
                    balance++;
                    if (balance === 1 && i >= startLine) {
                        // Now find closing
                        for (let k = i; k < document.lineCount; k++) {
                            const closeLine = document.lineAt(k).text;
                            for (let l = 0; l < closeLine.length; l++) {
                                if (closeLine[l] === open)
                                    balance++;
                                if (closeLine[l] === close) {
                                    balance--;
                                    if (balance === 0) {
                                        return new vscode.Position(k, l);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        return null;
    }
    /**
     * Select current block
     */
    async selectBlock() {
        const editor = vscode.window.activeTextEditor;
        if (!editor)
            return;
        const position = editor.selection.active;
        const document = editor.document;
        const blocks = await this.getEnclosingBlocks(document, position);
        if (blocks.length > 0) {
            const block = blocks[0];
            editor.selection = new vscode.Selection(block.range.start, block.range.end);
        }
    }
    /**
     * Select current function
     */
    async selectFunction() {
        const editor = vscode.window.activeTextEditor;
        if (!editor)
            return;
        const position = editor.selection.active;
        const document = editor.document;
        try {
            const symbols = await vscode.commands.executeCommand('vscode.executeDocumentSymbolProvider', document.uri);
            if (symbols) {
                for (const symbol of symbols) {
                    if (symbol.kind === vscode.SymbolKind.Function ||
                        symbol.kind === vscode.SymbolKind.Method) {
                        if (symbol.range.contains(position)) {
                            editor.selection = new vscode.Selection(symbol.range.start, symbol.range.end);
                            return;
                        }
                    }
                }
            }
        }
        catch (error) {
            console.log('Error selecting function:', error);
        }
        vscode.window.showInformationMessage('No function found at cursor');
    }
    /**
     * Select current class
     */
    async selectClass() {
        const editor = vscode.window.activeTextEditor;
        if (!editor)
            return;
        const position = editor.selection.active;
        const document = editor.document;
        try {
            const symbols = await vscode.commands.executeCommand('vscode.executeDocumentSymbolProvider', document.uri);
            if (symbols) {
                for (const symbol of symbols) {
                    if (symbol.kind === vscode.SymbolKind.Class) {
                        if (symbol.range.contains(position)) {
                            editor.selection = new vscode.Selection(symbol.range.start, symbol.range.end);
                            return;
                        }
                    }
                }
            }
        }
        catch (error) {
            console.log('Error selecting class:', error);
        }
        vscode.window.showInformationMessage('No class found at cursor');
    }
    /**
     * Select all similar code
     */
    async selectSimilar() {
        const editor = vscode.window.activeTextEditor;
        if (!editor)
            return;
        const selection = editor.selection;
        if (selection.isEmpty) {
            vscode.window.showInformationMessage('Select some code first');
            return;
        }
        const document = editor.document;
        const selectedText = document.getText(selection);
        // Find all occurrences
        const matches = [];
        const text = document.getText();
        // Simple text search (could be enhanced with AST)
        let searchStart = 0;
        while (true) {
            const index = text.indexOf(selectedText, searchStart);
            if (index === -1)
                break;
            const startPos = document.positionAt(index);
            const endPos = document.positionAt(index + selectedText.length);
            if (!startPos.isEqual(selection.start) || !endPos.isEqual(selection.end)) {
                matches.push(new vscode.Selection(startPos, endPos));
            }
            searchStart = index + 1;
        }
        if (matches.length > 0) {
            // Add current selection to matches
            matches.unshift(selection);
            editor.selections = matches;
            vscode.window.showInformationMessage(`Found ${matches.length} occurrences`);
        }
        else {
            vscode.window.showInformationMessage('No similar code found');
        }
    }
    /**
     * Select related code
     */
    async selectRelated() {
        const editor = vscode.window.activeTextEditor;
        if (!editor)
            return;
        const position = editor.selection.active;
        const document = editor.document;
        // Get word at position
        const wordRange = document.getWordRangeAtPosition(position);
        if (!wordRange) {
            vscode.window.showInformationMessage('No word at cursor');
            return;
        }
        const word = document.getText(wordRange);
        // Find all references
        try {
            const references = await vscode.commands.executeCommand('vscode.executeReferenceProvider', document.uri, position);
            if (references && references.length > 0) {
                const selections = references.map(ref => new vscode.Selection(ref.range.start, ref.range.end));
                editor.selections = selections;
                vscode.window.showInformationMessage(`Selected ${selections.length} references`);
            }
            else {
                vscode.window.showInformationMessage('No references found');
            }
        }
        catch (error) {
            console.log('Error selecting related:', error);
            vscode.window.showInformationMessage('Could not find related code');
        }
    }
    /**
     * Select all imports
     */
    async selectImports() {
        const editor = vscode.window.activeTextEditor;
        if (!editor)
            return;
        const document = editor.document;
        const text = document.getText();
        const selections = [];
        // Parse import statements
        const lines = text.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            // Match various import patterns
            if (line.match(/^import\s+/) ||
                line.match(/^from\s+.*\s+import/) ||
                line.match(/^const\s+.*\s+=\s+require\(/) ||
                line.match(/^require\(/) ||
                line.match(/^use\s+[a-zA-Z_]/)) {
                const startPos = new vscode.Position(i, 0);
                const endPos = new vscode.Position(i, lines[i].length);
                selections.push(new vscode.Selection(startPos, endPos));
            }
        }
        if (selections.length > 0) {
            editor.selections = selections;
            vscode.window.showInformationMessage(`Selected ${selections.length} import(s)`);
        }
        else {
            vscode.window.showInformationMessage('No imports found');
        }
    }
    /**
     * Shrink selection to smaller unit
     */
    async shrinkSelection() {
        const editor = vscode.window.activeTextEditor;
        if (!editor)
            return;
        const selection = editor.selection;
        if (selection.isEmpty) {
            // If no selection, select word
            const position = selection.active;
            const document = editor.document;
            const wordRange = document.getWordRangeAtPosition(position);
            if (wordRange) {
                editor.selection = new vscode.Selection(wordRange.start, wordRange.end);
            }
            return;
        }
        // Get smaller selections
        const document = editor.document;
        const position = selection.start;
        const selections = await this.getSelectionRanges(document, position);
        // Find current selection and get smaller one
        for (let i = selections.length - 1; i >= 0; i--) {
            const sel = selections[i];
            if (sel.range.contains(selection) &&
                (sel.range.start.isBefore(selection.start) ||
                    sel.range.end.isAfter(selection.end))) {
                editor.selection = new vscode.Selection(sel.range.start, sel.range.end);
                return;
            }
        }
        // Default to word selection
        const wordRange = document.getWordRangeAtPosition(position);
        if (wordRange) {
            editor.selection = new vscode.Selection(wordRange.start, wordRange.end);
        }
    }
}
exports.MorseSelectionProvider = MorseSelectionProvider;
//# sourceMappingURL=MorseSelectionProvider.js.map