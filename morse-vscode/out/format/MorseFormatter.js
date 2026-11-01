"use strict";
/**
 * Morse Formatter
 * Code formatter with format on save and format selection support
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
exports.FormatSelectionHandler = exports.FormatOnSaveHandler = exports.MorseFormatter = exports.DEFAULT_FORMATTER_OPTIONS = void 0;
exports.registerFormatter = registerFormatter;
const vscode = __importStar(require("vscode"));
exports.DEFAULT_FORMATTER_OPTIONS = {
    indentSize: 4,
    useTabs: false,
    semicolons: true,
    quotes: 'single',
    trailingComma: true,
    maxLineLength: 100
};
class MorseFormatter {
    client;
    options;
    constructor(client, options) {
        this.client = client;
        this.options = { ...exports.DEFAULT_FORMATTER_OPTIONS, ...options };
    }
    /**
     * Provide formatting edits for the entire document
     */
    provideDocumentFormattingEdits(document, options, token) {
        const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length));
        return this.formatDocument(document, fullRange, options, token);
    }
    /**
     * Provide formatting edits for a selected range
     */
    provideDocumentRangeFormattingEdits(document, range, options, token) {
        return this.formatDocument(document, range, options, token);
    }
    /**
     * Provide formatting edits on type (e.g., after pressing Enter)
     */
    provideOnTypeFormattingEdits(document, position, ch, options, token) {
        // Only format after specific characters
        if (ch !== '\n' && ch !== '}' && ch !== ';') {
            return [];
        }
        const line = document.lineAt(position.line);
        const range = new vscode.Range(new vscode.Position(position.line, 0), line.range.end);
        return this.formatDocument(document, range, options, token);
    }
    /**
     * Format the document or range
     */
    async formatDocument(document, range, options, token) {
        const text = document.getText(range);
        // Check if we should use AI formatting
        const config = vscode.workspace.getConfiguration('morse.format');
        const useAIFormat = config.get('useAIFormatting', false);
        if (useAIFormat) {
            return this.formatWithAI(document, range, token);
        }
        // Use built-in formatting
        return this.formatWithBuiltIn(document, range, options);
    }
    /**
     * Format using built-in VS Code formatting
     */
    formatWithBuiltIn(document, range, options) {
        const text = document.getText(range);
        const formattedText = this.applyBasicFormatting(text, options);
        return [vscode.TextEdit.replace(range, formattedText)];
    }
    /**
     * Format using AI
     */
    async formatWithAI(document, range, token) {
        const text = document.getText(range);
        const fileName = document.fileName;
        try {
            // Check for cancellation
            if (token.isCancellationRequested) {
                return [];
            }
            // Use the client to format (simplified - actual implementation would call the API)
            const formattedText = await this.client.requestCompletion(`Format this ${this.getLanguage(document.uri)} code:\n\n${text}`, token);
            if (formattedText && formattedText.trim()) {
                return [vscode.TextEdit.replace(range, formattedText)];
            }
        }
        catch (error) {
            console.error('AI formatting failed:', error);
            // Fall back to built-in formatting
            return this.formatWithBuiltIn(document, range, {
                tabSize: this.options.indentSize,
                insertSpaces: !this.options.useTabs
            });
        }
        return [];
    }
    /**
     * Apply basic formatting to text
     */
    applyBasicFormatting(text, options) {
        const lines = text.split('\n');
        const indent = options.insertSpaces ? ' '.repeat(options.tabSize) : '\t';
        let currentIndent = '';
        const result = [];
        for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) {
                result.push('');
                continue;
            }
            // Decrease indent for closing braces
            if (trimmedLine.startsWith('}') || trimmedLine.startsWith(']') || trimmedLine.startsWith(')')) {
                currentIndent = currentIndent.slice(indent.length);
            }
            // Add the formatted line
            if (trimmedLine) {
                result.push(currentIndent + this.processLine(trimmedLine, options));
            }
            // Increase indent for opening braces
            if (trimmedLine.endsWith('{') || trimmedLine.startsWith('[') || trimmedLine.startsWith('(')) {
                currentIndent += indent;
            }
        }
        return result.join('\n');
    }
    /**
     * Process a single line of code
     */
    processLine(line, options) {
        let processed = line;
        // Handle quotes
        if (options.insertSpaces === undefined || options.insertSpaces) {
            // Already handled by indentation
        }
        // Add trailing comma if needed
        if (this.options.trailingComma &&
            (line.includes('function') || line.includes('=>') || line.includes('['))) {
            if (!line.endsWith(',') && !line.endsWith('{') && !line.endsWith('}')) {
                // Simple heuristic - don't add to everything
            }
        }
        return processed;
    }
    /**
     * Get the language for a document
     */
    getLanguage(uri) {
        const ext = uri.fsPath.split('.').pop()?.toLowerCase();
        const languageMap = {
            'ts': 'TypeScript',
            'tsx': 'TypeScript',
            'js': 'JavaScript',
            'jsx': 'JavaScript',
            'py': 'Python',
            'go': 'Go',
            'rs': 'Rust',
            'java': 'Java',
            'c': 'C',
            'cpp': 'C++',
            'cs': 'C#'
        };
        return languageMap[ext || ''] || 'code';
    }
    /**
     * Update formatter options
     */
    setOptions(options) {
        this.options = { ...this.options, ...options };
    }
    /**
     * Get current formatter options
     */
    getOptions() {
        return { ...this.options };
    }
}
exports.MorseFormatter = MorseFormatter;
/**
 * Format on save handler
 */
