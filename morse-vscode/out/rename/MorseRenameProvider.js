"use strict";
/**
 * Rename Provider for Morse - AI-powered renaming with preview
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
exports.MorseRenameProvider = void 0;
const vscode = __importStar(require("vscode"));
class MorseRenameProvider {
    client = null;
    renamePreviews = new Map();
    constructor(client) {
        this.client = client || null;
    }
    /**
     * Set the Morse client for AI-powered renaming
     */
    setClient(client) {
        this.client = client;
    }
    /**
     * Provide rename items for a symbol
     */
    async provideRenameEdits(document, position, newName, token) {
        // Get the symbol at the current position
        const symbolInfo = await this.getSymbolAtPosition(document, position);
        if (!symbolInfo) {
            return null;
        }
        const { name, range, references } = symbolInfo;
        // Create workspace edit for all references
        const edit = new vscode.WorkspaceEdit();
        // Add edit for the main declaration
        edit.replace(document.uri, range, newName);
        // Add edits for all references
        for (const ref of references) {
            const refDoc = await vscode.workspace.openTextDocument(ref.uri);
            edit.replace(ref.uri, ref.range, newName);
        }
        // Store preview
        this.storeRenamePreview(name, newName, document.uri.fsPath, range);
        return edit;
    }
    /**
     * Resolve rename location for the symbol
     */
    async resolveRenameLocation(document, position, token) {
        const symbolInfo = await this.getSymbolAtPosition(document, position);
        if (!symbolInfo) {
            return null;
        }
        return {
            range: symbolInfo.range,
            text: symbolInfo.name,
        };
    }
    /**
     * Get symbol information at the given position
     */
    async getSymbolAtPosition(document, position) {
        try {
            // Try to get the symbol definition
            const definitions = await vscode.commands.executeCommand('vscode.executeDefinitionProvider', document.uri, position);
            if (!definitions) {
                return null;
            }
            const defList = Array.isArray(definitions) ? definitions : [definitions];
            if (defList.length === 0) {
                return null;
            }
            const definition = defList[0];
            const range = definition instanceof vscode.Location ? definition.range : definition.range;
            const name = document.getText(range);
            // Get all references to this symbol
            const references = await vscode.commands.executeCommand('vscode.executeReferenceProvider', document.uri, position);
            return {
                name,
                range,
                references: references || [],
            };
        }
        catch (error) {
            console.log('Error getting symbol at position:', error);
            return null;
        }
    }
    /**
     * Store rename preview for later retrieval
     */
    storeRenamePreview(oldName, newName, filePath, range) {
        const preview = {
            originalName: oldName,
            newName,
            filePath,
            oldRange: range,
            newText: newName,
        };
        const key = `${filePath}:${range.start.line}:${range.start.character}`;
        const existing = this.renamePreviews.get(key) || [];
        existing.push(preview);
        this.renamePreviews.set(key, existing);
    }
    /**
     * Get rename suggestions from AI
     */
    async getAIRenameSuggestions(document, position, token) {
        if (!this.client) {
            return [];
        }
        try {
            const symbolInfo = await this.getSymbolAtPosition(document, position);
            if (!symbolInfo) {
                return [];
            }
            // Get the context around the symbol
            const range = symbolInfo.range;
            const startLine = Math.max(0, range.start.line - 5);
            const endLine = Math.min(document.lineCount - 1, range.end.line + 5);
            const context = document.getText(new vscode.Range(startLine, 0, endLine, 0));
            // This would call the AI client for suggestions
            // For now, return empty array - actual implementation would use the client
            const suggestions = [];
            return suggestions;
        }
        catch (error) {
            console.log('Error getting AI rename suggestions:', error);
            return [];
        }
    }
    /**
     * Show rename preview
     */
    async showRenamePreview(oldName, newName, filePath) {
        const preview = this.getRenamePreview(oldName, newName, filePath);
        if (!preview || preview.length === 0) {
            vscode.window.showInformationMessage('No changes to preview');
            return;
        }
        // Create a diff view for the preview
        const previewMessage = `Rename ${oldName} → ${newName}\n\nAffected files:\n${preview.map(p => `- ${p.filePath}`).join('\n')}`;
        const choice = await vscode.window.showInformationMessage(previewMessage, 'Apply Rename', 'Cancel');
        if (choice === 'Apply Rename') {
            // Apply the edit
            const edit = new vscode.WorkspaceEdit();
            for (const p of preview) {
                const doc = await vscode.workspace.openTextDocument(p.filePath);
                edit.replace(vscode.Uri.file(p.filePath), p.oldRange, p.newName);
            }
            await vscode.workspace.applyEdit(edit);
        }
        // Clear preview
        this.clearRenamePreview(oldName, newName, filePath);
    }
    /**
     * Get stored rename preview
     */
    getRenamePreview(oldName, newName, filePath) {
        for (const previews of this.renamePreviews.values()) {
            return previews.filter(p => p.originalName === oldName &&
                p.newName === newName &&
                p.filePath === filePath);
        }
        return [];
    }
    /**
     * Clear rename preview
     */
    clearRenamePreview(oldName, newName, filePath) {
        const key = `${filePath}`;
        this.renamePreviews.delete(key);
    }
    /**
     * Register rename commands
     */
    registerCommands(context) {
        // Rename with AI suggestions
        context.subscriptions.push(vscode.commands.registerCommand('morse.aiRename', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No active editor');
                return;
            }
            const position = editor.selection.active;
            const document = editor.document;
            // Get AI suggestions
            const suggestions = await this.getAIRenameSuggestions(document, position, {});
            if (suggestions.length === 0) {
                // Fall back to standard rename
                await vscode.commands.executeCommand('editor.action.rename');
                return;
            }
            // Show suggestion picker
            const items = suggestions.map(s => ({
                label: s.newName,
                description: s.reason,
                detail: `Confidence: ${Math.round(s.confidence * 100)}%`,
            }));
            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: 'Choose a new name or enter custom name',
            });
            if (selected) {
                // Trigger rename with selected name
                const edit = await this.provideRenameEdits(document, position, selected.label, {});
                if (edit) {
                    await vscode.workspace.applyEdit(edit);
                }
            }
        }));
        // Preview rename
        context.subscriptions.push(vscode.commands.registerCommand('morse.previewRename', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No active editor');
                return;
            }
            const position = editor.selection.active;
            const document = editor.document;
            // Get symbol info
            const symbolInfo = await this.getSymbolAtPosition(document, position);
            if (!symbolInfo) {
                vscode.window.showErrorMessage('No symbol at cursor position');
                return;
            }
            // Ask for new name
            const newName = await vscode.window.showInputBox({
                prompt: 'Enter new name',
                value: symbolInfo.name,
                validateInput: (value) => {
                    if (!value || value.trim().length === 0) {
                        return 'Name cannot be empty';
                    }
                    if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(value)) {
                        return 'Invalid identifier';
                    }
                    return null;
                }
            });
            if (!newName || newName === symbolInfo.name) {
                return;
            }
            // Show preview
            await this.showRenamePreview(symbolInfo.name, newName, document.uri.fsPath);
        }));
    }
}
exports.MorseRenameProvider = MorseRenameProvider;
//# sourceMappingURL=MorseRenameProvider.js.map