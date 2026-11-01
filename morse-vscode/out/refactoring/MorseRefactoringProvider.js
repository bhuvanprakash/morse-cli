"use strict";
/**
 * Morse Refactoring Provider
 * AI-powered code refactoring support including extract method,
 * inline variable, and rename refactoring
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
exports.MorseRefactoringProvider = void 0;
exports.registerRefactoringProvider = registerRefactoringProvider;
const vscode = __importStar(require("vscode"));
class MorseRefactoringProvider {
    // CodeActionProvider is the legacy name; we use registerCodeActionsProvider which accepts it
    client;
    constructor(client) {
        this.client = client;
    }
    /**
     * Provide code actions for refactoring
     */
    provideCodeActions(document, range, context) {
        const actions = [];
        // Only provide refactoring when there's a selection
        if (range.isEmpty) {
            return actions;
        }
        const selectedText = document.getText(range);
        if (!selectedText.trim()) {
            return actions;
        }
        // Extract Method action
        const extractMethodAction = this.createExtractMethodAction(document, range, selectedText);
        actions.push(extractMethodAction);
        // Inline Variable action
        const inlineVariableAction = this.createInlineVariableAction(document, range, selectedText);
        actions.push(inlineVariableAction);
        // Rename action (using VS Code's built-in rename)
        const renameAction = this.createRenameAction(document, range);
        actions.push(renameAction);
        return actions;
    }
    /**
     * Create Extract Method action
     */
    createExtractMethodAction(document, range, selectedText) {
        const action = new vscode.CodeAction('Extract to Method', vscode.CodeActionKind.RefactorExtract);
        action.command = {
            command: 'morse.refactoring.extractMethod',
            title: 'Extract to Method',
            arguments: [document, range]
        };
        action.isPreferred = true;
        return action;
    }
    /**
     * Create Inline Variable action
     */
    createInlineVariableAction(document, range, selectedText) {
        const action = new vscode.CodeAction('Inline Variable', vscode.CodeActionKind.RefactorInline);
        action.command = {
            command: 'morse.refactoring.inlineVariable',
            title: 'Inline Variable',
            arguments: [document, range]
        };
        return action;
    }
    /**
     * Create Rename action
     */
    createRenameAction(document, range) {
        const action = new vscode.CodeAction('Rename Symbol', vscode.CodeActionKind.RefactorRewrite);
        action.command = {
            command: 'morse.refactoring.rename',
            title: 'Rename Symbol',
            arguments: [document, range]
        };
        return action;
    }
    /**
     * Extract method from selected code
     */
    async extractMethod(document, range) {
        const selectedText = document.getText(range);
        // Ask user for method name
        const methodName = await vscode.window.showInputBox({
            title: 'Method Name',
            placeHolder: 'Enter method name',
            validateInput: (value) => {
                if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) {
                    return 'Invalid method name';
                }
                return null;
            }
        });
        if (!methodName) {
            return undefined;
        }
        // Determine return type and parameters (simple heuristic)
        const hasReturn = selectedText.includes('return ');
        const hasConsole = selectedText.includes('console.');
        let methodSignature = `function ${methodName}()`;
        if (hasReturn && !hasConsole) {
            methodSignature = `function ${methodName}()`;
        }
        // Create the refactored code
        const indentation = this.getIndentation(document, range.start.line);
        const refactoredCode = `
${indentation}function ${methodName}() {
${indentation}    ${selectedText.replace(/\n/g, `\n${indentation}    `)}
${indentation}}

${indentation}${methodName}();
`;
        // Replace the selected code with the new method
        const edit = new vscode.WorkspaceEdit();
        edit.replace(document.uri, range, refactoredCode);
        await vscode.workspace.applyEdit(edit);
        return methodName;
    }
    /**
     * Inline a variable
     */
    async inlineVariable(document, range) {
        const selectedText = document.getText(range);
        // Find variable declaration in the current line
        const line = document.lineAt(range.start.line);
        const lineText = line.text;
        // Simple pattern matching for variable declarations
        const varMatch = lineText.match(/(?:const|let|var)\s+(\w+)\s*=\s*(.+?);/);
        if (!varMatch) {
            vscode.window.showWarningMessage('No variable declaration found on this line');
            return false;
        }
        const [, varName, varValue] = varMatch;
        // Check if the selected text is the variable name
        if (selectedText.trim() !== varName) {
            vscode.window.showWarningMessage('Select the variable name to inline');
            return false;
        }
        // Find all occurrences of the variable and replace with value
        const fullText = document.getText();
        const variableRegex = new RegExp(`\\b${varName}\\b`, 'g');
        let count = 0;
        const fullTextReplaced = fullText.replace(variableRegex, () => {
            count++;
            return varValue.trim();
        });
        // Replace the entire document
        const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(fullText.length));
        const edit = new vscode.WorkspaceEdit();
        edit.replace(document.uri, fullRange, fullTextReplaced);
        await vscode.workspace.applyEdit(edit);
        vscode.window.showInformationMessage(`Inlined ${count} occurrences of ${varName}`);
        return true;
    }
    /**
     * Rename a symbol
     */
    async renameSymbol(document, range) {
        const selectedText = document.getText(range).trim();
        if (!selectedText) {
            vscode.window.showWarningMessage('Select a symbol to rename');
            return undefined;
        }
        // Trigger VS Code's built-in rename
        await vscode.commands.executeCommand('editor.action.rename', [
            document.uri,
            range.start
        ]);
        return undefined;
    }
    /**
     * Get indentation for a specific line
     */
    getIndentation(document, line) {
        const lineText = document.lineAt(line).text;
        const match = lineText.match(/^(\s*)/);
        return match ? match[1] : '';
    }
    /**
     * AI-powered refactoring suggestions
     */
    async getAIRefactoringSuggestions(document, range) {
        const selectedText = document.getText(range);
        try {
            const response = await this.client.generate({
                messages: [{ role: 'user', content: `Analyze this code and suggest refactoring improvements:\n\n${selectedText}\n\nProvide 3 specific refactoring suggestions.` }]
            });
            const content = typeof response === 'string' ? response : (response?.content ?? '');
            return content.split('\n').filter((line) => line.trim());
        }
        catch (error) {
            console.error('Failed to get AI refactoring suggestions:', error);
            return [];
        }
    }
}
exports.MorseRefactoringProvider = MorseRefactoringProvider;
/**
 * Register the refactoring provider
 */
