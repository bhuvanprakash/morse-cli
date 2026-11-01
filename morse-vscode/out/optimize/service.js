"use strict";
/**
 * Optimization Service for Morse VS Code Extension
 * Handles code analysis and optimization through the Morse CLI
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
exports.OptimizeService = void 0;
const vscode = __importStar(require("vscode"));
/**
 * Service for handling code optimization
 */
class OptimizeService {
    client;
    config;
    results = new Map();
    progressEmitter = new vscode.EventEmitter();
    onProgress = this.progressEmitter.event;
    constructor(client) {
        this.client = client;
        this.config = this.loadConfig();
    }
    /**
     * Load optimization configuration from VS Code settings
     */
    loadConfig() {
        const config = vscode.workspace.getConfiguration('morse');
        const optimizeConfig = config.get('optimize') || {};
        return {
            enabled: optimizeConfig.enabled ?? true,
            analysisTypes: optimizeConfig.analysisTypes ?? ['full'],
            autoFix: optimizeConfig.autoFix ?? false,
            showSidebar: optimizeConfig.showSidebar ?? true,
            notificationLevel: optimizeConfig.notificationLevel ?? 'all',
            runOnSave: optimizeConfig.runOnSave ?? false,
            maxIssues: optimizeConfig.maxIssues ?? 100,
        };
    }
    /**
     * Reload configuration
     */
    reloadConfig() {
        this.config = this.loadConfig();
    }
    /**
     * Get current configuration
     */
    getConfig() {
        return this.config;
    }
    /**
     * Analyze code in the current selection
     */
    async analyzeSelection(code, language, filePath, analysisTypes = ['full']) {
        const startTime = Date.now();
        this.progressEmitter.fire({
            status: 'analyzing',
            message: 'Analyzing selected code...',
            progress: 0
        });
        try {
            // Try to use CLI for optimization if available
            const result = await this.optimizeViaCLI(code, language, filePath, analysisTypes, startTime);
            this.results.set(filePath, result);
            this.progressEmitter.fire({
                status: 'complete',
                message: 'Analysis complete',
                progress: 100
            });
            return result;
        }
        catch (error) {
            // Fallback to local analysis
            const result = this.analyzeLocally(code, language, filePath, analysisTypes, startTime);
            this.results.set(filePath, result);
            this.progressEmitter.fire({
                status: 'complete',
                message: 'Analysis complete',
                progress: 100
            });
            return result;
        }
    }
    /**
     * Optimize the current file
     */
    async optimizeFile(document, analysisTypes = ['full']) {
        const startTime = Date.now();
        const filePath = document.fileName;
        const code = document.getText();
        const language = document.languageId;
        this.progressEmitter.fire({
            status: 'analyzing',
            currentFile: filePath,
            message: `Analyzing ${filePath}...`,
            progress: 0
        });
        try {
            const result = await this.optimizeViaCLI(code, language, filePath, analysisTypes, startTime);
            if (this.config.autoFix && result.issues.length > 0) {
                this.progressEmitter.fire({
                    status: 'fixing',
                    message: 'Applying fixes...',
                    progress: 50
                });
                await this.applyFixes(document, result);
            }
            this.results.set(filePath, result);
            this.progressEmitter.fire({
                status: 'complete',
                currentFile: filePath,
                message: `Found ${result.issues.length} issues`,
                progress: 100
            });
            return result;
        }
        catch (error) {
            const result = this.analyzeLocally(code, language, filePath, analysisTypes, startTime);
            this.results.set(filePath, result);
            this.progressEmitter.fire({
                status: 'complete',
                currentFile: filePath,
                message: `Found ${result.issues.length} issues`,
                progress: 100
            });
            return result;
        }
    }
    /**
     * Run full project optimization
     */
    async optimizeProject(workspaceFolder, analysisTypes = ['full']) {
        const results = [];
        const files = await vscode.workspace.findFiles(new vscode.RelativePattern(workspaceFolder, '**/*.{ts,tsx,js,jsx,go,py,java}'), '**/node_modules/**');
        const totalFiles = files.length;
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            this.progressEmitter.fire({
                status: 'analyzing',
                currentFile: file.fsPath,
                progress: Math.round((i / totalFiles) * 100),
                totalFiles,
                message: `Analyzing ${i + 1}/${totalFiles}: ${file.fsPath}`
            });
            try {
                const document = await vscode.workspace.openTextDocument(file);
                const result = await this.optimizeFile(document, analysisTypes);
                results.push(result);
            }
            catch (error) {
                console.error(`Failed to optimize ${file.fsPath}:`, error);
            }
        }
        this.progressEmitter.fire({
            status: 'complete',
            message: `Project analysis complete. Analyzed ${results.length} files`,
            progress: 100
        });
        return results;
    }
    /**
     * Try to optimize via CLI
     */
    async optimizeViaCLI(code, language, filePath, analysisTypes, startTime) {
        try {
            const result = await this.client.sendCommand('optimize', {
                code,
                language,
                filePath,
                analysisTypes,
            });
            return {
                analysisType: analysisTypes.includes('full') ? 'full' : analysisTypes[0],
                filePath,
                issues: this.convertCLIResult(result),
                summary: this.calculateSummary(this.convertCLIResult(result)),
                timestamp: new Date().toISOString(),
                duration: Date.now() - startTime,
            };
        }
        catch (error) {
            throw new Error(`CLI optimization failed: ${error}`);
        }
    }
    /**
     * Fallback local analysis
     */
    analyzeLocally(code, language, filePath, analysisTypes, startTime) {
        const issues = [];
        // Run different analysis types
        if (analysisTypes.includes('performance') || analysisTypes.includes('full')) {
            issues.push(...this.analyzePerformance(code, filePath));
        }
        if (analysisTypes.includes('security') || analysisTypes.includes('full')) {
            issues.push(...this.analyzeSecurity(code, filePath));
        }
        if (analysisTypes.includes('dead-code') || analysisTypes.includes('full')) {
            issues.push(...this.analyzeDeadCode(code, filePath));
        }
        if (analysisTypes.includes('imports') || analysisTypes.includes('full')) {
            issues.push(...this.analyzeImports(code, filePath, language));
        }
        if (analysisTypes.includes('code-quality') || analysisTypes.includes('full')) {
            issues.push(...this.analyzeCodeQuality(code, filePath, language));
        }
        return {
            analysisType: analysisTypes.includes('full') ? 'full' : analysisTypes[0],
            filePath,
            issues,
            summary: this.calculateSummary(issues),
            timestamp: new Date().toISOString(),
            duration: Date.now() - startTime,
        };
    }
    /**
     * Analyze performance issues
     */
    analyzePerformance(code, filePath) {
        const issues = [];
        const lines = code.split('\n');
        lines.forEach((line, index) => {
            // Detect nested loops that could be optimized
            if (line.includes('for') && lines.slice(index + 1, index + 5).some(l => l.includes('for'))) {
                issues.push({
                    id: `perf-nested-loop-${index}`,
                    title: 'Nested loop detected',
                    description: 'Nested loops can lead to O(n²) or worse time complexity. Consider using a different algorithm or data structure.',
                    category: 'performance',
                    severity: 'warning',
                    filePath,
                    startLine: index + 1,
                    endLine: index + 1,
                    startColumn: line.indexOf('for'),
                    endColumn: line.indexOf('for') + 3,
                    suggestion: 'Consider using a hash map or set to reduce complexity.',
                    rule: 'perf/nested-loops',
                    effort: 'medium',
                });
            }
            // Detect string concatenation in loop
            if (line.includes('for') && (lines.slice(index + 1, index + 10).some(l => l.includes('+=') && l.includes('"')))) {
                issues.push({
                    id: `perf-string-concat-${index}`,
                    title: 'String concatenation in loop',
                    description: 'String concatenation with += in a loop creates new string objects each iteration. Use StringBuilder or array join instead.',
                    category: 'performance',
                    severity: 'warning',
                    filePath,
                    startLine: index + 1,
                    endLine: index + 1,
                    startColumn: 0,
                    endColumn: line.length,
                    suggestion: 'Use StringBuilder (Java), StringBuffer, or array join (JS) instead.',
                    rule: 'perf/string-concat',
                    effort: 'low',
                });
            }
        });
        return issues;
    }
    /**
     * Analyze security issues
     */
    analyzeSecurity(code, filePath) {
        const issues = [];
        const lines = code.split('\n');
        lines.forEach((line, index) => {
            // Detect hardcoded secrets
            if (/password\s*=\s*["'][^"']+["']/i.test(line) || /api[_-]?key\s*=\s*["'][^"']+["']/i.test(line)) {
                issues.push({
                    id: `sec-hardcoded-secret-${index}`,
                    title: 'Hardcoded secret detected',
                    description: 'Hardcoded passwords or API keys pose a security risk. Use environment variables or secure vaults instead.',
                    category: 'security',
                    severity: 'error',
                    filePath,
                    startLine: index + 1,
                    endLine: index + 1,
                    startColumn: line.indexOf('password') || line.indexOf('api'),
                    endColumn: line.length,
                    suggestion: 'Use process.env or environment variables instead.',
                    rule: 'security/hardcoded-secrets',
                    effort: 'medium',
                });
            }
            // Detect eval usage
            if (line.includes('eval(') || line.includes('exec(')) {
                issues.push({
                    id: `sec-eval-${index}`,
                    title: 'Use of eval detected',
                    description: 'Using eval() can lead to code injection vulnerabilities.',
                    category: 'security',
                    severity: 'error',
                    filePath,
                    startLine: index + 1,
                    endLine: index + 1,
                    startColumn: line.indexOf('eval'),
                    endColumn: line.indexOf('eval') + 4,
                    suggestion: 'Avoid eval(). Use JSON.parse() for JSON or safer alternatives.',
                    rule: 'security/no-eval',
                    effort: 'medium',
                });
            }
            // Detect SQL injection risk
            if (/query\s*=\s*.*\+.*['"]/.test(line) || /execute\s*\(.*\+.*['"]/.test(line)) {
                if (line.toLowerCase().includes('sql') || line.toLowerCase().includes('select') || line.toLowerCase().includes('insert')) {
                    issues.push({
                        id: `sec-sql-injection-${index}`,
                        title: 'Potential SQL injection',
                        description: 'String concatenation in SQL queries can lead to SQL injection attacks.',
                        category: 'security',
                        severity: 'error',
                        filePath,
                        startLine: index + 1,
                        endLine: index + 1,
                        startColumn: 0,
                        endColumn: line.length,
                        suggestion: 'Use parameterized queries or prepared statements.',
                        rule: 'security/no-sql-injection',
                        effort: 'medium',
                    });
                }
            }
        });
        return issues;
    }
    /**
     * Analyze dead code
     */
    analyzeDeadCode(code, filePath) {
        const issues = [];
        const lines = code.split('\n');
        lines.forEach((line, index) => {
            // Detect unused variables (simple pattern)
            const unusedVarMatch = line.match(/^(?:const|let|var)\s+(\w+)\s*=.*;?\s*\/\/\s*unused/i);
            if (unusedVarMatch) {
                issues.push({
                    id: `dead-unused-var-${index}`,
                    title: 'Unused variable',
                    description: `Variable '${unusedVarMatch[1]}' appears to be unused.`,
                    category: 'dead-code',
                    severity: 'info',
                    filePath,
                    startLine: index + 1,
                    endLine: index + 1,
                    startColumn: 0,
                    endColumn: line.length,
                    suggestion: 'Remove the unused variable or prefix with underscore.',
                    rule: 'no-unused-vars',
                    effort: 'low',
                });
            }
            // Detect unreachable code
            if (line.includes('return') && index < lines.length - 1) {
                const nextLine = lines[index + 1]?.trim();
                if (nextLine && !nextLine.startsWith('//') && !nextLine.startsWith('/*') && !nextLine.startsWith('*')) {
                    // Check if it's a simple early return pattern (not a block end)
                    if (!line.includes('}') && !nextLine.startsWith('}')) {
                        // This is a potential unreachable code issue
                    }
                }
            }
        });
        return issues;
    }
    /**
     * Analyze imports
     */
    analyzeImports(code, filePath, language) {
        const issues = [];
        if (!['typescript', 'javascript', 'javascriptreact', 'typescriptreact'].includes(language)) {
            return issues;
        }
        const lines = code.split('\n');
        const importMap = new Map();
        lines.forEach((line, index) => {
            // Detect duplicate imports
            const importMatch = line.match(/import\s+.*\s+from\s+['"]([^'"]+)['"]/);
            if (importMatch) {
                const module = importMatch[1];
                if (importMap.has(module)) {
                    issues.push({
                        id: `imp-duplicate-${index}`,
                        title: 'Duplicate import',
                        description: `Module '${module}' is imported multiple times.`,
                        category: 'import',
                        severity: 'warning',
                        filePath,
                        startLine: index + 1,
                        endLine: index + 1,
                        startColumn: 0,
                        endColumn: line.length,
                        suggestion: 'Combine imports from the same module.',
                        rule: 'import/no-duplicates',
                        effort: 'low',
                    });
                }
                else {
                    importMap.set(module, index);
                }
            }
            // Detect unused imports (simple check)
            const defaultImport = line.match(/import\s+(\w+)\s+from/);
            if (defaultImport) {
                const varName = defaultImport[1];
                const otherLines = lines.filter((_, i) => i !== index).join(' ');
                if (!otherLines.includes(varName)) {
                    issues.push({
                        id: `imp-unused-${index}`,
                        title: 'Unused import',
                        description: `Import '${varName}' appears to be unused.`,
                        category: 'import',
                        severity: 'info',
                        filePath,
                        startLine: index + 1,
                        endLine: index + 1,
                        startColumn: 0,
                        endColumn: line.length,
                        suggestion: 'Remove the unused import.',
                        rule: 'import/no-unused-imports',
                        effort: 'low',
                    });
                }
            }
        });
        return issues;
    }
    /**
     * Analyze code quality
     */
    analyzeCodeQuality(code, filePath, language) {
        const issues = [];
        const lines = code.split('\n');
        const maxLineLength = 120;
        lines.forEach((line, index) => {
            // Check line length
            if (line.length > maxLineLength) {
                issues.push({
                    id: `qual-line-length-${index}`,
                    title: 'Line too long',
                    description: `Line has ${line.length} characters, which exceeds the recommended ${maxLineLength}.`,
                    category: 'maintainability',
                    severity: 'info',
                    filePath,
                    startLine: index + 1,
                    endLine: index + 1,
                    startColumn: 0,
                    endColumn: line.length,
                    suggestion: 'Break the line into multiple lines.',
                    rule: 'max-len',
                    effort: 'low',
                });
            }
            // Check for TODO without description
            if (line.includes('TODO') && !line.includes(':')) {
                issues.push({
                    id: `qual-todo-${index}`,
                    title: 'TODO without description',
                    description: 'TODO comment should include a description or ticket number.',
                    category: 'best-practice',
                    severity: 'hint',
                    filePath,
                    startLine: index + 1,
                    endLine: index + 1,
                    startColumn: line.indexOf('TODO'),
                    endColumn: line.indexOf('TODO') + 4,
                    suggestion: 'Add a description: TODO: description or TODO(username): description',
                    rule: 'todo',
                    effort: 'low',
                });
            }
            // Detect console.log in production code
            if (language.includes('javascript') || language.includes('typescript')) {
                if (line.includes('console.log') || line.includes('console.error')) {
                    issues.push({
                        id: `qual-console-${index}`,
                        title: 'Console statement detected',
                        description: 'Console statements should be removed in production code.',
                        category: 'best-practice',
                        severity: 'warning',
                        filePath,
                        startLine: index + 1,
                        endLine: index + 1,
                        startColumn: line.indexOf('console'),
                        endColumn: line.indexOf('console') + 7,
                        suggestion: 'Use a proper logging library or remove in production.',
                        rule: 'no-console',
                        effort: 'low',
                    });
                }
            }
        });
        return issues;
    }
    /**
     * Convert CLI result to internal format
     */
    convertCLIResult(result) {
        if (!result || !result.issues) {
            return [];
        }
        return result.issues.map((issue) => ({
            id: issue.id || `issue-${Math.random().toString(36).substr(2, 9)}`,
            title: issue.title || 'Unknown issue',
            description: issue.description || '',
            category: issue.category || 'best-practice',
            severity: issue.severity || 'info',
            filePath: issue.filePath || '',
            startLine: issue.startLine || 1,
            endLine: issue.endLine || 1,
            startColumn: issue.startColumn || 0,
            endColumn: issue.endColumn || 0,
            suggestion: issue.suggestion || '',
            codeBefore: issue.codeBefore,
            codeAfter: issue.codeAfter,
            rule: issue.rule,
            effort: issue.effort,
        }));
    }
    /**
     * Calculate summary from issues
     */
    calculateSummary(issues) {
        return {
            totalIssues: issues.length,
            errors: issues.filter(i => i.severity === 'error').length,
            warnings: issues.filter(i => i.severity === 'warning').length,
            info: issues.filter(i => i.severity === 'info').length,
            hints: issues.filter(i => i.severity === 'hint').length,
            fixed: 0,
        };
    }
    /**
     * Apply fixes to a document
     */
    async applyFixes(document, result) {
        const edit = new vscode.WorkspaceEdit();
        for (const issue of result.issues) {
            if (issue.codeAfter && issue.startLine > 0) {
                const startPos = new vscode.Position(issue.startLine - 1, issue.startColumn);
                const endPos = new vscode.Position(issue.endLine - 1, issue.endColumn);
                edit.replace(document.uri, new vscode.Range(startPos, endPos), issue.codeAfter);
            }
        }
        await vscode.workspace.applyEdit(edit);
    }
    /**
     * Get cached result for a file
     */
    getResult(filePath) {
        return this.results.get(filePath);
    }
    /**
     * Get all results
     */
    getAllResults() {
        return this.results;
    }
    /**
     * Clear cached results
     */
    clearResults() {
        this.results.clear();
    }
    /**
     * Apply a single fix
     */
    async applyFix(issue) {
        try {
            const document = await vscode.workspace.openTextDocument(issue.filePath);
            const edit = new vscode.WorkspaceEdit();
            if (issue.codeAfter) {
                const startPos = new vscode.Position(issue.startLine - 1, issue.startColumn);
                const endPos = new vscode.Position(issue.endLine - 1, issue.endColumn);
                edit.replace(document.uri, new vscode.Range(startPos, endPos), issue.codeAfter);
                await vscode.workspace.applyEdit(edit);
                return true;
            }
            return false;
        }
        catch (error) {
            console.error('Failed to apply fix:', error);
            return false;
        }
    }
}
exports.OptimizeService = OptimizeService;
//# sourceMappingURL=service.js.map