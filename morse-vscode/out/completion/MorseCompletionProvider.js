"use strict";
/**
 * Completion provider for Morse with context-aware intelligent completions
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
exports.MorseCompletionProvider = void 0;
const vscode = __importStar(require("vscode"));
// Context-aware snippet library
const snippetLibrary = [
    // React hooks
    {
        label: 'useState',
        kind: vscode.CompletionItemKind.Snippet,
        insertText: 'const [${1:state}, set${1:State}] = useState(${2:initialValue});',
        detail: 'React useState hook',
        documentation: 'Declare a new state variable with useState hook',
        priority: 10
    },
    {
        label: 'useEffect',
        kind: vscode.CompletionItemKind.Snippet,
        insertText: 'useEffect(() => {\n\t${1:// effect}\n\treturn () => {\n\t\t${2:// cleanup}\n\t};\n}, [${3:dependencies}]);',
        detail: 'React useEffect hook',
        documentation: 'Perform side effects in function components',
        priority: 10
    },
    {
        label: 'useCallback',
        kind: vscode.CompletionItemKind.Snippet,
        insertText: 'const ${1:callback} = useCallback(() => {\n\t${2:// implementation}\n}, [${3:dependencies}]);',
        detail: 'React useCallback hook',
        documentation: 'Memoize a callback function',
        priority: 8
    },
    {
        label: 'useMemo',
        kind: vscode.CompletionItemKind.Snippet,
        insertText: 'const ${1:memoizedValue} = useMemo(() => {\n\treturn ${2:computeValue};\n}, [${3:dependencies}]);',
        detail: 'React useMemo hook',
        documentation: 'Memoize an expensive computation',
        priority: 8
    },
    {
        label: 'useRef',
        kind: vscode.CompletionItemKind.Snippet,
        insertText: 'const ${1:ref} = useRef(${2:null});',
        detail: 'React useRef hook',
        documentation: 'Create a mutable ref object',
        priority: 8
    },
    {
        label: 'useContext',
        kind: vscode.CompletionItemKind.Snippet,
        insertText: 'const ${1:context} = useContext(${2:Context});',
        detail: 'React useContext hook',
        documentation: 'Consume a React context',
        priority: 7
    },
    // TypeScript types
    {
        label: 'interface',
        kind: vscode.CompletionItemKind.Snippet,
        insertText: 'interface ${1:InterfaceName} {\n\t${2:property}: ${3:type};\n}',
        detail: 'TypeScript interface',
        documentation: 'Define a TypeScript interface',
        priority: 9
    },
    {
        label: 'type',
        kind: vscode.CompletionItemKind.Snippet,
        insertText: 'type ${1:TypeName} = ${2:type};',
        detail: 'TypeScript type alias',
        documentation: 'Define a TypeScript type alias',
        priority: 9
    },
    {
        label: 'enum',
        kind: vscode.CompletionItemKind.Snippet,
        insertText: 'enum ${1:EnumName} {\n\t${2:Option1} = \'${3:option1}\',\n\t${4:Option2} = \'${5:option2}\',\n}',
        detail: 'TypeScript enum',
        documentation: 'Define a TypeScript enum',
        priority: 7
    },
    {
        label: 'generic',
        kind: vscode.CompletionItemKind.Snippet,
        insertText: '<${1:T}, ${2:U}>',
        detail: 'Generic type parameters',
        documentation: 'Add generic type parameters',
        priority: 8
    },
    // Async/await patterns
    {
        label: 'async function',
        kind: vscode.CompletionItemKind.Snippet,
        insertText: 'async function ${1:functionName}(${2:params}): Promise<${3:void}> {\n\t${4:// implementation}\n}',
        detail: 'Async function declaration',
        documentation: 'Declare an async function',
        priority: 9
    },
    {
        label: 'try-catch',
        kind: vscode.CompletionItemKind.Snippet,
        insertText: 'try {\n\t${1:// code}\n} catch (${2:error}) {\n\t${3:// handle error}\n}',
        detail: 'Try-catch block',
        documentation: 'Handle errors with try-catch',
        priority: 10
    },
    {
        label: 'try-catch-finally',
        kind: vscode.CompletionItemKind.Snippet,
        insertText: 'try {\n\t${1:// code}\n} catch (${2:error}) {\n\t${3:// handle error}\n} finally {\n\t${4:// cleanup}\n}',
        detail: 'Try-catch-finally block',
        documentation: 'Handle errors with cleanup',
        priority: 9
    },
    {
        label: 'promise',
        kind: vscode.CompletionItemKind.Snippet,
        insertText: 'new Promise<${1:T}>((resolve, reject) => {\n\t${2:// async operation}\n\tresolve(${3:value});\n});',
        detail: 'Create a Promise',
        documentation: 'Create a new Promise',
        priority: 7
    },
    // Error handling
    {
        label: 'throw Error',
        kind: vscode.CompletionItemKind.Snippet,
        insertText: 'throw new Error(\'${1:error message}\');',
        detail: 'Throw an Error',
        documentation: 'Throw a new Error',
        priority: 8
    },
    {
        label: 'custom Error',
        kind: vscode.CompletionItemKind.Snippet,
        insertText: 'class ${1:ErrorName} extends Error {\n\tconstructor(${2:message}) {\n\t\tsuper(${2:message});\n\t\tthis.name = \'${1:ErrorName}\';\n\t}\n}',
        detail: 'Custom Error class',
        documentation: 'Create a custom Error class',
        priority: 7
    },
    // Testing
    {
        label: 'describe',
        kind: vscode.CompletionItemKind.Snippet,
        insertText: 'describe(\'${1:description}\', () => {\n\t${2:// tests}\n});',
        detail: 'Jest describe block',
        documentation: 'Jest describe test suite',
        priority: 9
    },
    {
        label: 'it',
        kind: vscode.CompletionItemKind.Snippet,
        insertText: 'it(\'${1:should do something}\', async () => {\n\t${2:// test}\n});',
        detail: 'Jest it/test block',
        documentation: 'Jest test case',
        priority: 9
    },
    {
        label: 'test',
        kind: vscode.CompletionItemKind.Snippet,
        insertText: 'test(\'${1:should do something}\', async () => {\n\t${2:// test}\n});',
        detail: 'Jest test block',
        documentation: 'Jest test case (alias for it)',
        priority: 9
    },
    {
        label: 'expect',
        kind: vscode.CompletionItemKind.Snippet,
        insertText: 'expect(${1:actual}).${2:toBe}(${3:expected});',
        detail: 'Jest expect',
        documentation: 'Jest assertion',
        priority: 8
    },
    {
        label: 'beforeEach',
        kind: vscode.CompletionItemKind.Snippet,
        insertText: 'beforeEach(() => {\n\t${1:// setup}\n});',
        detail: 'Jest beforeEach',
        documentation: 'Jest setup before each test',
        priority: 7
    },
    {
        label: 'afterEach',
        kind: vscode.CompletionItemKind.Snippet,
        insertText: 'afterEach(() => {\n\t${1:// cleanup}\n});',
        detail: 'Jest afterEach',
        documentation: 'Jest cleanup after each test',
        priority: 7
    },
    // Common patterns
    {
        label: 'console.log',
        kind: vscode.CompletionItemKind.Snippet,
        insertText: 'console.log(\'${1:label}:\', ${2:value});',
        detail: 'Console log',
        documentation: 'Debug with console.log',
        priority: 10
    },
    {
        label: 'export default',
        kind: vscode.CompletionItemKind.Snippet,
        insertText: 'export default ${1:functionName};',
        detail: 'Export default',
        documentation: 'Export as default',
        priority: 8
    },
    {
        label: 'export const',
        kind: vscode.CompletionItemKind.Snippet,
        insertText: 'export const ${1:name} = ${2:value};',
        detail: 'Export const',
        documentation: 'Export a constant',
        priority: 8
    },
    {
        label: 'module.exports',
        kind: vscode.CompletionItemKind.Snippet,
        insertText: 'module.exports = {\n\t${1:exported}\n};',
        detail: 'Module.exports',
        documentation: 'CommonJS export',
        priority: 7
    },
    // Arrow functions
    {
        label: 'arrow function',
        kind: vscode.CompletionItemKind.Snippet,
        insertText: '(${1:params}) => {\n\t${2:// body}\n}',
        detail: 'Arrow function',
        documentation: 'Create an arrow function',
        priority: 10
    },
    {
        label: 'arrow async',
        kind: vscode.CompletionItemKind.Snippet,
        insertText: 'async (${1:params}) => {\n\t${2:// body}\n}',
        detail: 'Async arrow function',
        documentation: 'Create an async arrow function',
        priority: 9
    },
    // Class patterns
    {
        label: 'class',
        kind: vscode.CompletionItemKind.Snippet,
        insertText: 'class ${1:ClassName} {\n\tconstructor(${2:params}) {\n\t\t${3:// initialization}\n\t}\n}',
        detail: 'Class declaration',
        documentation: 'Declare a class',
        priority: 8
    },
    {
        label: 'constructor',
        kind: vscode.CompletionItemKind.Snippet,
        insertText: 'constructor(${1:params}) {\n\t${2:// initialization}\n}',
        detail: 'Class constructor',
        documentation: 'Class constructor method',
        priority: 8
    },
    {
        label: 'getter',
        kind: vscode.CompletionItemKind.Snippet,
        insertText: 'get ${1:property}() {\n\treturn ${2:this._${1:property}};\n}',
        detail: 'Getter method',
        documentation: 'Create a getter',
        priority: 6
    },
    {
        label: 'setter',
        kind: vscode.CompletionItemKind.Snippet,
        insertText: 'set ${1:property}(${2:value}) {\n\t${3:this._${1:property}} = ${2:value};\n}',
        detail: 'Setter method',
        documentation: 'Create a setter',
        priority: 6
    },
    // React component patterns
    {
        label: 'React FC',
        kind: vscode.CompletionItemKind.Snippet,
        insertText: 'import React from \'react\';\n\ninterface ${1:ComponentName}Props {\n\t${2:props}\n}\n\nexport const ${1:ComponentName}: React.FC<${1:ComponentName}Props> = (${3:props}) => {\n\treturn (\n\t\t<div>${4:content}</div>\n\t);\n};',
        detail: 'React Functional Component',
        documentation: 'Create a React functional component with TypeScript',
        priority: 9
    },
    {
        label: 'React useState',
        kind: vscode.CompletionItemKind.Snippet,
        insertText: 'const [${1:state}, set${1:State}] = useState<${2:string}>(\'${3:initial}\');',
        detail: 'React useState with TypeScript',
        documentation: 'useState with type annotation',
        priority: 9
    },
    // Utility patterns
    {
        label: 'optional chaining',
        kind: vscode.CompletionItemKind.Snippet,
        insertText: '${1:object}?.${2:property}',
        detail: 'Optional chaining',
        documentation: 'Use optional chaining operator',
        priority: 9
    },
    {
        label: 'nullish coalescing',
        kind: vscode.CompletionItemKind.Snippet,
        insertText: '${1:value} ?? ${2:default}',
        detail: 'Nullish coalescing',
        documentation: 'Use nullish coalescing operator',
        priority: 8
    },
    {
        label: 'destructuring',
        kind: vscode.CompletionItemKind.Snippet,
        insertText: 'const { ${1:prop1}, ${2:prop2} } = ${3:object};',
        detail: 'Object destructuring',
        documentation: 'Destructure object properties',
        priority: 9
    },
    {
        label: 'spread operator',
        kind: vscode.CompletionItemKind.Snippet,
        insertText: '...${1:array}',
        detail: 'Spread operator',
        documentation: 'Use spread operator',
        priority: 8
    }
];
class MorseCompletionProvider {
    client = null;
    suggestionCache = new Map();
    maxCacheSize = 100;
    constructor(client) {
        this.client = client || null;
    }
    /**
     * Set the Morse client for AI-powered completions
     */
    setClient(client) {
        this.client = client;
    }
    async provideCompletionItems(document, position, token, context) {
        const completionContext = this.getCompletionContext(document, position);
        // Get language-specific completions
        const languageCompletions = this.getLanguageCompletions(completionContext);
        // Get context-aware completions
        const contextCompletions = this.getContextAwareCompletions(completionContext);
        // Combine completions
        const allCompletions = [...languageCompletions, ...contextCompletions];
        // If we have AI client, try to get AI suggestions
        if (this.client) {
            try {
                const aiCompletions = await this.getAICompletions(document, position, token);
                if (aiCompletions) {
                    allCompletions.push(...aiCompletions);
                }
            }
            catch (error) {
                console.log('AI completion not available:', error);
            }
        }
        return allCompletions;
    }
    /**
     * Extract completion context from document and position
     */
    getCompletionContext(document, position) {
        const line = document.lineAt(position.line);
        const currentLine = line.text;
        const cursorPosition = position.character;
        return {
            beforeText: currentLine.substring(0, cursorPosition),
            afterText: currentLine.substring(cursorPosition),
            currentLine,
            cursorPosition,
            filePath: document.fileName,
            languageId: document.languageId
        };
    }
    /**
     * Get language-specific completions
     */
    getLanguageCompletions(context) {
        const completions = [];
        const languageId = context.languageId;
        for (const snippet of snippetLibrary) {
            // Filter based on language
            const item = new vscode.CompletionItem(snippet.label, snippet.kind);
            item.insertText = new vscode.SnippetString(snippet.insertText);
            item.detail = snippet.detail;
            item.documentation = new vscode.MarkdownString(snippet.documentation);
            item.sortText = String(snippet.priority).padStart(2, '0') + snippet.label;
            completions.push(item);
        }
        return completions;
    }
    /**
     * Get context-aware completions based on surrounding code
     */
    getContextAwareCompletions(context) {
        const completions = [];
        const { beforeText, afterText, currentLine } = context;
        // Check for React context
        if (currentLine.includes('use') && !currentLine.includes('useState')) {
            const reactHooks = ['useEffect', 'useContext', 'useReducer', 'useCallback', 'useMemo', 'useRef', 'useState'];
            for (const hook of reactHooks) {
                if (hook.toLowerCase().startsWith(currentLine.replace('use', '').toLowerCase()) || currentLine.includes('use')) {
                    const existing = snippetLibrary.find(s => s.label === hook);
                    if (existing) {
                        const item = new vscode.CompletionItem(existing.label, existing.kind);
                        item.insertText = new vscode.SnippetString(existing.insertText);
                        item.detail = existing.detail;
                        item.documentation = new vscode.MarkdownString(existing.documentation);
                        completions.push(item);
                    }
                }
            }
        }
        // Check for TypeScript context
        if (beforeText.includes(': ') || beforeText.includes('interface ') || beforeText.includes('type ')) {
            const tsTypes = ['string', 'number', 'boolean', 'any', 'void', 'never', 'unknown', 'object'];
            for (const type of tsTypes) {
                const item = new vscode.CompletionItem(type, vscode.CompletionItemKind.TypeParameter);
                item.detail = `TypeScript type: ${type}`;
                completions.push(item);
            }
        }
        // Check for error handling context
        if (beforeText.includes('catch') || beforeText.includes('error') || beforeText.includes('err')) {
            const errorItems = snippetLibrary.filter(s => s.label.includes('Error') || s.label.includes('catch'));
            for (const snippet of errorItems) {
                const item = new vscode.CompletionItem(snippet.label, snippet.kind);
                item.insertText = new vscode.SnippetString(snippet.insertText);
                item.detail = snippet.detail;
                completions.push(item);
            }
        }
        // Check for testing context
        if (beforeText.includes('describe') || beforeText.includes('test') || beforeText.includes('it(')) {
            const testItems = snippetLibrary.filter(s => ['describe', 'it', 'test', 'expect', 'beforeEach', 'afterEach'].includes(s.label));
            for (const snippet of testItems) {
                const item = new vscode.CompletionItem(snippet.label, snippet.kind);
                item.insertText = new vscode.SnippetString(snippet.insertText);
                item.detail = snippet.detail;
                completions.push(item);
            }
        }
        // Check for async context
        if (beforeText.includes('async') || beforeText.includes('await') || beforeText.includes('Promise')) {
            const asyncItems = snippetLibrary.filter(s => s.label.includes('async') || s.label.includes('Promise'));
            for (const snippet of asyncItems) {
                const item = new vscode.CompletionItem(snippet.label, snippet.kind);
                item.insertText = new vscode.SnippetString(snippet.insertText);
                item.detail = snippet.detail;
                completions.push(item);
            }
        }
        return completions;
    }
    /**
     * Get AI-powered completions from Morse
     */
    async getAICompletions(document, position, token) {
        if (!this.client) {
            return null;
        }
        // Get context around cursor
        const startLine = Math.max(0, position.line - 10);
        const endLine = Math.min(document.lineCount, position.line + 5);
        const range = new vscode.Range(startLine, 0, endLine, 0);
        const contextCode = document.getText(range);
        // Check cache
        const cacheKey = `${contextCode.slice(-200)}:${document.languageId}`;
        const cached = this.suggestionCache.get(cacheKey);
        if (cached) {
            return cached;
        }
        try {
            // Use the edit endpoint for completion suggestions
            const result = await this.client.edit({
                code: contextCode,
                language: document.languageId,
                instruction: 'Complete the code at the cursor with the most likely completion',
                filePath: document.fileName,
            });
            if (token.isCancellationRequested) {
                return null;
            }
            // Convert AI suggestions to completion items
            const aiCompletions = [];
            if (result.edited) {
                const lines = result.edited.split('\n');
                const cursorLine = position.line - startLine;
                // Extract the completion lines after cursor
                if (lines.length > cursorLine) {
                    const completion = lines.slice(cursorLine).join('\n').trim();
                    if (completion) {
                        const item = new vscode.CompletionItem('AI Suggestion', vscode.CompletionItemKind.Snippet);
                        item.insertText = new vscode.SnippetString(completion);
                        item.detail = 'AI-powered completion';
                        item.documentation = new vscode.MarkdownString('Completion suggested by Morse AI');
                        item.sortText = '00' + item.label; // High priority
                        aiCompletions.push(item);
                    }
                }
            }
            // Cache results
            if (this.suggestionCache.size >= this.maxCacheSize) {
                const firstKey = this.suggestionCache.keys().next().value;
                if (firstKey) {
                    this.suggestionCache.delete(firstKey);
                }
            }
            this.suggestionCache.set(cacheKey, aiCompletions);
            return aiCompletions;
        }
        catch (error) {
            console.error('AI completion error:', error);
            return null;
        }
    }
    /**
     * Resolve completion details
     */
    resolveCompletionItem(item, token) {
        // Add additional documentation for AI suggestions
        if (item.detail?.includes('AI-powered')) {
            item.documentation = new vscode.MarkdownString('This completion was generated by Morse AI based on the code context.\n\n' +
                'Press Tab to accept the suggestion.');
        }
        return item;
    }
    /**
     * Clear the completion cache
     */
    clearCache() {
        this.suggestionCache.clear();
    }
}
exports.MorseCompletionProvider = MorseCompletionProvider;
//# sourceMappingURL=MorseCompletionProvider.js.map