class FormatOnSaveHandler {
    formatter;
    enabledLanguages;
    constructor(formatter) {
        this.formatter = formatter;
        this.enabledLanguages = ['typescript', 'javascript', 'python', 'go', 'rust', 'java'];
    }
    /**
     * Handle format on save
     */
    async handleSave(document) {
        const config = vscode.workspace.getConfiguration('morse.format');
        const enableFormatOnSave = config.get('enableFormatOnSave', true);
        if (!enableFormatOnSave) {
            return false;
        }
        // Check if the language is supported
        const languageId = document.languageId;
        if (!this.enabledLanguages.includes(languageId)) {
            return false;
        }
        // Get formatting options from active editor or defaults
        const editor = vscode.window.activeTextEditor;
        const formattingOptions = editor ? { tabSize: editor.options.tabSize ?? 4, insertSpaces: editor.options.insertSpaces ?? true } : { tabSize: 4, insertSpaces: true };
        // Format the document
        const edits = await vscode.commands.executeCommand('vscode.executeDocumentFormattingProvider', document.uri, formattingOptions);
        if (edits && edits.length > 0) {
            const workspaceEdit = new vscode.WorkspaceEdit();
            workspaceEdit.set(document.uri, edits);
            await vscode.workspace.applyEdit(workspaceEdit);
            return true;
        }
        return false;
    }
    /**
     * Add a language to the enabled list
     */
    addLanguage(language) {
        if (!this.enabledLanguages.includes(language)) {
            this.enabledLanguages.push(language);
        }
    }
    /**
     * Remove a language from the enabled list
     */
    removeLanguage(language) {
        const index = this.enabledLanguages.indexOf(language);
        if (index !== -1) {
            this.enabledLanguages.splice(index, 1);
        }
    }
}
exports.FormatOnSaveHandler = FormatOnSaveHandler;
/**
 * Format selection handler
 */
