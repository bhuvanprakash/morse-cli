"use strict";
/**
 * Optimize Sidebar Provider for Morse VS Code Extension
 * Tree view showing optimization results
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
exports.OptimizeSidebarProvider = void 0;
exports.registerOptimizeSidebar = registerOptimizeSidebar;
const vscode = __importStar(require("vscode"));
const types_1 = require("./types");
/**
 * Sidebar provider for optimization results
 */
class OptimizeSidebarProvider {
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    results = [];
    context;
    constructor(context) {
        this.context = context;
    }
    /**
     * Show optimization results in sidebar
     */
    showResults(results) {
        this.results = results;
        this._onDidChangeTreeData.fire();
    }
    /**
     * Clear all results
     */
    clearResults() {
        this.results = [];
        this._onDidChangeTreeData.fire();
    }
    /**
     * Get tree item for element
     */
    getTreeItem(element) {
        return element;
    }
    /**
     * Get children of element
     */
    getChildren(element) {
        if (!element) {
            return Promise.resolve(this.getRootItems());
        }
        // Return children based on element type
        if (element.contextValue === 'file') {
            return Promise.resolve(this.getIssueItems(element));
        }
        if (element.contextValue === 'category') {
            return Promise.resolve(this.getCategoryIssueItems(element));
        }
        return Promise.resolve([]);
    }
    /**
     * Get root tree items (files)
     */
    getRootItems() {
        const items = [];
        // Add summary
        const totalIssues = this.results.reduce((sum, r) => sum + r.issues.length, 0);
        const errors = this.results.reduce((sum, r) => sum + r.summary.errors, 0);
        const warnings = this.results.reduce((sum, r) => sum + r.summary.warnings, 0);
        const summaryItem = new types_1.OptimizationTreeItem(`$(check) Summary: ${errors} errors, ${warnings} warnings`, vscode.TreeItemCollapsibleState.None, 'summary');
        summaryItem.description = `${totalIssues} total issues`;
        items.push(summaryItem);
        // Add files
        for (const result of this.results) {
            if (result.issues.length === 0)
                continue;
            const fileName = result.filePath.split(/[\\/]/).pop() || result.filePath;
            const fileItem = new types_1.OptimizationTreeItem(`$(file-code) ${fileName}`, vscode.TreeItemCollapsibleState.Expanded, 'file', undefined, []);
            fileItem.description = `${result.issues.length} issues`;
            fileItem.resourceUri = vscode.Uri.file(result.filePath);
            items.push(fileItem);
        }
        return items;
    }
    /**
     * Get issue items for a file (grouped by category)
     */
    getIssueItems(fileElement) {
        const result = this.results.find(r => {
            const fileName = r.filePath.split(/[\\/]/).pop() || r.filePath;
            return fileElement.label?.includes(fileName);
        });
        if (!result)
            return [];
        // Group issues by category
        const categoryMap = new Map();
        for (const issue of result.issues) {
            const category = issue.category;
            if (!categoryMap.has(category)) {
                categoryMap.set(category, []);
            }
            categoryMap.get(category).push(issue);
        }
        const items = [];
        // Add category groups
        for (const [category, issues] of categoryMap) {
            const categoryItem = new types_1.OptimizationTreeItem(`$(tag) ${this.formatCategory(category)} (${issues.length})`, vscode.TreeItemCollapsibleState.Expanded, 'category', undefined, []);
            categoryItem.description = issues.length.toString();
            items.push(categoryItem);
        }
        return items;
    }
    /**
     * Get issue items for a category
     */
    getCategoryIssueItems(categoryElement) {
        // Find the parent file
        const parentLabel = categoryElement.label;
        for (const result of this.results) {
            const fileName = result.filePath.split(/[\\/]/).pop() || result.filePath;
            // Find issues matching this category
            const categoryMatch = parentLabel?.match(/^\$\(tag\) (\w+) \((\d+)\)/);
            if (!categoryMatch)
                continue;
            const category = categoryMatch[1];
            const issues = result.issues.filter(i => i.category === category);
            return issues.map(issue => {
                const icon = this.getIconForSeverity(issue.severity);
                const item = new types_1.OptimizationTreeItem(`${icon} Line ${issue.startLine}: ${issue.title}`, vscode.TreeItemCollapsibleState.None, 'issue', issue);
                item.description = issue.severity;
                item.resourceUri = vscode.Uri.file(issue.filePath);
                return item;
            });
        }
        return [];
    }
    /**
     * Format category name
     */
    formatCategory(category) {
        return category
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }
    /**
     * Get icon for severity
     */
    getIconForSeverity(severity) {
        switch (severity) {
            case 'error':
                return '$(error)';
            case 'warning':
                return '$(warning)';
            case 'info':
                return '$(info)';
            case 'hint':
                return '$(lightbulb)';
            default:
                return '$(info)';
        }
    }
    /**
     * Show the sidebar
     */
    show() {
        vscode.commands.executeCommand('morse.optimize.showSidebar');
    }
}
exports.OptimizeSidebarProvider = OptimizeSidebarProvider;
/**
 * Register the optimize sidebar
 */
function registerOptimizeSidebar(context) {
    const provider = new OptimizeSidebarProvider(context);
    // Register tree data provider
    context.subscriptions.push(vscode.window.registerTreeDataProvider('morseOptimize', provider));
    // Register click handler for issues
    context.subscriptions.push(vscode.commands.registerCommand('morse.optimize.selectIssue', async (item) => {
        if (item.issue) {
            const issue = item.issue;
            // Open file and go to line
            const document = await vscode.workspace.openTextDocument(issue.filePath);
            const editor = await vscode.window.showTextDocument(document);
            const startPos = new vscode.Position(issue.startLine - 1, issue.startColumn);
            editor.selection = new vscode.Selection(startPos, startPos);
            editor.revealRange(new vscode.Range(startPos, startPos), vscode.TextEditorRevealType.InCenter);
            // Show issue details
            const fixAvailable = issue.codeAfter ? ' (Auto-fix available)' : '';
            const actions = [];
            if (issue.codeAfter) {
                actions.push('Apply Fix');
            }
            actions.push('Copy Description', 'Dismiss');
            const choice = await vscode.window.showInformationMessage(`${issue.title}${fixAvailable}`, { modal: true }, ...actions);
            if (choice === 'Apply Fix' && issue.codeAfter) {
                await vscode.commands.executeCommand('morse.optimize.fix', issue.id);
            }
            else if (choice === 'Copy Description') {
                await vscode.env.clipboard.writeText(issue.description);
            }
        }
    }));
    return provider;
}
//# sourceMappingURL=sidebar.js.map