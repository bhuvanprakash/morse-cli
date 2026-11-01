"use strict";
/**
 * Optimize Commands for Morse VS Code Extension
 * Registers all optimize-related commands
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
exports.registerOptimizeCommands = registerOptimizeCommands;
const vscode = __importStar(require("vscode"));
const service_1 = require("./service");
const planActMode_1 = require("../state/planActMode");
/**
 * Get or create the optimize service
 */
let optimizeService;
function getOptimizeService(client) {
    if (!optimizeService) {
        optimizeService = new service_1.OptimizeService(client);
    }
    return optimizeService;
}
/**
 * Register all optimize commands
 */
function registerOptimizeCommands(context, client, sidebarProvider) {
    const service = getOptimizeService(client);
    // Subscribe to progress events
    const progressSubscription = service.onProgress((progress) => {
        if (progress.status === 'complete') {
            vscode.window.setStatusBarMessage(`Morse: ${progress.message}`, 3000);
        }
    });
    context.subscriptions.push(progressSubscription);
    // Optimize file command
    context.subscriptions.push(vscode.commands.registerCommand('morse.optimize.file', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('No active editor');
            return;
        }
        const document = editor.document;
        const analysisTypes = await promptForAnalysisType();
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Morse: Optimizing file...',
            cancellable: true,
        }, async () => {
            try {
                const result = await service.optimizeFile(document, analysisTypes);
                showResults(result, service, sidebarProvider);
            }
            catch (err) {
                const message = err instanceof Error ? err.message : 'Unknown error';
                vscode.window.showErrorMessage(`Optimization failed: ${message}`);
            }
        });
    }));
    // Optimize selection command
    context.subscriptions.push(vscode.commands.registerCommand('morse.optimize.selection', async () => {
        if ((0, planActMode_1.isPlanMode)()) {
            const choice = await vscode.window.showWarningMessage('Plan mode is read-only. Switch to Act to allow applying code changes?', { modal: true }, 'Switch to Act', 'Cancel');
            if (choice !== 'Switch to Act')
                return;
            await (0, planActMode_1.setPlanActMode)('act');
        }
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('No active editor');
            return;
        }
        const document = editor.document;
        const selection = editor.selection;
        if (selection.isEmpty) {
            vscode.window.showWarningMessage('Please select code to optimize');
            return;
        }
        const code = document.getText(selection);
        const filePath = document.fileName;
        const language = document.languageId;
        const analysisTypes = await promptForAnalysisType();
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Morse: Optimizing selection...',
            cancellable: true,
        }, async () => {
            try {
                const result = await service.analyzeSelection(code, language, filePath, analysisTypes);
                showResults(result, service, sidebarProvider);
            }
            catch (err) {
                const message = err instanceof Error ? err.message : 'Unknown error';
                vscode.window.showErrorMessage(`Optimization failed: ${message}`);
            }
        });
    }));
    // Optimize project command
    context.subscriptions.push(vscode.commands.registerCommand('morse.optimize.project', async () => {
        if ((0, planActMode_1.isPlanMode)()) {
            const choice = await vscode.window.showWarningMessage('Plan mode is read-only. Switch to Act to allow applying code changes?', { modal: true }, 'Switch to Act', 'Cancel');
            if (choice !== 'Switch to Act')
                return;
            await (0, planActMode_1.setPlanActMode)('act');
        }
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showWarningMessage('No workspace folder found');
            return;
        }
        const analysisTypes = await promptForAnalysisType();
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Morse: Optimizing project...',
            cancellable: true,
        }, async (progress, token) => {
            try {
                const results = await service.optimizeProject(workspaceFolder, analysisTypes);
                // Show summary notification
                const totalIssues = results.reduce((sum, r) => sum + r.issues.length, 0);
                const errors = results.reduce((sum, r) => sum + r.summary.errors, 0);
                const warnings = results.reduce((sum, r) => sum + r.summary.warnings, 0);
                if (errors > 0) {
                    vscode.window.showErrorMessage(`Project optimization complete: ${errors} errors, ${warnings} warnings in ${results.length} files`);
                }
                else if (warnings > 0) {
                    vscode.window.showWarningMessage(`Project optimization complete: ${warnings} warnings in ${results.length} files`);
                }
                else {
                    vscode.window.showInformationMessage(`Project optimization complete: No issues found in ${results.length} files`);
                }
                // Update sidebar if available
                if (sidebarProvider) {
                    sidebarProvider.showResults(results);
                }
            }
            catch (err) {
                const message = err instanceof Error ? err.message : 'Unknown error';
                vscode.window.showErrorMessage(`Project optimization failed: ${message}`);
            }
        });
    }));
    // Analyze command (read-only)
    context.subscriptions.push(vscode.commands.registerCommand('morse.optimize.analyze', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('No active editor');
            return;
        }
        const document = editor.document;
        const analysisTypes = await promptForAnalysisType();
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Morse: Analyzing code...',
            cancellable: true,
        }, async () => {
            try {
                const result = await service.optimizeFile(document, analysisTypes);
                // Show results in Problems view
                showInProblemsView(result);
                vscode.window.showInformationMessage(`Analysis complete: ${result.summary.errors} errors, ${result.summary.warnings} warnings`);
            }
            catch (err) {
                const message = err instanceof Error ? err.message : 'Unknown error';
                vscode.window.showErrorMessage(`Analysis failed: ${message}`);
            }
        });
    }));
    // Fix command - apply suggested fixes
    context.subscriptions.push(vscode.commands.registerCommand('morse.optimize.fix', async (issueId) => {
        if ((0, planActMode_1.isPlanMode)()) {
            const choice = await vscode.window.showWarningMessage('Plan mode is read-only. Switch to Act to allow applying fixes?', { modal: true }, 'Switch to Act', 'Cancel');
            if (choice !== 'Switch to Act')
                return;
            await (0, planActMode_1.setPlanActMode)('act');
        }
        // If no issue ID provided, show quick fix menu
        if (!issueId) {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showWarningMessage('No active editor');
                return;
            }
            const result = service.getResult(editor.document.fileName);
            if (!result || result.issues.length === 0) {
                vscode.window.showInformationMessage('No optimization issues to fix');
                return;
            }
            // Show quick pick for issues with fixes
            const items = result.issues
                .filter(i => i.codeAfter)
                .map(i => ({
                label: i.title,
                description: i.description.substring(0, 50) + '...',
                issue: i,
            }));
            if (items.length === 0) {
                vscode.window.showInformationMessage('No auto-fixable issues found');
                return;
            }
            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: 'Select an issue to fix',
            });
            if (selected) {
                await service.applyFix(selected.issue);
                vscode.window.showInformationMessage(`Fixed: ${selected.issue.title}`);
            }
        }
        else {
            // Apply specific fix
            const allResults = service.getAllResults();
            for (const [, result] of allResults) {
                const issue = result.issues.find(i => i.id === issueId);
                if (issue) {
                    await service.applyFix(issue);
                    vscode.window.showInformationMessage(`Fixed: ${issue.title}`);
                    return;
                }
            }
            vscode.window.showWarningMessage('Issue not found');
        }
    }));
    // Clear results command
    context.subscriptions.push(vscode.commands.registerCommand('morse.optimize.clear', () => {
        service.clearResults();
        if (sidebarProvider) {
            sidebarProvider.clearResults();
        }
        vscode.window.setStatusBarMessage('Morse: Optimization results cleared', 2000);
    }));
    // Open sidebar command
    context.subscriptions.push(vscode.commands.registerCommand('morse.optimize.showSidebar', () => {
        if (sidebarProvider) {
            sidebarProvider.show();
        }
    }));
}
/**
 * Prompt user for analysis type
 */
