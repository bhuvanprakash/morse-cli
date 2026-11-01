"use strict";
/**
 * Diff provider for showing code changes
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
exports.DiffProvider = void 0;
const vscode = __importStar(require("vscode"));
const HunkDecorator_1 = require("./HunkDecorator");
class DiffProvider {
    client;
    decorator;
    constructor(client) {
        this.client = client;
        this.decorator = new HunkDecorator_1.HunkDecorator();
    }
    /**
     * Show diff view for code changes
     */
    async showDiff(document, range, original, modified, diff, explanation) {
        // Create a virtual document for the diff
        const uri = document.uri.with({
            scheme: 'morse-diff',
            query: Buffer.from(JSON.stringify({
                original,
                modified,
                diff,
                explanation,
                filePath: document.fileName,
            })).toString('base64'),
        });
        // Register content provider if not already registered
        const provider = new DiffContentProvider();
        vscode.workspace.registerTextDocumentContentProvider('morse-diff', provider);
        // Show diff in compare view
        await vscode.commands.executeCommand('vscode.diff', document.uri, uri, `Morse: ${explanation.substring(0, 50)}...`, { preview: false });
        // Apply inline decorations
        this.decorator.applyDecorations(document, range, diff);
        // Show apply/reject buttons
        const action = await vscode.window.showInformationMessage(explanation, 'Apply Changes', 'Reject', 'Copy to Clipboard');
        if (action === 'Apply Changes') {
            await this.applyChanges(document, range, modified);
            vscode.window.showInformationMessage('Changes applied');
        }
        else if (action === 'Copy to Clipboard') {
            await vscode.env.clipboard.writeText(modified);
            vscode.window.showInformationMessage('Modified code copied to clipboard');
        }
        // Clear decorations
        this.decorator.clearDecorations();
    }
    /**
     * Apply changes to the document
     */
    async applyChanges(document, range, newText) {
        const editor = await vscode.window.showTextDocument(document);
        await editor.edit(editBuilder => {
            editBuilder.replace(range, newText);
        });
    }
    dispose() {
        this.decorator.dispose();
    }
}
exports.DiffProvider = DiffProvider;
/**
 * Content provider for diff virtual documents
 */
class DiffContentProvider {
    onDidChange;
    provideTextDocumentContent(uri) {
        try {
            const data = JSON.parse(Buffer.from(uri.query, 'base64').toString());
            return data.modified;
        }
        catch {
            return '';
        }
    }
}
//# sourceMappingURL=DiffProvider.js.map