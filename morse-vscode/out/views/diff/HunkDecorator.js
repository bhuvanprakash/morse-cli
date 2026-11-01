"use strict";
/**
 * Decorator for diff hunks in the editor
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
exports.HunkDecorator = void 0;
const vscode = __importStar(require("vscode"));
class HunkDecorator {
    addedDecorationType;
    removedDecorationType;
    gutterDecorationType;
    constructor() {
        // Green background for added lines
        this.addedDecorationType = vscode.window.createTextEditorDecorationType({
            backgroundColor: 'rgba(35, 197, 94, 0.2)',
            borderRadius: '2px',
            overviewRulerColor: 'rgba(35, 197, 94, 0.5)',
            overviewRulerLane: vscode.OverviewRulerLane.Full,
        });
        // Red background for removed lines
        this.removedDecorationType = vscode.window.createTextEditorDecorationType({
            backgroundColor: 'rgba(239, 68, 68, 0.2)',
            borderRadius: '2px',
            overviewRulerColor: 'rgba(239, 68, 68, 0.5)',
            overviewRulerLane: vscode.OverviewRulerLane.Full,
            textDecoration: 'line-through',
        });
        // Gutter indicators
        this.gutterDecorationType = vscode.window.createTextEditorDecorationType({
            gutterIconPath: undefined,
            gutterIconSize: 'contain',
        });
    }
    /**
     * Apply decorations for diff hunks
     */
    applyDecorations(document, range, diff) {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }
        const addedRanges = [];
        const removedRanges = [];
        // Calculate offset from range start
        const startLine = range.start.line;
        for (const hunk of diff) {
            if (!hunk.lines)
                continue;
            for (const line of hunk.lines) {
                const lineNumber = startLine + line.lineNumber;
                const lineRange = new vscode.Range(new vscode.Position(lineNumber, 0), new vscode.Position(lineNumber, document.lineAt(lineNumber).text.length));
                if (line.type === 'added') {
                    addedRanges.push(lineRange);
                }
                else if (line.type === 'removed') {
                    removedRanges.push(lineRange);
                }
            }
        }
        editor.setDecorations(this.addedDecorationType, addedRanges);
        editor.setDecorations(this.removedDecorationType, removedRanges);
    }
    /**
     * Clear all decorations
     */
    clearDecorations() {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            editor.setDecorations(this.addedDecorationType, []);
            editor.setDecorations(this.removedDecorationType, []);
            editor.setDecorations(this.gutterDecorationType, []);
        }
    }
    /**
     * Dispose decoration types
     */
    dispose() {
        this.addedDecorationType.dispose();
        this.removedDecorationType.dispose();
        this.gutterDecorationType.dispose();
    }
}
exports.HunkDecorator = HunkDecorator;
//# sourceMappingURL=HunkDecorator.js.map