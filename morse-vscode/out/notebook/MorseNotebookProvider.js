"use strict";
/**
 * Notebook Provider for Morse AI interaction
 * Provides notebook cells for AI-powered code execution and interaction
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
exports.MorseNotebookCellExecutor = exports.MorseNotebookProvider = void 0;
exports.registerNotebookProvider = registerNotebookProvider;
const vscode = __importStar(require("vscode"));
class MorseNotebookProvider {
    notebookType = 'morse-notebook';
    constructor() {
        // No client needed for basic serialization
    }
    async serializeNotebook(data, _token) {
        const raw = data.cells.map(cell => {
            const value = typeof cell.value === 'string' ? cell.value : cell.value ?? '';
            if (cell.kind === vscode.NotebookCellKind.Code) {
                return { kind: 'code', source: value, metadata: cell.metadata };
            }
            return { kind: 'markdown', source: value };
        });
        return new TextEncoder().encode(JSON.stringify(raw));
    }
    async deserializeNotebook(content, _token) {
        const cells = [];
        try {
            const data = JSON.parse(new TextDecoder().decode(content));
            for (const cell of data) {
                const src = typeof cell.source === 'string' ? cell.source : String(cell.source?.join?.('\n') ?? '');
                if (cell.kind === 'code') {
                    cells.push(new vscode.NotebookCellData(vscode.NotebookCellKind.Code, src, 'typescript'));
                }
                else {
                    cells.push(new vscode.NotebookCellData(vscode.NotebookCellKind.Markup, src, 'markdown'));
                }
            }
        }
        catch {
            cells.push(new vscode.NotebookCellData(vscode.NotebookCellKind.Code, '', 'typescript'));
        }
        return new vscode.NotebookData(cells);
    }
}
exports.MorseNotebookProvider = MorseNotebookProvider;
class MorseNotebookCellExecutor {
    client;
    outputChannel;
    constructor(client) {
        this.client = client;
        this.outputChannel = vscode.window.createOutputChannel('Morse Notebook');
    }
    async executeCell(cell, _token) {
        const startTime = Date.now();
        // Clear previous output
        this.outputChannel.clear();
        this.outputChannel.show(true);
        const code = cell.document.getText();
        try {
            this.outputChannel.appendLine(`[Executing cell...]`);
            this.outputChannel.appendLine(`Code: ${code.substring(0, 100)}${code.length > 100 ? '...' : ''}`);
            this.outputChannel.appendLine('');
            // Execute via Morse CLI
            const response = await this.executeCodeWithAI(code);
            const outputs = [];
            if (response.result) {
                outputs.push(new vscode.NotebookCellOutput([
                    vscode.NotebookCellOutputItem.text(response.result)
                ]));
            }
            if (response.error) {
                outputs.push(new vscode.NotebookCellOutput([
                    vscode.NotebookCellOutputItem.error(new Error(response.error))
                ]));
                return { executionOrder: undefined, success: false };
            }
            // Append outputs via NotebookEdit if needed; execution summary is set by the API
            return { executionOrder: undefined, success: true };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.outputChannel.appendLine(`Error: ${errorMessage}`);
            return { executionOrder: undefined, success: false };
        }
    }
    async executeCodeWithAI(code) {
        // Use vscode command to interact with Morse chat
        return new Promise((resolve) => {
            // Open a terminal and execute the code using node eval or similar
            const terminal = vscode.window.createTerminal({
                name: 'Morse Notebook',
                hideFromUser: false
            });
            terminal.sendText(`node -e "console.log(eval('${code.replace(/'/g, "\\'")}'))"`);
            terminal.show();
            // For AI-powered execution, we use the chat interface
            resolve({ result: 'Code sent to terminal for execution. Use Morse chat for AI assistance.' });
        });
    }
}
exports.MorseNotebookCellExecutor = MorseNotebookCellExecutor;
function registerNotebookProvider(context, client) {
    const serializer = new MorseNotebookProvider();
    // Register the notebook serializer
    const serializerRegistration = vscode.workspace.registerNotebookSerializer('morse-notebook', serializer, {
        transientOutputs: false,
        transientCellMetadata: {
            notebookMarker: true
        }
    });
    // Register a command to create new Morse notebooks
    const createNotebookCommand = vscode.commands.registerCommand('morse.createNotebook', async () => {
        const document = await vscode.workspace.openNotebookDocument('morse-notebook', new vscode.NotebookData([
            new vscode.NotebookCellData(vscode.NotebookCellKind.Markup, '# Morse AI Notebook\n\nUse code cells to interact with Morse AI.', 'markdown'),
            new vscode.NotebookCellData(vscode.NotebookCellKind.Code, '// Write your code here\n', 'typescript')
        ]));
        await vscode.window.showNotebookDocument(document);
    });
    // Register command to execute AI-powered code cell
    const executeCellCommand = vscode.commands.registerCommand('morse.executeNotebookCell', async (cell) => {
        const executor = new MorseNotebookCellExecutor(client);
        await executor.executeCell(cell, new vscode.CancellationTokenSource().token);
    });
    // Register command to ask AI about selected code
    const askAICommand = vscode.commands.registerCommand('morse.askAINotebook', async (cell) => {
        const code = cell.document.getText();
        const selection = vscode.window.activeTextEditor?.selection;
        let prompt = code;
        if (selection && !selection.isEmpty) {
            prompt = vscode.window.activeTextEditor?.document.getText(selection) || code;
        }
        // Send to chat panel
        vscode.commands.executeCommand('morse.chat', prompt);
    });
    context.subscriptions.push(serializerRegistration, createNotebookCommand, executeCellCommand, askAICommand);
    return {
        dispose: () => {
            serializerRegistration.dispose();
            createNotebookCommand.dispose();
            executeCellCommand.dispose();
            askAICommand.dispose();
        }
    };
}
//# sourceMappingURL=MorseNotebookProvider.js.map