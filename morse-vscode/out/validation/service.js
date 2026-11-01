"use strict";
/**
 * Validation Service
 * Main service class for running validation on files
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
exports.ValidationService = void 0;
const vscode = __importStar(require("vscode"));
const types_1 = require("./types");
const pipeline_1 = require("./pipeline");
/**
 * Service for running code validation
 */
class ValidationService {
    pipeline;
    config;
    status = 'idle';
    lastReport = null;
    statusBarItem = null;
    disposables = [];
    diagnosticCollection;
    // Event emitters
    onStatusChangeEmitter = new vscode.EventEmitter();
    onValidationEventEmitter = new vscode.EventEmitter();
    onReportEmitter = new vscode.EventEmitter();
    onStatusChange = this.onStatusChangeEmitter.event;
    onValidationEvent = this.onValidationEventEmitter.event;
    onReport = this.onReportEmitter.event;
    constructor(config) {
        this.config = { ...types_1.DEFAULT_VALIDATION_CONFIG, ...config };
        this.pipeline = new pipeline_1.ValidationPipeline(this.config);
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('morse-validation');
        if (this.config.showStatusBar) {
            this.createStatusBar();
        }
    }
    /**
     * Create the status bar item
     */
    createStatusBar() {
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 105);
        this.statusBarItem.command = 'morse.validate';
        this.statusBarItem.text = '$(check) Validate';
        this.statusBarItem.tooltip = 'Run code validation';
        this.statusBarItem.show();
    }
    /**
     * Update status bar display
     */
    updateStatusBar() {
        if (!this.statusBarItem)
            return;
        switch (this.status) {
            case 'idle':
                this.statusBarItem.text = '$(check) Validate';
                this.statusBarItem.tooltip = 'Run code validation';
                this.statusBarItem.color = undefined;
                break;
            case 'running':
                this.statusBarItem.text = '$(sync) Validating...';
                this.statusBarItem.tooltip = 'Validation in progress...';
                this.statusBarItem.color = new vscode.ThemeColor('editorWarning.foreground');
                break;
            case 'passed':
                this.statusBarItem.text = '$(check) Validated';
                this.statusBarItem.tooltip = 'Validation passed';
                this.statusBarItem.color = new vscode.ThemeColor('testing.iconPassed');
                break;
            case 'failed':
                this.statusBarItem.text = '$(error) Validation Failed';
                this.statusBarItem.tooltip = 'Validation failed - click to see errors';
                this.statusBarItem.color = new vscode.ThemeColor('errorForeground');
                break;
            case 'warnings':
                this.statusBarItem.text = '$(warning) Validation Warnings';
                this.statusBarItem.tooltip = 'Validation passed with warnings';
                this.statusBarItem.color = new vscode.ThemeColor('editorWarning.foreground');
                break;
        }
    }
    /**
     * Set the validation status
     */
    setStatus(status) {
        this.status = status;
        this.onStatusChangeEmitter.fire(status);
        this.updateStatusBar();
    }
    /**
     * Get files to validate from workspace
     */
    async getFilesToValidate() {
        const files = [];
        if (!vscode.workspace.workspaceFolders) {
            return files;
        }
        for (const folder of vscode.workspace.workspaceFolders) {
            const pattern = new vscode.RelativePattern(folder, '**/*.{ts,tsx,js,jsx,py,go,rs,java,json,yaml,yml}');
            const matches = await vscode.workspace.findFiles(pattern, '**/node_modules/**');
            files.push(...matches.map(u => u.fsPath));
        }
        return files;
    }
    /**
     * Run validation on all workspace files
     */
    async validateAll() {
        if (this.status === 'running') {
            vscode.window.showWarningMessage('Validation already in progress');
            throw new Error('Validation already in progress');
        }
        this.setStatus('running');
        this.diagnosticCollection.clear();
        const files = await this.getFilesToValidate();
        if (files.length === 0) {
            const report = {
                results: [],
                passed: true,
                totalErrors: 0,
                totalWarnings: 0,
                totalDuration: 0,
                timestamp: new Date(),
                files: [],
            };
            this.setStatus('passed');
            this.lastReport = report;
            this.onReportEmitter.fire(report);
            return report;
        }
        try {
            const options = {
                files,
                config: this.config,
                onProgress: (event) => {
                    this.onValidationEventEmitter.fire(event);
                },
            };
            const report = await this.pipeline.run(options);
            this.lastReport = report;
            // Update status based on results
            if (report.totalErrors > 0) {
                this.setStatus('failed');
            }
            else if (report.totalWarnings > 0) {
                this.setStatus('warnings');
            }
            else {
                this.setStatus('passed');
            }
            // Add diagnostics to problems panel
            if (this.config.showInProblems) {
                this.addDiagnostics(report);
            }
            this.onReportEmitter.fire(report);
            return report;
        }
        catch (error) {
            this.setStatus('idle');
            throw error;
        }
    }
    /**
     * Run validation on specific files
     */
    async validateFiles(filePaths) {
        if (this.status === 'running') {
            vscode.window.showWarningMessage('Validation already in progress');
            throw new Error('Validation already in progress');
        }
        this.setStatus('running');
        this.diagnosticCollection.clear();
        try {
            const options = {
                files: filePaths,
                config: this.config,
                onProgress: (event) => {
                    this.onValidationEventEmitter.fire(event);
                },
            };
            const report = await this.pipeline.run(options);
            this.lastReport = report;
            // Update status based on results
            if (report.totalErrors > 0) {
                this.setStatus('failed');
            }
            else if (report.totalWarnings > 0) {
                this.setStatus('warnings');
            }
            else {
                this.setStatus('passed');
            }
            // Add diagnostics to problems panel
            if (this.config.showInProblems) {
                this.addDiagnostics(report);
            }
            this.onReportEmitter.fire(report);
            return report;
        }
        catch (error) {
            this.setStatus('idle');
            throw error;
        }
    }
    /**
     * Run validation on the active editor file
     */
    async validateCurrentFile() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('No active editor');
            return null;
        }
        const filePath = editor.document.uri.fsPath;
        return this.validateFiles([filePath]);
    }
    /**
     * Run validation on selected files
     */
    async validateSelected() {
        const selectedFiles = await vscode.window.showOpenDialog({
            canSelectMany: true,
            filters: {
                'Source Files': ['ts', 'tsx', 'js', 'jsx', 'py', 'go', 'rs', 'java'],
                'All Files': ['*'],
            },
        });
        if (!selectedFiles || selectedFiles.length === 0) {
            return null;
        }
        return this.validateFiles(selectedFiles.map(u => u.fsPath));
    }
    /**
     * Add validation results to VS Code's problems panel
     */
    addDiagnostics(report) {
        const diagnosticMap = new Map();
        for (const result of report.results) {
            for (const error of result.errors) {
                // Find the file from metadata or skip
                const files = report.files;
                if (files.length === 0)
                    continue;
                // Get the first file as an example (in real implementation, we'd track file per error)
                const filePath = files[0];
                if (!filePath)
                    continue;
                const existing = diagnosticMap.get(filePath) || [];
                const range = error.range || new vscode.Range(Math.max(0, error.line - 1), Math.max(0, error.column - 1), Math.max(0, error.line - 1), error.column + 100);
                const diagnostic = new vscode.Diagnostic(range, error.message, vscode.DiagnosticSeverity.Error);
                diagnostic.code = error.code;
                diagnostic.source = error.source || 'morse-validation';
                existing.push(diagnostic);
                diagnosticMap.set(filePath, existing);
            }
            for (const warning of result.warnings) {
                const files = report.files;
                if (files.length === 0)
                    continue;
                const filePath = files[0];
                if (!filePath)
                    continue;
                const existing = diagnosticMap.get(filePath) || [];
                const range = warning.range || new vscode.Range(Math.max(0, warning.line - 1), Math.max(0, warning.column - 1), Math.max(0, warning.line - 1), warning.column + 100);
                const diagnostic = new vscode.Diagnostic(range, warning.message, vscode.DiagnosticSeverity.Warning);
                diagnostic.code = warning.code;
                diagnostic.source = warning.source || 'morse-validation';
                existing.push(diagnostic);
                diagnosticMap.set(filePath, existing);
            }
        }
        // Apply diagnostics
        for (const [filePath, diagnostics] of diagnosticMap) {
            this.diagnosticCollection.set(vscode.Uri.file(filePath), diagnostics);
        }
    }
    /**
     * Get the current validation status
     */
    getStatus() {
        return this.status;
    }
    /**
     * Get the last validation report
     */
    getLastReport() {
        return this.lastReport;
    }
    /**
     * Get the current configuration
     */
    getConfig() {
        return this.config;
    }
    /**
     * Update the configuration
     */
    setConfig(config) {
        this.config = { ...this.config, ...config };
        this.pipeline.setConfig(config);
    }
    /**
     * Clear validation results
     */
    clear() {
        this.diagnosticCollection.clear();
        this.lastReport = null;
        this.setStatus('idle');
    }
    /**
     * Show validation results in a webview or message
     */
    showResults() {
        if (!this.lastReport) {
            vscode.window.showInformationMessage('No validation results to show');
            return;
        }
        const report = this.lastReport;
        if (report.passed && report.totalWarnings === 0) {
            vscode.window.showInformationMessage(`✓ Validation passed (${report.totalDuration}ms)`);
        }
        else if (report.passed && report.totalWarnings > 0) {
            vscode.window.showWarningMessage(`⚠ Validation passed with ${report.totalWarnings} warning(s)`);
        }
        else {
            vscode.window.showErrorMessage(`✗ Validation failed: ${report.totalErrors} error(s), ${report.totalWarnings} warning(s)`);
            // Show the Problems panel
            vscode.commands.executeCommand('workbench.actions.view.problems');
        }
    }
    /**
     * Dispose of resources
     */
    dispose() {
        this.disposables.forEach(d => d.dispose());
        this.diagnosticCollection.dispose();
        this.statusBarItem?.dispose();
        this.onStatusChangeEmitter.dispose();
        this.onValidationEventEmitter.dispose();
        this.onReportEmitter.dispose();
    }
}
exports.ValidationService = ValidationService;
//# sourceMappingURL=service.js.map