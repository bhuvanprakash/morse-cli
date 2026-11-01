"use strict";
/**
 * Workspace Symbol Provider
 * Global symbol search across workspace files
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
exports.MorseWorkspaceSymbolProvider = void 0;
exports.quickSymbolSearch = quickSymbolSearch;
exports.registerWorkspaceSymbolProvider = registerWorkspaceSymbolProvider;
const vscode = __importStar(require("vscode"));
class MorseWorkspaceSymbolProvider {
    symbolsCache = new Map();
    lastUpdate = null;
    updateInterval = 60000; // 1 minute
    maxFiles = 1000;
    supportedExtensions = ['ts', 'js', 'tsx', 'jsx', 'py', 'go', 'rs', 'java', 'c', 'cpp', 'cs', 'vue', 'svelte'];
    /**
     * Provide workspace symbols (global search)
     */
    provideWorkspaceSymbols(query, token) {
        return this.searchSymbols(query, token);
    }
    /**
     * Resolve workspace symbol (get more info)
     */
    resolveWorkspaceSymbol(symbol, token) {
        return symbol;
    }
    /**
     * Search symbols across the workspace
     */
    async searchSymbols(query, token) {
        if (!query || query.length < 2) {
            return [];
        }
        const results = [];
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return results;
        }
        // Build search patterns
        const patterns = this.buildSearchPatterns(workspaceFolders);
        for (const pattern of patterns) {
            if (token.isCancellationRequested) {
                break;
            }
            try {
                const files = await vscode.workspace.findFiles(pattern, '**/node_modules/**', this.maxFiles);
                for (const file of files) {
                    if (token.isCancellationRequested) {
                        break;
                    }
                    const fileSymbols = await this.searchInFile(file, query, token);
                    results.push(...fileSymbols);
                    // Limit results
                    if (results.length >= 100) {
                        break;
                    }
                }
            }
            catch (error) {
                console.error('Error searching files:', error);
            }
        }
        // Sort by relevance score
        results.sort((a, b) => {
            const aScore = a.score || 0;
            const bScore = b.score || 0;
            return bScore - aScore;
        });
        return results.slice(0, 100);
    }
    /**
     * Build search patterns for workspace folders
     */
    buildSearchPatterns(workspaceFolders) {
        const patterns = [];
        for (const folder of workspaceFolders) {
            const extGlob = `**/*.{${this.supportedExtensions.join(',')}}`;
            patterns.push(new vscode.RelativePattern(folder, extGlob));
        }
        return patterns;
    }
    /**
     * Search for symbols in a single file
     */
    async searchInFile(file, query, token) {
        const results = [];
        try {
            const document = await vscode.workspace.openTextDocument(file);
            const text = document.getText();
            const lowerQuery = query.toLowerCase();
            // Search patterns for different symbol types
            const patterns = this.getSearchPatterns(document.languageId);
            for (const pattern of patterns) {
                if (token.isCancellationRequested) {
                    break;
                }
                let match;
                const regex = new RegExp(pattern.regex, 'gm');
                while ((match = regex.exec(text)) !== null) {
                    if (token.isCancellationRequested) {
                        break;
                    }
                    const name = match.groups?.name || match[1];
                    if (!name || !name.toLowerCase().includes(lowerQuery)) {
                        continue;
                    }
                    const position = document.positionAt(match.index);
                    const range = new vscode.Range(position, position);
                    // Calculate relevance score
                    const score = this.calculateScore(name.toLowerCase(), lowerQuery);
                    const symbol = new vscode.SymbolInformation(name, pattern.kind, pattern.container ?? '', new vscode.Location(file, range));
                    // Store score for sorting
                    symbol.score = score;
                    results.push(symbol);
                }
            }
        }
        catch (error) {
            // Skip files that can't be read
        }
        return results;
    }
    /**
     * Get search patterns based on language
     */
    getSearchPatterns(languageId) {
        const patterns = {
            typescript: [
                { regex: '(?:export\\s+)?(?:async\\s+)?function\\s+(?<name>\\w+)', kind: vscode.SymbolKind.Function, container: 'function' },
                { regex: '(?:export\\s+)?class\\s+(?<name>\\w+)', kind: vscode.SymbolKind.Class, container: 'class' },
                { regex: '(?:export\\s+)?interface\\s+(?<name>\\w+)', kind: vscode.SymbolKind.Interface, container: 'interface' },
                { regex: '(?:export\\s+)?type\\s+(?<name>\\w+)', kind: vscode.SymbolKind.TypeParameter, container: 'type' },
                { regex: '(?:export\\s+)?enum\\s+(?<name>\\w+)', kind: vscode.SymbolKind.Enum, container: 'enum' },
                { regex: '(?:export\\s+)?const\\s+(?<name>\\w+)\\s*=', kind: vscode.SymbolKind.Constant, container: 'constant' },
                { regex: '(?:export\\s+)?let\\s+(?<name>\\w+)\\s*=', kind: vscode.SymbolKind.Variable, container: 'variable' },
                { regex: '#(?<name>\\w+)\\s*=', kind: vscode.SymbolKind.Field, container: 'field' },
            ],
            javascript: [
                { regex: '(?:export\\s+)?(?:async\\s+)?function\\s+(?<name>\\w+)', kind: vscode.SymbolKind.Function, container: 'function' },
                { regex: '(?:export\\s+)?class\\s+(?<name>\\w+)', kind: vscode.SymbolKind.Class, container: 'class' },
                { regex: '(?:export\\s+)?const\\s+(?<name>\\w+)\\s*=', kind: vscode.SymbolKind.Constant, container: 'constant' },
                { regex: '(?:export\\s+)?let\\s+(?<name>\\w+)\\s*=', kind: vscode.SymbolKind.Variable, container: 'variable' },
            ],
            python: [
                { regex: '^def\\s+(?<name>\\w+)', kind: vscode.SymbolKind.Function, container: 'function' },
                { regex: '^class\\s+(?<name>\\w+)', kind: vscode.SymbolKind.Class, container: 'class' },
                { regex: '^\\s*@\\w+\\s*(?:\\ndef\\s+(?<name>\\w+))?', kind: vscode.SymbolKind.Function, container: 'decorated function' },
                { regex: '^([A-Z][a-zA-Z0-9_]*)\\s*=', kind: vscode.SymbolKind.Variable, container: 'constant' },
            ],
            go: [
                { regex: '^func\\s+(?:\\([^)]+\\)\\s+)?(?<name>\\w+)', kind: vscode.SymbolKind.Function, container: 'function' },
                { regex: '^func\\s+\\((?<name>\\w+)\\s+\\*?\\w+)\\)', kind: vscode.SymbolKind.Method, container: 'method' },
                { regex: '^type\\s+(?<name>\\w+)\\s+struct', kind: vscode.SymbolKind.Struct, container: 'struct' },
                { regex: '^type\\s+(?<name>\\w+)\\s+interface', kind: vscode.SymbolKind.Interface, container: 'interface' },
                { regex: '^const\\s+(?<name>\\w+)', kind: vscode.SymbolKind.Constant, container: 'constant' },
                { regex: '^var\\s+(?<name>\\w+)', kind: vscode.SymbolKind.Variable, container: 'variable' },
            ],
            rust: [
                { regex: '^fn\\s+(?<name>\\w+)', kind: vscode.SymbolKind.Function, container: 'function' },
                { regex: '^struct\\s+(?<name>\\w+)', kind: vscode.SymbolKind.Struct, container: 'struct' },
                { regex: '^enum\\s+(?<name>\\w+)', kind: vscode.SymbolKind.Enum, container: 'enum' },
                { regex: '^trait\\s+(?<name>\\w+)', kind: vscode.SymbolKind.Interface, container: 'trait' },
                { regex: '^impl\\s+(?:<[^>]+>\\s+)?(?<name>\\w+)', kind: vscode.SymbolKind.Class, container: 'impl' },
                { regex: '^(?:pub\\s+)?const\\s+(?<name>\\w+)', kind: vscode.SymbolKind.Constant, container: 'constant' },
                { regex: '^(?:pub\\s+)?let\\s+(?:mut\\s+)?(?<name>\\w+)', kind: vscode.SymbolKind.Variable, container: 'variable' },
            ],
            java: [
                { regex: '(?:public|private|protected)?\\s*(?:static)?\\s*(?:void|int|String|\\w+)\\s+(?<name>\\w+)\\s*\\(', kind: vscode.SymbolKind.Method, container: 'method' },
                { regex: 'class\\s+(?<name>\\w+)', kind: vscode.SymbolKind.Class, container: 'class' },
                { regex: 'interface\\s+(?<name>\\w+)', kind: vscode.SymbolKind.Interface, container: 'interface' },
                { regex: 'enum\\s+(?<name>\\w+)', kind: vscode.SymbolKind.Enum, container: 'enum' },
            ],
            default: [
                { regex: '(?:export|public|private)?\\s*function\\s+(?<name>\\w+)', kind: vscode.SymbolKind.Function, container: 'function' },
                { regex: '(?:export|public|private)?\\s*class\\s+(?<name>\\w+)', kind: vscode.SymbolKind.Class, container: 'class' },
            ]
        };
        return patterns[languageId] || patterns.default;
    }
    /**
     * Calculate relevance score for a match
     */
    calculateScore(name, query) {
        let score = 0;
        // Exact match gets highest score
        if (name === query) {
            score += 100;
        }
        // Prefix match gets high score
        else if (name.startsWith(query)) {
            score += 80;
        }
        // Contains gets medium score
        else if (name.includes(query)) {
            score += 50;
        }
        // Fuzzy match gets lower score
        else {
            let queryIndex = 0;
            for (const char of name) {
                if (queryIndex < query.length && char.toLowerCase() === query[queryIndex].toLowerCase()) {
                    queryIndex++;
                    score += 5;
                }
            }
            if (queryIndex < query.length / 2) {
                score = 0;
            }
        }
        // Bonus for shorter names (likely more important)
        score += Math.max(0, 20 - name.length);
        return score;
    }
    /**
     * Update the symbols cache
     */
    async updateCache() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            return;
        }
        this.lastUpdate = new Date();
        this.symbolsCache.clear();
        const patterns = this.buildSearchPatterns(workspaceFolders);
        for (const pattern of patterns) {
            const files = await vscode.workspace.findFiles(pattern, '**/node_modules/**', this.maxFiles);
            for (const file of files) {
                const symbols = await this.searchInFile(file, '', {});
                this.symbolsCache.set(file.toString(), symbols);
            }
        }
    }
    /**
     * Get cached symbols for a file
     */
    getCachedSymbols(uri) {
        return this.symbolsCache.get(uri.toString()) || [];
    }
    /**
     * Check if cache needs update
     */
    needsUpdate() {
        if (!this.lastUpdate) {
            return true;
        }
        const now = new Date();
        return (now.getTime() - this.lastUpdate.getTime()) > this.updateInterval;
    }
}
exports.MorseWorkspaceSymbolProvider = MorseWorkspaceSymbolProvider;
/**
 * Quick symbol search command
 */
