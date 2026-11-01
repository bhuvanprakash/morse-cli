"use strict";
/**
 * Slash Command Autocomplete
 * Provides VS Code autocomplete for slash commands
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
exports.SlashCommandHoverProvider = exports.SlashCommandCompletionProvider = void 0;
exports.registerSlashCommandAutocomplete = registerSlashCommandAutocomplete;
const vscode = __importStar(require("vscode"));
const registry_1 = require("./registry");
/**
 * Slash command completion item provider
 */
class SlashCommandCompletionProvider {
    /**
     * Provide completion items
     */
    provideCompletionItems(document, position, token, context) {
        // Only provide completions when line starts with /
        const line = document.lineAt(position.line).text;
        const beforeCursor = line.substring(0, position.character);
        // Check if we're in a slash command context
        if (!beforeCursor.startsWith('/') && !beforeCursor.endsWith('/')) {
            return undefined;
        }
        // Get the partial command
        const partial = beforeCursor.includes(' ')
            ? beforeCursor.substring(beforeCursor.lastIndexOf(' ') + 1)
            : beforeCursor;
        // Get suggestions
        const commands = (0, registry_1.getCommandSuggestions)(partial);
        if (commands.length === 0) {
            return undefined;
        }
        // Convert to completion items
        const items = commands.map((cmd) => this.createCompletionItem(cmd));
        return new vscode.CompletionList(items, true);
    }
    /**
     * Create a completion item from a slash command
     */
    createCompletionItem(command) {
        const item = new vscode.CompletionItem(`/${command.name}`, 3 // vscode.CompletionItemKind.Command = 3
        );
        item.detail = command.description;
        item.documentation = this.createDocumentation(command);
        if (command.argsPlaceholder) {
            item.insertText = new vscode.SnippetString(`/${command.name} ${command.argsPlaceholder}`);
        }
        else {
            item.insertText = `/${command.name}`;
        }
        // Add shortcut if available
        if (command.shortcut) {
            item.detail += ` (${command.shortcut})`;
        }
        return item;
    }
    /**
     * Create documentation for a command
     */
    createDocumentation(command) {
        const md = new vscode.MarkdownString();
        md.appendMarkdown(`**/${command.name}**\n\n`);
        md.appendMarkdown(`${command.description}\n\n`);
        if (command.argsPlaceholder) {
            md.appendMarkdown(`**Arguments:** ${command.argsPlaceholder}\n\n`);
        }
        if (command.aliases && command.aliases.length > 0) {
            const aliasList = command.aliases.map((a) => `/${a}`).join(', ');
            md.appendMarkdown(`**Aliases:** ${aliasList}\n\n`);
        }
        if (command.category) {
            md.appendMarkdown(`**Category:** ${command.category}`);
        }
        return md;
    }
}
exports.SlashCommandCompletionProvider = SlashCommandCompletionProvider;
/**
 * Slash command hover provider
 */
class SlashCommandHoverProvider {
    /**
     * Provide hover information
     */
    provideHover(document, position, token) {
        // Only provide hover for slash commands
        const line = document.lineAt(position.line).text;
        const beforeCursor = line.substring(0, position.character);
        // Check if we're on a slash command
        const match = beforeCursor.match(/\/(\w+)$/);
        if (!match) {
            return undefined;
        }
        const commandName = match[1];
        const parser = (0, registry_1.getCommandParser)();
        if (!parser) {
            return undefined;
        }
        const command = parser.getCommand(commandName);
        if (!command) {
            return undefined;
        }
        // Create hover content
        const md = new vscode.MarkdownString();
        md.appendMarkdown(`**/${command.name}**\n\n`);
        md.appendMarkdown(`${command.description}\n\n`);
        if (command.argsPlaceholder) {
            md.appendMarkdown(`**Usage:** \`/${command.name} ${command.argsPlaceholder}\`\n\n`);
        }
        else {
            md.appendMarkdown(`**Usage:** \`/${command.name}\`\n\n`);
        }
        if (command.aliases && command.aliases.length > 0) {
            const aliasList = command.aliases.map((a) => `/${a}`).join(', ');
            md.appendMarkdown(`**Aliases:** ${aliasList}\n`);
        }
        return new vscode.Hover(md);
    }
}
exports.SlashCommandHoverProvider = SlashCommandHoverProvider;
/**
 * Register slash command autocomplete
 */
function registerSlashCommandAutocomplete(context) {
    // Register completion provider
    const completionProvider = new SlashCommandCompletionProvider();
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider({ pattern: '**/*' }, completionProvider, '/' // Trigger on /
    ));
    // Register hover provider
    const hoverProvider = new SlashCommandHoverProvider();
    context.subscriptions.push(vscode.languages.registerHoverProvider({ pattern: '**/*' }, hoverProvider));
}
//# sourceMappingURL=autocomplete.js.map