class FormatSelectionHandler {
    /**
     * Format the current selection
     */
    async formatSelection() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('No active editor');
            return false;
        }
        const selection = editor.selection;
        if (selection.isEmpty) {
            vscode.window.showWarningMessage('No selection to format');
            return false;
        }
        const document = editor.document;
        const formattingOptions = await editor.options;
        // Execute range formatting
        const edits = await vscode.commands.executeCommand('vscode.executeDocumentRangeFormattingProvider', document.uri, selection, formattingOptions);
        if (edits && edits.length > 0) {
            const workspaceEdit = new vscode.WorkspaceEdit();
            workspaceEdit.set(document.uri, edits);
            await vscode.workspace.applyEdit(workspaceEdit);
            return true;
        }
        vscode.window.showInformationMessage('No formatting changes needed');
        return false;
    }
}
exports.FormatSelectionHandler = FormatSelectionHandler;
/**
 * Register the formatter
 */
function registerFormatter(context, client) {
    const config = vscode.workspace.getConfiguration('morse.format');
    const formatterOptions = {
        indentSize: config.get('indentSize', 4),
        useTabs: config.get('useTabs', false),
        semicolons: config.get('semicolons', true),
        quotes: config.get('quotes', 'single'),
        trailingComma: config.get('trailingComma', true),
        maxLineLength: config.get('maxLineLength', 100)
    };
    const formatter = new MorseFormatter(client, formatterOptions);
    const formatOnSaveHandler = new FormatOnSaveHandler(formatter);
    const formatSelectionHandler = new FormatSelectionHandler();
    // Register document formatting provider
    const documentRegistration = vscode.languages.registerDocumentFormattingEditProvider({ scheme: 'file', pattern: '**/*.{ts,js,tsx,jsx,py,go,rs,java,c,cpp}' }, formatter);
    // Register range formatting provider
    const rangeRegistration = vscode.languages.registerDocumentRangeFormattingEditProvider({ scheme: 'file', pattern: '**/*.{ts,js,tsx,jsx,py,go,rs,java,c,cpp}' }, formatter);
    // Register on-type formatting provider
    const onTypeRegistration = vscode.languages.registerOnTypeFormattingEditProvider({ scheme: 'file', pattern: '**/*.{ts,js,tsx,jsx,py,go,rs,java,c,cpp}' }, formatter, '\n', '}', ';');
    // Register format on save
    const saveSubscription = vscode.workspace.onWillSaveTextDocument(async (event) => {
        await formatOnSaveHandler.handleSave(event.document);
    });
    // Register format selection command
    const formatSelectionCommand = vscode.commands.registerCommand('morse.formatSelection', async () => {
        await formatSelectionHandler.formatSelection();
    });
    // Register format document command
    const formatDocumentCommand = vscode.commands.registerCommand('morse.formatDocument', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('No active editor');
            return;
        }
        const document = editor.document;
        const formattingOptions = { tabSize: editor.options.tabSize ?? 4, insertSpaces: editor.options.insertSpaces ?? true };
        const edits = await vscode.commands.executeCommand('vscode.executeDocumentFormattingProvider', document.uri, formattingOptions);
        if (edits && edits.length > 0) {
            const workspaceEdit = new vscode.WorkspaceEdit();
            workspaceEdit.set(document.uri, edits);
            await vscode.workspace.applyEdit(workspaceEdit);
        }
    });
    // Register toggle format on save
    const toggleFormatOnSaveCommand = vscode.commands.registerCommand('morse.toggleFormatOnSave', async () => {
        const config = vscode.workspace.getConfiguration('morse.format');
        const current = config.get('enableFormatOnSave', true);
        await config.update('enableFormatOnSave', !current);
        vscode.window.showInformationMessage(`Format on save ${!current ? 'enabled' : 'disabled'}`);
    });
    context.subscriptions.push(documentRegistration, rangeRegistration, onTypeRegistration, saveSubscription, formatSelectionCommand, formatDocumentCommand, toggleFormatOnSaveCommand);
    return {
        dispose: () => {
            documentRegistration.dispose();
            rangeRegistration.dispose();
            onTypeRegistration.dispose();
            saveSubscription.dispose();
            formatSelectionCommand.dispose();
            formatDocumentCommand.dispose();
            toggleFormatOnSaveCommand.dispose();
        }
    };
}
//# sourceMappingURL=MorseFormatter.js.map