async function quickSymbolSearch() {
    const symbolProvider = new MorseWorkspaceSymbolProvider();
    const query = await vscode.window.showInputBox({
        title: 'Search Symbols',
        placeHolder: 'Enter symbol name (min 2 characters)'
    });
    if (!query || query.length < 2) {
        return;
    }
    const symbols = await symbolProvider.searchSymbols(query, {});
    if (symbols.length === 0) {
        vscode.window.showInformationMessage(`No symbols found for "${query}"`);
        return;
    }
    const items = symbols.slice(0, 20).map(symbol => ({
        label: `${getSymbolIcon(symbol.kind)} ${symbol.name}`,
        description: `${symbol.location.uri.fsPath}:${symbol.location.range.start.line + 1}`,
        symbol
    }));
    const selected = await vscode.window.showQuickPick(items, {
        title: `Symbols matching "${query}"`,
        placeHolder: 'Select a symbol to navigate'
    });
    if (selected) {
        const document = await vscode.workspace.openTextDocument(selected.symbol.location.uri);
        const editor = await vscode.window.showTextDocument(document);
        const position = selected.symbol.location.range.start;
        editor.selection = new vscode.Selection(position, position);
        editor.revealRange(selected.symbol.location.range);
    }
}
/**
 * Get icon for symbol kind
 */