function registerRefactoringProvider(context, client) {
    const provider = new MorseRefactoringProvider(client);
    // Register code action provider
    const registration = vscode.languages.registerCodeActionsProvider({ scheme: 'file', pattern: '**/*.{ts,js,tsx,jsx,py,go,rs,java,c,cpp}' }, provider, {
        providedCodeActionKinds: [
            vscode.CodeActionKind.RefactorExtract,
            vscode.CodeActionKind.RefactorInline,
            vscode.CodeActionKind.RefactorRewrite
        ]
    });
    // Register Extract Method command
    const extractMethodCommand = vscode.commands.registerCommand('morse.refactoring.extractMethod', async (document, range) => {
        await provider.extractMethod(document, range);
    });
    // Register Inline Variable command
    const inlineVariableCommand = vscode.commands.registerCommand('morse.refactoring.inlineVariable', async (document, range) => {
        await provider.inlineVariable(document, range);
    });
    // Register Rename command
    const renameCommand = vscode.commands.registerCommand('morse.refactoring.rename', async (document, range) => {
        await provider.renameSymbol(document, range);
    });
    // Register AI Refactoring command
    const aiRefactorCommand = vscode.commands.registerCommand('morse.refactoring.aiRefactor', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('No active editor');
            return;
        }
        const selection = editor.selection;
        const document = editor.document;
        const suggestions = await provider.getAIRefactoringSuggestions(document, selection);
        if (suggestions.length === 0) {
            vscode.window.showInformationMessage('No AI suggestions available');
            return;
        }
        const selected = await vscode.window.showQuickPick(suggestions, {
            title: 'AI Refactoring Suggestions',
            placeHolder: 'Select a suggestion'
        });
        if (selected) {
            vscode.window.showInformationMessage(`Applying: ${selected}`);
        }
    });
    context.subscriptions.push(registration, extractMethodCommand, inlineVariableCommand, renameCommand, aiRefactorCommand);
    return {
        dispose: () => {
            registration.dispose();
            extractMethodCommand.dispose();
            inlineVariableCommand.dispose();
            renameCommand.dispose();
            aiRefactorCommand.dispose();
        }
    };
}
//# sourceMappingURL=MorseRefactoringProvider.js.map