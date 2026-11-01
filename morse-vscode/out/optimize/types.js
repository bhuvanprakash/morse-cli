"use strict";
/**
 * Optimization Types for Morse VS Code Extension
 * Defines interfaces for code optimization functionality
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
exports.OptimizationTreeItem = void 0;
const vscode = __importStar(require("vscode"));
/**
 * Tree item for the optimization sidebar
 */
class OptimizationTreeItem extends vscode.TreeItem {
    label;
    collapsibleState;
    contextValue;
    issue;
    children;
    constructor(label, collapsibleState, contextValue, issue, children) {
        super(label, collapsibleState);
        this.label = label;
        this.collapsibleState = collapsibleState;
        this.contextValue = contextValue;
        this.issue = issue;
        this.children = children;
        this.contextValue = contextValue;
        if (issue) {
            this.description = issue.severity;
            this.iconPath = this.getIconForSeverity(issue.severity);
        }
    }
    getIconForSeverity(severity) {
        switch (severity) {
            case 'error':
                return new vscode.ThemeIcon('error', new vscode.ThemeColor('problemsErrorIcon.foreground'));
            case 'warning':
                return new vscode.ThemeIcon('warning', new vscode.ThemeColor('problemsWarningIcon.foreground'));
            case 'info':
                return new vscode.ThemeIcon('info', new vscode.ThemeColor('problemsInfoIcon.foreground'));
            case 'hint':
                return new vscode.ThemeIcon('lightbulb', new vscode.ThemeColor('charts.blue'));
        }
    }
}
exports.OptimizationTreeItem = OptimizationTreeItem;
//# sourceMappingURL=types.js.map