async function promptForAnalysisType() {
    const items = [
        { label: 'Full Analysis', description: 'All optimization types' },
        { label: 'Performance', description: 'Performance and complexity issues' },
        { label: 'Security', description: 'Security vulnerabilities' },
        { label: 'Code Quality', description: 'Best practices and maintainability' },
        { label: 'Dead Code', description: 'Unused code detection' },
        { label: 'Imports', description: 'Import optimization' },
    ];
    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select analysis type',
    });
    if (!selected) {
        return ['full'];
    }
    switch (selected.label) {
        case 'Full Analysis':
            return ['full'];
        case 'Performance':
            return ['performance'];
        case 'Security':
            return ['security'];
        case 'Code Quality':
            return ['code-quality'];
        case 'Dead Code':
            return ['dead-code'];
        case 'Imports':
            return ['imports'];
        default:
            return ['full'];
    }
}
/**
 * Show optimization results
 */
function showResults(result, service, sidebarProvider) {
    // Show in Problems view
    showInProblemsView(result);
    // Show sidebar if available
    if (sidebarProvider) {
        sidebarProvider.showResults([result]);
    }
    // Show notification
    const { errors, warnings, info, hints } = result.summary;
    const total = errors + warnings + info + hints;
    if (errors > 0) {
        vscode.window.showErrorMessage(`Optimization found ${errors} errors, ${warnings} warnings`);
    }
    else if (warnings > 0) {
        vscode.window.showWarningMessage(`Optimization found ${warnings} warnings, ${info} info`);
    }
    else if (total > 0) {
        vscode.window.showInformationMessage(`Optimization found ${total} suggestions`);
    }
    else {
        vscode.window.showInformationMessage('No optimization issues found');
    }
}
/**
 * Show results in VS Code Problems view
 */
function showInProblemsView(result) {
    // Clear existing optimization problems
    const diagnosticCollection = vscode.languages.createDiagnosticCollection('morse-optimize');
    const diagnostics = result.issues.map(issue => {
        const range = new vscode.Range(new vscode.Position(issue.startLine - 1, issue.startColumn), new vscode.Position(issue.endLine - 1, issue.endColumn));
        const severity = mapSeverity(issue.severity);
        const diagnostic = new vscode.Diagnostic(range, issue.description, severity);
        diagnostic.code = issue.rule;
        diagnostic.source = 'Morse Optimize';
        return diagnostic;
    });
    diagnosticCollection.set(vscode.Uri.file(result.filePath), diagnostics);
    // Auto-show problems view
    vscode.commands.executeCommand('workbench.actions.view.problems');
}
/**
 * Map severity to VS Code DiagnosticSeverity
 */
function mapSeverity(severity) {
    switch (severity) {
        case 'error':
            return vscode.DiagnosticSeverity.Error;
        case 'warning':
            return vscode.DiagnosticSeverity.Warning;
        case 'info':
            return vscode.DiagnosticSeverity.Information;
        case 'hint':
            return vscode.DiagnosticSeverity.Hint;
        default:
            return vscode.DiagnosticSeverity.Information;
    }
}
//# sourceMappingURL=commands.js.map