function getSymbolIcon(kind) {
    const icons = {
        [vscode.SymbolKind.File]: '$(file)',
        [vscode.SymbolKind.Module]: '$(file-submodule)',
        [vscode.SymbolKind.Namespace]: '$(symbol-namespace)',
        [vscode.SymbolKind.Package]: '$(package)',
        [vscode.SymbolKind.Class]: '$(symbol-class)',
        [vscode.SymbolKind.Method]: '$(symbol-method)',
        [vscode.SymbolKind.Property]: '$(symbol-property)',
        [vscode.SymbolKind.Field]: '$(symbol-field)',
        [vscode.SymbolKind.Constructor]: '$(symbol-constructor)',
        [vscode.SymbolKind.Enum]: '$(symbol-enum)',
        [vscode.SymbolKind.Interface]: '$(symbol-interface)',
        [vscode.SymbolKind.Function]: '$(symbol-function)',
        [vscode.SymbolKind.Variable]: '$(symbol-variable)',
        [vscode.SymbolKind.Constant]: '$(symbol-constant)',
        [vscode.SymbolKind.String]: '$(symbol-string)',
        [vscode.SymbolKind.Number]: '$(symbol-number)',
        [vscode.SymbolKind.Boolean]: '$(symbol-boolean)',
        [vscode.SymbolKind.Array]: '$(symbol-array)',
        [vscode.SymbolKind.Object]: '$(symbol-object)',
        [vscode.SymbolKind.Key]: '$(symbol-key)',
        [vscode.SymbolKind.Null]: '$(symbol-null)',
        [vscode.SymbolKind.EnumMember]: '$(symbol-enum-member)',
        [vscode.SymbolKind.Struct]: '$(symbol-struct)',
        [vscode.SymbolKind.Event]: '$(symbol-event)',
        [vscode.SymbolKind.Operator]: '$(symbol-operator)',
        [vscode.SymbolKind.TypeParameter]: '$(symbol-type-parameter)',
    };
    return icons[kind] || '$(symbol-default)';
}
/**
 * Register the workspace symbol provider
 */
function registerWorkspaceSymbolProvider(context) {
    const provider = new MorseWorkspaceSymbolProvider();
    // Register workspace symbol provider
    const registration = vscode.languages.registerWorkspaceSymbolProvider(provider);
    // Register quick symbol search command
    const quickSearchCommand = vscode.commands.registerCommand('morse.workspaceSymbols.search', quickSymbolSearch);
    // Register update cache command
    const updateCacheCommand = vscode.commands.registerCommand('morse.workspaceSymbols.updateCache', async () => {
        await provider.updateCache();
        vscode.window.showInformationMessage('Symbol cache updated');
    });
    context.subscriptions.push(registration, quickSearchCommand, updateCacheCommand);
    return {
        dispose: () => {
            registration.dispose();
            quickSearchCommand.dispose();
            updateCacheCommand.dispose();
        }
    };
}
//# sourceMappingURL=WorkspaceSymbolProvider.js.map