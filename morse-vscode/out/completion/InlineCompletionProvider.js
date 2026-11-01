"use strict";
/**
 * Inline completion provider for // morse: comments
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
exports.InlineCompletionProvider = void 0;
const vscode = __importStar(require("vscode"));
class InlineCompletionProvider {
    client;
    triggerRegex = /\/\/\s*morse:\s*(.+)$/;
    constructor(client) {
        this.client = client;
    }
    async provideInlineCompletionItems(document, position, _context, token) {
        // Check if line ends with // morse: comment
        const line = document.lineAt(position.line);
        const lineText = line.text.substring(0, position.character);
        const match = this.triggerRegex.exec(lineText);
        if (!match) {
            return null;
        }
        const instruction = match[1].trim();
        if (!instruction) {
            return null;
        }
        // Get context (previous lines for context)
        const startLine = Math.max(0, position.line - 20);
        const contextRange = new vscode.Range(startLine, 0, position.line, line.text.length);
        const contextCode = document.getText(contextRange);
        try {
            // Call Morse for completion
            const result = await this.client.edit({
                code: contextCode,
                language: document.languageId,
                instruction: instruction,
                filePath: document.fileName,
            });
            if (token.isCancellationRequested) {
                return null;
            }
            // Extract just the new part (after the context)
            const completionText = this.extractCompletion(result.edited, contextCode);
            return [
                new vscode.InlineCompletionItem(completionText, new vscode.Range(position, position))
            ];
        }
        catch (err) {
            console.error('Inline completion error:', err);
            return null;
        }
    }
    /**
     * Extract the completion part (what comes after the context)
     */
    extractCompletion(edited, context) {
        // Find where the context ends in the edited result
        const contextLines = context.split('\n');
        const editedLines = edited.split('\n');
        // Return lines after the context
        if (editedLines.length > contextLines.length) {
            return editedLines.slice(contextLines.length).join('\n');
        }
        // If same length, return empty
        return '';
    }
}
exports.InlineCompletionProvider = InlineCompletionProvider;
//# sourceMappingURL=InlineCompletionProvider.js.map