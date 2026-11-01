"use strict";
/**
 * Hover provider for Morse tool documentation
 * Shows tool documentation and AI assistance on hover
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
exports.MorseHoverProvider = void 0;
const vscode = __importStar(require("vscode"));
// Tool documentation registry
const toolDocs = {
    'read_file': {
        name: 'ReadFile',
        description: 'Read the contents of a file from the filesystem',
        parameters: ['path: string (required) - Relative or absolute file path', 'line_ranges?: number[][] - Optional line ranges to read'],
        examples: ['Read file contents', 'Read specific lines 1-50']
    },
    'write_to_file': {
        name: 'WriteToFile',
        description: 'Write content to a file, creating it if it does not exist',
        parameters: ['path: string (required) - File path to write to', 'content: string (required) - Content to write'],
        examples: ['Create a new file', 'Overwrite existing file']
    },
    'search_and_replace': {
        name: 'SearchAndReplace',
        description: 'Make targeted edits to existing files using search and replace',
        parameters: ['path: string (required) - File to edit', 'operations: SearchReplaceOperation[] - Array of operations'],
        examples: ['Replace text', 'Insert content', 'Delete content']
    },
    'execute_command': {
        name: 'ExecuteCommand',
        description: 'Execute shell commands in the terminal',
        parameters: ['command: string (required) - Shell command to execute', 'cwd?: string - Working directory'],
        examples: ['Run npm install', 'Execute git commands', 'Run tests']
    },
    'browser': {
        name: 'Browser',
        description: 'Control a browser for web automation and testing',
        parameters: ['action: string - Action to perform (goto, click, type, etc.)', 'selector?: string - CSS selector'],
        examples: ['Navigate to URL', 'Fill form', 'Take screenshot']
    },
    'grep': {
        name: 'Grep',
        description: 'Search for text patterns across files in the project',
        parameters: ['pattern: string (required) - Regex pattern to search', 'path?: string - Directory to search'],
        examples: ['Find function definitions', 'Search for TODO comments']
    },
    'glob': {
        name: 'Glob',
        description: 'Find files matching patterns using glob syntax',
        parameters: ['pattern: string (required) - Glob pattern', 'path?: string - Directory to search'],
        examples: ['Find all TypeScript files', 'Find test files']
    },
    'list_files': {
        name: 'ListFiles',
        description: 'List files and directories in a path',
        parameters: ['path: string (required) - Directory path', 'recursive?: boolean - List recursively'],
        examples: ['List project structure', 'List directory contents']
    },
    'fetch': {
        name: 'Fetch',
        description: 'Make HTTP requests to external APIs',
        parameters: ['url: string (required) - URL to fetch', 'method?: string - HTTP method', 'headers?: object - Request headers'],
        examples: ['Get API data', 'POST to endpoint']
    },
    'ask_followup_question': {
        name: 'AskFollowupQuestion',
        description: 'Ask the user a clarifying question when more information is needed',
        parameters: ['question: string (required) - Question to ask', 'follow_up: string[] - Suggested answers'],
        examples: ['Clarify user intent', 'Request additional details']
    },
    'attempt_completion': {
        name: 'AttemptCompletion',
        description: 'Signal that a task has been completed',
        parameters: ['result: string (required) - Description of completed work', 'newContent?: string - Modified content'],
        examples: ['Task completed successfully', 'Code changes applied']
    }
};
class MorseHoverProvider {
    client = null;
    triggerChars = new Set(['/', '@', '(', '{']);
    constructor(client) {
        this.client = client || null;
    }
    /**
     * Set the Morse client for AI-powered hover features
     */
    setClient(client) {
        this.client = client;
    }
    async provideHover(document, position, token) {
        // Get the word at the cursor position
        const wordRange = document.getWordRangeAtPosition(position);
        if (!wordRange) {
            return null;
        }
        const word = document.getText(wordRange);
        const line = document.lineAt(position.line);
        const lineText = line.text;
        const cursorOffset = position.character;
        // Check if cursor is within a function call
        const functionMatch = this.detectFunctionCall(lineText, cursorOffset);
        // Check for tool documentation triggers
        const toolMatch = this.detectToolTrigger(lineText, cursorOffset);
        // Try to show tool documentation
        if (toolMatch) {
            const toolName = toolMatch.toLowerCase();
            const doc = toolDocs[toolName];
            if (doc) {
                return this.createToolHover(doc);
            }
        }
        // Check for Morse command triggers
        if (word.startsWith('morse:') || word.startsWith('//')) {
            return this.createMorseCommandHover(word, lineText);
        }
        // Check for function call context
        if (functionMatch) {
            return this.createFunctionHover(functionMatch, document, position);
        }
        // Check for import statements
        if (this.isImportStatement(lineText)) {
            return this.createImportHover(word, document);
        }
        // Check for TODO/FIXME comments
        const commentMatch = this.detectComment(lineText, cursorOffset);
        if (commentMatch) {
            return this.createCommentHover(commentMatch);
        }
        return null;
    }
    /**
     * Detect if cursor is within a function call
     */
    detectFunctionCall(lineText, cursorOffset) {
        // Look for function name before cursor
        const beforeCursor = lineText.substring(0, cursorOffset);
        // Common function call patterns
        const patterns = [
            /(\w+)\s*\([^)]*$/, // functionName(
            /(\w+)\s*:\s*[^,]+$/, // property: value
            /(\w+)\s*=>\s*[^}]*$/, // arrow function
        ];
        for (const pattern of patterns) {
            const match = beforeCursor.match(pattern);
            if (match) {
                return match[1];
            }
        }
        return null;
    }
    /**
     * Detect tool trigger keywords
     */
    detectToolTrigger(lineText, cursorOffset) {
        const beforeCursor = lineText.substring(0, cursorOffset);
        // Look for tool name patterns
        const toolPatterns = [
            /@(\w+)$/, // @toolName
            /#(\w+)$/, // #toolName
            /use\s+(\w+)/, // use toolName
            /import\s+.*from\s+['"](\w+)['"]/ // import from 'tool'
        ];
        for (const pattern of toolPatterns) {
            const match = beforeCursor.match(pattern);
            if (match) {
                return match[1];
            }
        }
        return null;
    }
    /**
     * Check if line is an import statement
     */
    isImportStatement(lineText) {
        return /^\s*import\s+/.test(lineText);
    }
    /**
     * Detect comments at cursor position
     */
    detectComment(lineText, cursorOffset) {
        // Check for TODO/FIXME/HACK comments
        const todoMatch = lineText.match(/\/\/\s*(TODO|FIXME|HACK|XXX):?\s*(.*)/i);
        if (todoMatch && cursorOffset >= lineText.indexOf(todoMatch[0])) {
            return todoMatch[0];
        }
        // Check for JSDoc comments
        const jsdocMatch = lineText.match(/\/\*\*\s*([^*]+)/);
        if (jsdocMatch && cursorOffset >= lineText.indexOf(jsdocMatch[0])) {
            return jsdocMatch[1];
        }
        return null;
    }
    /**
     * Create hover for tool documentation
     */
    createToolHover(doc) {
        const md = new vscode.MarkdownString();
        md.appendMarkdown(`**${doc.name}**\n\n`);
        md.appendMarkdown(`${doc.description}\n\n`);
        if (doc.parameters.length > 0) {
            md.appendMarkdown('**Parameters:**\n');
            doc.parameters.forEach(param => {
                md.appendMarkdown(`- ${param}\n`);
            });
            md.appendMarkdown('\n');
        }
        if (doc.examples.length > 0) {
            md.appendMarkdown('**Examples:**\n');
            doc.examples.forEach(example => {
                md.appendMarkdown(`- ${example}\n`);
            });
        }
        md.appendMarkdown('\n\n---\n');
        md.appendMarkdown('*Hover over code for more AI assistance*');
        return new vscode.Hover(md);
    }
    /**
     * Create hover for Morse commands
     */
    createMorseCommandHover(word, lineText) {
        const md = new vscode.MarkdownString();
        if (word.includes('morse:')) {
            md.appendMarkdown('**Morse Command**\n\n');
            md.appendMarkdown('Use Morse AI to assist with this code.\n\n');
            // Extract the command
            const command = word.replace('morse:', '').trim();
            md.appendMarkdown(`**Command:** ${command || '(empty)'}\n\n`);
            md.appendMarkdown('Available commands:\n');
            md.appendMarkdown('- `fix` - Fix issues in code\n');
            md.appendMarkdown('- `edit` - Edit the code\n');
            md.appendMarkdown('- `explain` - Explain the code\n');
            md.appendMarkdown('- `test` - Generate tests\n');
            md.appendMarkdown('- `refactor` - Refactor the code\n');
        }
        else if (lineText.includes('TODO') || lineText.includes('FIXME')) {
            md.appendMarkdown('**TODO/FIXME Comment**\n\n');
            md.appendMarkdown('This item needs attention.\n\n');
            md.appendMarkdown('Quick actions:\n');
            md.appendMarkdown('- Click the lightbulb icon to AI-fix\n');
            md.appendMarkdown('- Use CodeLens to resolve\n');
        }
        return new vscode.Hover(md);
    }
    /**
     * Create hover for function calls
     */
    createFunctionHover(functionName, document, position) {
        const md = new vscode.MarkdownString();
        // Try to find the function definition
        const definition = this.findFunctionDefinition(document, functionName);
        if (definition) {
            md.appendMarkdown(`**${functionName}**\n\n`);
            md.appendMarkdown(`${definition.description}\n\n`);
            if (definition.params.length > 0) {
                md.appendMarkdown('**Parameters:**\n');
                definition.params.forEach(param => {
                    md.appendMarkdown(`- \`${param.name}\`: ${param.type}\n`);
                });
            }
            if (definition.returns) {
                md.appendMarkdown(`\n**Returns:** ${definition.returns}\n`);
            }
        }
        else {
            // Show AI assistance for unknown functions
            md.appendMarkdown(`**${functionName}**\n\n`);
            md.appendMarkdown('Not found in current workspace.\n\n');
            md.appendMarkdown('AI Actions:\n');
            md.appendMarkdown('- `$(sparkles) Explain` - Ask AI what this function does\n');
            md.appendMarkdown('- `$(search) Find Definition` - Search for this function\n');
        }
        return new vscode.Hover(md);
    }
    /**
     * Create hover for import statements
     */
    createImportHover(importName, document) {
        const md = new vscode.MarkdownString();
        md.appendMarkdown(`**Import: ${importName}**\n\n`);
        // Check if it's a local or external import
        const isExternal = !importName.startsWith('.') && !importName.startsWith('/');
        if (isExternal) {
            md.appendMarkdown('External package\n\n');
            md.appendMarkdown('Actions:\n');
            md.appendMarkdown('- `$(package) View Docs` - Open package documentation\n');
            md.appendMarkdown('- `$(trash) Find Unused` - Check if import is used\n');
        }
        else {
            md.appendMarkdown('Local import\n\n');
            md.appendMarkdown('Actions:\n');
            md.appendMarkdown('- `$(file) Open File` - Navigate to imported file\n');
            md.appendMarkdown('- `$(search) Find References` - Find all uses\n');
        }
        return new vscode.Hover(md);
    }
    /**
     * Create hover for comments
     */
    createCommentHover(comment) {
        const md = new vscode.MarkdownString();
        if (comment.toLowerCase().includes('todo')) {
            md.appendMarkdown('**TODO Item**\n\n');
            md.appendMarkdown(`${comment}\n\n`);
            md.appendMarkdown('Quick actions:\n');
            md.appendMarkdown('- `$(sparkles) AI Fix` - Get AI suggestion\n');
            md.appendMarkdown('- `$(check) Mark Done` - Mark as completed\n');
        }
        else if (comment.toLowerCase().includes('fixme')) {
            md.appendMarkdown('**FIXME Item**\n\n');
            md.appendMarkdown(`${comment}\n\n`);
            md.appendMarkdown('Priority: High\n\n');
            md.appendMarkdown('- `$(sparkles) AI Fix` - Get AI suggestion\n');
        }
        else {
            md.appendMarkdown(`**Comment:** ${comment}`);
        }
        return new vscode.Hover(md);
    }
    /**
     * Find function definition in document
     */
    findFunctionDefinition(document, functionName) {
        const text = document.getText();
        // Look for function declaration
        const patterns = [
            new RegExp(`function\\s+${functionName}\\s*\\(([^)]*)\\)`),
            new RegExp(`const\\s+${functionName}\\s*=\\s*(?:async\\s*)?\\(([^)]*)\\)`),
            new RegExp(`class\\s+\\w+.*\\s+${functionName}\\s*\\(([^)]*)\\)`)
        ];
        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
                const params = match[1]
                    .split(',')
                    .filter(p => p.trim())
                    .map(p => {
                    const [name, type] = p.trim().split(':').map(s => s.trim());
                    return { name: name || 'param', type: type || 'any' };
                });
                return {
                    description: `Function '${functionName}' - Click to see AI assistance`,
                    params,
                    returns: 'unknown'
                };
            }
        }
        return null;
    }
}
exports.MorseHoverProvider = MorseHoverProvider;
//# sourceMappingURL=MorseHoverProvider.js.map