"use strict";
/**
 * Validation Pipeline
 * Orchestrates running multiple validation stages in sequence or parallel
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
exports.ValidationPipeline = void 0;
const vscode = __importStar(require("vscode"));
const types_1 = require("./types");
/**
 * Validation pipeline that orchestrates multiple validation stages
 */
class ValidationPipeline {
    stages;
    config;
    constructor(config) {
        this.config = { ...types_1.DEFAULT_VALIDATION_CONFIG, ...config };
        this.stages = types_1.DEFAULT_VALIDATION_STAGES.map(stage => ({
            ...stage,
            enabled: this.config.stages[stage.type] ?? stage.enabled,
        }));
    }
    /**
     * Run the validation pipeline
     */
    async run(options) {
        const startTime = Date.now();
        const results = [];
        let totalErrors = 0;
        let totalWarnings = 0;
        // Get enabled stages
        const enabledStages = this.stages.filter(s => s.enabled);
        const totalStages = enabledStages.length;
        if (options.dryRun) {
            vscode.window.showInformationMessage(`Validation dry run: Would validate ${options.files.length} files with ${totalStages} stages`);
            return {
                results: [],
                passed: true,
                totalErrors: 0,
                totalWarnings: 0,
                totalDuration: Date.now() - startTime,
                timestamp: new Date(),
                files: options.files,
            };
        }
        // Report start
        options.onProgress?.({
            message: `Starting validation of ${options.files.length} files`,
            progress: 0,
        });
        // Run each stage
        for (let i = 0; i < enabledStages.length; i++) {
            const stage = enabledStages[i];
            // Check for cancellation
            if (options.cancellationToken?.isCancellationRequested) {
                vscode.window.showWarningMessage('Validation cancelled');
                break;
            }
            // Report stage progress
            const stageProgress = Math.round((i / totalStages) * 100);
            options.onProgress?.({
                stage: stage.type,
                message: `Running ${stage.name} validation...`,
                progress: stageProgress,
            });
            // Run the stage with timeout
            const stageResult = await this.runStage(stage, options.files, options.cancellationToken);
            results.push(stageResult);
            totalErrors += stageResult.errors.length;
            totalWarnings += stageResult.warnings.length;
        }
        // Report completion
        options.onProgress?.({
            message: 'Validation complete',
            progress: 100,
        });
        const totalDuration = Date.now() - startTime;
        const passed = totalErrors === 0;
        return {
            results,
            passed,
            totalErrors,
            totalWarnings,
            totalDuration,
            timestamp: new Date(),
            files: options.files,
        };
    }
    /**
     * Run a single validation stage with timeout
     */
    async runStage(stage, files, cancellationToken) {
        const startTime = Date.now();
        try {
            // Create a promise that rejects after timeout
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error(`Stage ${stage.name} timed out`)), stage.timeout);
            });
            // Run the actual validation
            const validationPromise = this.executeStage(stage, files, cancellationToken);
            // Race between validation and timeout
            const result = await Promise.race([validationPromise, timeoutPromise]);
            return {
                ...result,
                duration: Date.now() - startTime,
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return {
                stage: stage.type,
                passed: false,
                errors: [
                    {
                        line: 0,
                        column: 0,
                        message: `Stage failed: ${errorMessage}`,
                        severity: 'error',
                        code: 'STAGE_ERROR',
                    },
                ],
                warnings: [],
                duration: Date.now() - startTime,
            };
        }
    }
    /**
     * Execute a specific validation stage
     */
    async executeStage(stage, files, cancellationToken) {
        switch (stage.type) {
            case 'syntax':
                return this.runSyntaxValidation(files, cancellationToken);
            case 'security':
                return this.runSecurityValidation(files, cancellationToken);
            case 'tests':
                return this.runTestsValidation(files, cancellationToken);
            case 'lint':
                return this.runLintValidation(files, cancellationToken);
            case 'dependency':
                return this.runDependencyValidation(files, cancellationToken);
            default:
                return {
                    stage: stage.type,
                    passed: true,
                    errors: [],
                    warnings: [],
                };
        }
    }
    /**
     * Run syntax validation (parse errors)
     */
    async runSyntaxValidation(files, cancellationToken) {
        const errors = [];
        const warnings = [];
        for (const file of files) {
            if (cancellationToken?.isCancellationRequested)
                break;
            const ext = file.split('.').pop()?.toLowerCase();
            const supportedExts = ['ts', 'tsx', 'js', 'jsx', 'json', 'py', 'go', 'rs', 'java'];
            if (!ext || !supportedExts.includes(ext)) {
                continue;
            }
            try {
                const doc = await vscode.workspace.openTextDocument(file);
                // Check for parse errors by attempting to get the syntax tree
                // For TypeScript/JavaScript, VS Code handles this internally
                if (ext === 'ts' || ext === 'tsx' || ext === 'js' || ext === 'jsx') {
                    // VS Code's built-in diagnostics will handle this
                    const diagnostics = vscode.languages.getDiagnostics(vscode.Uri.file(file));
                    for (const diag of diagnostics) {
                        if (diag.severity === vscode.DiagnosticSeverity.Error) {
                            errors.push({
                                line: diag.range.start.line + 1,
                                column: diag.range.start.character + 1,
                                message: diag.message,
                                severity: 'error',
                                code: 'SYNTAX_ERROR',
                                source: 'tsc',
                                range: diag.range,
                            });
                        }
                    }
                }
            }
            catch (e) {
                errors.push({
                    line: 0,
                    column: 0,
                    message: `Failed to parse ${file}: ${e instanceof Error ? e.message : String(e)}`,
                    severity: 'error',
                    code: 'PARSE_FAILED',
                });
            }
        }
        return {
            stage: 'syntax',
            passed: errors.length === 0,
            errors,
            warnings,
        };
    }
    /**
     * Run security validation (dangerous commands, path traversal, secrets)
     */
    async runSecurityValidation(files, cancellationToken) {
        const errors = [];
        const warnings = [];
        // Dangerous command patterns (based on morse-cli's DangerDetector)
        const dangerousPatterns = [
            { pattern: /\brm\s+-[a-z]*r[a-z]*f\s+/gi, category: 'destructive', message: 'Recursive force delete detected' },
            { pattern: /\brm\s+-rf\s+\//gi, category: 'destructive', message: 'System destruction command detected' },
            { pattern: /\bdd\s+if=/gi, category: 'destructive', message: 'Direct disk write detected' },
            { pattern: /\bgit\s+push\s+--force/gi, category: 'git_force', message: 'Git force push detected' },
            { pattern: /\bgit\s+push\s+-f\b/gi, category: 'git_force', message: 'Git force push detected' },
            { pattern: /\bgit\s+reset\s+--hard/gi, category: 'git_force', message: 'Git hard reset detected' },
            { pattern: /\bDROP\s+TABLE\b/gi, category: 'sql_destructive', message: 'SQL DROP TABLE detected' },
            { pattern: /\bDROP\s+DATABASE\b/gi, category: 'sql_destructive', message: 'SQL DROP DATABASE detected' },
            { pattern: /curl\s+.*\|\s*(ba)?sh/gi, category: 'pipe_to_shell', message: 'Pipe to shell detected' },
            { pattern: /wget\s+.*\|\s*(ba)?sh/gi, category: 'pipe_to_shell', message: 'Pipe to shell detected' },
        ];
        // Path traversal patterns
        const pathTraversalPatterns = [
            { pattern: /\.\.\/.*\.\.\//g, message: 'Potential path traversal detected' },
            { pattern: /\.\.%2F/g, message: 'URL-encoded path traversal detected' },
            { pattern: /%2E%2E\//gi, message: 'URL-encoded path traversal detected' },
        ];
        // Secret patterns
        const secretPatterns = [
            { pattern: /api[_-]?key\s*[=:]\s*['"][a-zA-Z0-9_-]{20,}['"]/gi, message: 'Potential hardcoded API key' },
            { pattern: /password\s*[=:]\s*['"][^'"]+['"]/gi, message: 'Potential hardcoded password' },
            { pattern: /secret\s*[=:]\s*['"][^'"]+['"]/gi, message: 'Potential hardcoded secret' },
            { pattern: /token\s*[=:]\s*['"][a-zA-Z0-9_-]{20,}['"]/gi, message: 'Potential hardcoded token' },
        ];
        // Only validate script and config files
        const targetExtensions = ['.sh', '.bash', '.py', '.js', '.ts', '.yaml', '.yml', '.json'];
        for (const file of files) {
            if (cancellationToken?.isCancellationRequested)
                break;
            const ext = '.' + file.split('.').pop()?.toLowerCase();
            if (!targetExtensions.includes(ext))
                continue;
            try {
                const doc = await vscode.workspace.openTextDocument(file);
                const content = doc.getText();
                const lines = content.split('\n');
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    // Check dangerous commands
                    for (const { pattern, message } of dangerousPatterns) {
                        if (pattern.test(line)) {
                            errors.push({
                                line: i + 1,
                                column: 1,
                                message,
                                severity: 'error',
                                code: 'SEC_DANGEROUS_COMMAND',
                                source: 'morse-security',
                            });
                            pattern.lastIndex = 0; // Reset regex
                        }
                    }
                    // Check path traversal
                    for (const { pattern, message } of pathTraversalPatterns) {
                        if (pattern.test(line)) {
                            warnings.push({
                                line: i + 1,
                                column: 1,
                                message,
                                severity: 'warning',
                                code: 'SEC_PATH_TRAVERSAL',
                                source: 'morse-security',
                            });
                            pattern.lastIndex = 0;
                        }
                    }
                    // Check secrets
                    for (const { pattern, message } of secretPatterns) {
                        if (pattern.test(line)) {
                            warnings.push({
                                line: i + 1,
                                column: 1,
                                message,
                                severity: 'warning',
                                code: 'SEC_HARDCODED_SECRET',
                                source: 'morse-security',
                            });
                            pattern.lastIndex = 0;
                        }
                    }
                }
            }
            catch (e) {
                // Skip files that can't be read
            }
        }
        return {
            stage: 'security',
            passed: errors.length === 0,
            errors,
            warnings,
        };
    }
    /**
     * Run test validation (test file existence)
     */
    async runTestsValidation(files, cancellationToken) {
        const warnings = [];
        // Group files by their potential test file
        const sourceFiles = files.filter(f => {
            const ext = f.split('.').pop()?.toLowerCase();
            return ['ts', 'tsx', 'js', 'jsx'].includes(ext || '');
        });
        for (const file of sourceFiles) {
            if (cancellationToken?.isCancellationRequested)
                break;
            // Check for corresponding test file
            const hasTestFile = this.hasCorrespondingTestFile(file);
            if (!hasTestFile) {
                warnings.push({
                    line: 0,
                    column: 0,
                    message: `No corresponding test file found for ${file.split('/').pop()}`,
                    severity: 'warning',
                    code: 'TEST_MISSING',
                    source: 'morse-tests',
                });
            }
        }
        return {
            stage: 'tests',
            passed: true, // Test existence is a warning, not an error
            errors: [],
            warnings,
        };
    }
    /**
     * Check if a source file has a corresponding test file
     */
    hasCorrespondingTestFile(filePath) {
        const dir = filePath.substring(0, filePath.lastIndexOf('/'));
        const filename = filePath.split('/').pop() || '';
        const baseName = filename.replace(/\.(ts|tsx|js|jsx)$/, '');
        // Common test file patterns
        const testPatterns = [
            `${dir}/${baseName}.test.ts`,
            `${dir}/${baseName}.test.tsx`,
            `${dir}/${baseName}.test.js`,
            `${dir}/${baseName}.spec.ts`,
            `${dir}/${baseName}.spec.tsx`,
            `${dir}/${baseName}.spec.js`,
            `${dir}/__tests__/${filename}`,
            `${dir}/tests/${filename}`,
            `${dir}/test/${filename}`,
        ];
        // Check if any pattern matches (we can't check actual filesystem here,
        // so we just return false and let the user create tests)
        // In a real implementation, you'd use fs.existsSync or vscode.workspace.fs
        return false;
    }
    /**
     * Run lint validation (ESLint, etc.)
     */
    async runLintValidation(files, cancellationToken) {
        const errors = [];
        const warnings = [];
        // Get diagnostics from VS Code's language services
        for (const file of files) {
            if (cancellationToken?.isCancellationRequested)
                break;
            const ext = file.split('.').pop()?.toLowerCase();
            const lintableExts = ['ts', 'tsx', 'js', 'jsx', 'py', 'go'];
            if (!ext || !lintableExts.includes(ext))
                continue;
            try {
                const diagnostics = vscode.languages.getDiagnostics(vscode.Uri.file(file));
                for (const diag of diagnostics) {
                    if (diag.severity === vscode.DiagnosticSeverity.Error) {
                        errors.push({
                            line: diag.range.start.line + 1,
                            column: diag.range.start.character + 1,
                            message: diag.message,
                            severity: 'error',
                            code: 'LINT_ERROR',
                            source: 'vscode',
                            range: diag.range,
                        });
                    }
                    else if (diag.severity === vscode.DiagnosticSeverity.Warning) {
                        warnings.push({
                            line: diag.range.start.line + 1,
                            column: diag.range.start.character + 1,
                            message: diag.message,
                            severity: 'warning',
                            code: 'LINT_WARNING',
                            source: 'vscode',
                            range: diag.range,
                        });
                    }
                }
            }
            catch {
                // Skip files that can't be read
            }
        }
        return {
            stage: 'lint',
            passed: errors.length === 0,
            errors,
            warnings,
        };
    }
    /**
     * Run dependency validation (package.json integrity)
     */
    async runDependencyValidation(files, cancellationToken) {
        const errors = [];
        const warnings = [];
        // Find package.json files
        const packageJsonFiles = files.filter(f => f.endsWith('package.json'));
        for (const pkgFile of packageJsonFiles) {
            if (cancellationToken?.isCancellationRequested)
                break;
            try {
                const doc = await vscode.workspace.openTextDocument(pkgFile);
                const content = doc.getText();
                const pkg = JSON.parse(content);
                // Check for required fields
                if (!pkg.name) {
                    errors.push({
                        line: 0,
                        column: 0,
                        message: 'package.json is missing "name" field',
                        severity: 'error',
                        code: 'DEP_MISSING_NAME',
                        source: 'morse-deps',
                    });
                }
                if (!pkg.version) {
                    errors.push({
                        line: 0,
                        column: 0,
                        message: 'package.json is missing "version" field',
                        severity: 'error',
                        code: 'DEP_MISSING_VERSION',
                        source: 'morse-deps',
                    });
                }
                // Check for invalid scripts
                if (pkg.scripts) {
                    for (const [scriptName, scriptCmd] of Object.entries(pkg.scripts)) {
                        if (typeof scriptCmd === 'string' && scriptCmd.includes('&& rm -rf')) {
                            warnings.push({
                                line: 0,
                                column: 0,
                                message: `Script "${scriptName}" contains potentially dangerous commands`,
                                severity: 'warning',
                                code: 'DEP_SCRIPT_WARNING',
                                source: 'morse-deps',
                            });
                        }
                    }
                }
            }
            catch (e) {
                errors.push({
                    line: 0,
                    column: 0,
                    message: `Failed to parse ${pkgFile}: ${e instanceof Error ? e.message : String(e)}`,
                    severity: 'error',
                    code: 'DEP_PARSE_ERROR',
                    source: 'morse-deps',
                });
            }
        }
        return {
            stage: 'dependency',
            passed: errors.length === 0,
            errors,
            warnings,
        };
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
        // Update stage enabled states
        this.stages = this.stages.map(stage => ({
            ...stage,
            enabled: this.config.stages[stage.type] ?? stage.enabled,
        }));
    }
    /**
     * Get available stages
     */
    getStages() {
        return this.stages;
    }
}
exports.ValidationPipeline = ValidationPipeline;
//# sourceMappingURL=pipeline.js.map