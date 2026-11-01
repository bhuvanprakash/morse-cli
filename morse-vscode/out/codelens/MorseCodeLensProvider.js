"use strict";
/**
 * CodeLens provider for Morse actions above functions
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
exports.MorseCodeLensProvider = void 0;
const vscode = __importStar(require("vscode"));
class MorseCodeLensProvider {
    _onDidChangeCodeLenses = new vscode.EventEmitter();
    onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;
    constructor() {
        // Refresh when configuration changes
        vscode.workspace.onDidChangeConfiguration((_) => {
            this._onDidChangeCodeLenses.fire();
        });
    }
    provideCodeLenses(document, _token) {
        const codeLenses = [];
        // Find function declarations
        const functionRegex = /^(\s*)(export\s+)?(async\s+)?function\s+(\w+)|^(\s*)(export\s+)?(async\s+)?(\w+)\s*[:=]\s*(async\s*)?\(|^(\s*)(export\s+)?class\s+(\w+)/gm;
        const text = document.getText();
        let match;
        while ((match = functionRegex.exec(text)) !== null) {
            const line = document.positionAt(match.index).line;
            const range = new vscode.Range(line, 0, line, 0);
            // Fix lens
            codeLenses.push(new vscode.CodeLens(range, {
                title: '$(sparkle) Fix',
                tooltip: 'Ask Morse to fix this code',
                command: 'morse.executeCodeLens',
                arguments: ['fix', line],
            }));
            // Edit lens
            codeLenses.push(new vscode.CodeLens(range, {
                title: '$(edit) Edit',
                tooltip: 'Ask Morse to edit this code',
                command: 'morse.executeCodeLens',
                arguments: ['edit', line],
            }));
            // Explain lens
            codeLenses.push(new vscode.CodeLens(range, {
                title: '$(question) Explain',
                tooltip: 'Ask Morse to explain this code',
                command: 'morse.executeCodeLens',
                arguments: ['explain', line],
            }));
            // Test lens
            codeLenses.push(new vscode.CodeLens(range, {
                title: '$(beaker) Test',
                tooltip: 'Ask Morse to generate tests',
                command: 'morse.executeCodeLens',
                arguments: ['generateTests', line],
            }));
        }
        return codeLenses;
    }
    resolveCodeLens(codeLens, _token) {
        return codeLens;
    }
}
exports.MorseCodeLensProvider = MorseCodeLensProvider;
//# sourceMappingURL=MorseCodeLensProvider.js.map