"use strict";
/**
 * Morse Test Adapter
 * Test runner support for AI-suggested tests
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
exports.MorseTestAdapter = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const child_process = __importStar(require("child_process"));
class MorseTestAdapter {
    context;
    client;
    testSuites = new Map();
    activeRuns = new Map();
    _onDidGenerateTests = new vscode.EventEmitter();
    _onDidChangeTestResults = new vscode.EventEmitter();
    onDidGenerateTests = this._onDidGenerateTests.event;
    onDidChangeTestResults = this._onDidChangeTestResults.event;
    constructor(context, client) {
        this.context = context;
        this.client = client;
    }
    /**
     * Get the test provider type
     */
    get type() {
        return 'workspace';
    }
    /**
     * Create a test run
     */
    createTestRun(request, cancellation) {
        const run = new MorseTestRun(request, cancellation, this.testSuites, this._onDidChangeTestResults);
        const runId = `run-${Date.now()}`;
        this.activeRuns.set(runId, new vscode.CancellationTokenSource());
        // Associate the cancellation token
        cancellation.onCancellationRequested(() => {
            this.activeRuns.delete(runId);
        });
        return run;
    }
    /**
     * Provide test suites for the workspace
     */
    async provideTestSuites(token) {
        const suites = [];
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders)
            return suites;
        for (const folder of workspaceFolders) {
            await this.scanForTests(folder, suites, token);
        }
        return suites;
    }
    /**
     * Scan workspace for test files
     */
    async scanForTests(folder, suites, token) {
        const config = vscode.workspace.getConfiguration('morse');
        const testPatterns = config.get('testPatterns', [
            '**/*.{test,spec}.{ts,js,tsx,jsx}',
            '**/test/**/*.ts',
            '**/__tests__/**/*.ts'
        ]);
        for (const pattern of testPatterns) {
            if (token.isCancellationRequested)
                break;
            const relPattern = new vscode.RelativePattern(folder, pattern);
            const files = await vscode.workspace.findFiles(relPattern, '**/node_modules/**', 100);
            for (const file of files) {
                if (token.isCancellationRequested)
                    break;
                const parsed = await this.parseTestFile(file);
                if (parsed) {
                    const tests = parsed.tests.map(t => ({
                        id: t.id,
                        name: t.label,
                        file: file.fsPath,
                        line: t.range.start.line,
                        status: 'pending'
                    }));
                    const internalSuite = {
                        id: parsed.id,
                        name: parsed.label,
                        file: file.fsPath,
                        tests,
                        status: 'pending',
                        totalTests: tests.length,
                        passedTests: 0,
                        failedTests: 0
                    };
                    this.testSuites.set(internalSuite.id, internalSuite);
                    suites.push(internalSuite);
                }
            }
        }
    }
    /**
     * Parse a test file to extract test cases
     */
    async parseTestFile(file) {
        try {
            const document = await vscode.workspace.openTextDocument(file);
            const text = document.getText();
            const tests = [];
            if (file.fsPath.endsWith('.ts') || file.fsPath.endsWith('.js')) {
                this.parseJavaScriptTests(text, file, tests);
            }
            else if (file.fsPath.endsWith('.py')) {
                this.parsePythonTests(text, file, tests);
            }
            if (tests.length === 0)
                return null;
            return {
                id: `suite-${file.fsPath}`,
                label: path.basename(file.fsPath),
                tests
            };
        }
        catch (error) {
            console.error('Failed to parse test file:', error);
            return null;
        }
    }
    /**
     * Parse JavaScript/TypeScript test cases
     */
    parseJavaScriptTests(text, file, tests) {
        const itRegex = /(?:it|it\.only|it\.skip|test|test\.only|test\.skip)\s*\(['"`]([^'"`]+)['"`]/g;
        let match;
        while ((match = itRegex.exec(text)) !== null) {
            const testName = match[1];
            const lineNumber = text.substring(0, match.index).split('\n').length - 1;
            tests.push({
                id: `test-${file.fsPath}-${lineNumber}`,
                label: testName,
                uri: file,
                range: new vscode.Range(lineNumber, 0, lineNumber, 0)
            });
        }
    }
    /**
     * Parse Python test cases
     */
    parsePythonTests(text, file, tests) {
        const testMethodRegex = /def\s+(test_\w+)\s*\(/g;
        let match;
        while ((match = testMethodRegex.exec(text)) !== null) {
            const testName = match[1].replace('test_', '').replace(/_/g, ' ');
            const lineNumber = text.substring(0, match.index).split('\n').length - 1;
            tests.push({
                id: `test-${file.fsPath}-${lineNumber}`,
                label: testName,
                uri: file,
                range: new vscode.Range(lineNumber, 0, lineNumber, 0)
            });
        }
    }
    /**
     * Generate AI-suggested tests for a file
     */
    async generateTestsForFile(fileUri) {
        try {
            const document = await vscode.workspace.openTextDocument(fileUri);
            const code = document.getText();
            const prompt = `Analyze this code and suggest test cases:\n\n${code}\n\nGenerate comprehensive unit tests for the main functions.`;
            const response = await this.client.generate({
                messages: [{ role: 'user', content: prompt }]
            });
            if (response && response.content) {
                // Create a test suite with generated tests
                const suite = {
                    id: `ai-suite-${Date.now()}`,
                    name: `AI Generated Tests for ${path.basename(fileUri.fsPath)}`,
                    file: fileUri.fsPath,
                    tests: [],
                    status: 'pending',
                    totalTests: 0,
                    passedTests: 0,
                    failedTests: 0
                };
                // Parse AI response and create test cases
                const testLines = response.content.split('\n').filter(line => line.trim().startsWith('it(') ||
                    line.trim().startsWith('test(') ||
                    line.trim().startsWith('def test_'));
                for (let i = 0; i < testLines.length; i++) {
                    const testCase = {
                        id: `ai-test-${Date.now()}-${i}`,
                        name: testLines[i].trim(),
                        file: fileUri.fsPath,
                        line: 1,
                        status: 'pending'
                    };
                    suite.tests.push(testCase);
                }
                suite.totalTests = suite.tests.length;
                this.testSuites.set(suite.id, suite);
                return suite;
            }
        }
        catch (error) {
            console.error('Failed to generate tests:', error);
        }
        return null;
    }
    /**
     * Run tests with AI assistance
     */
    async runAITests(testIds, options = {}) {
        const config = vscode.workspace.getConfiguration('morse');
        const testCommand = config.get('testCommand', 'npm test');
        const runId = `ai-run-${Date.now()}`;
        const result = {
            id: runId,
            suiteId: testIds[0] || '',
            status: 'passed',
            passed: 0,
            failed: 0,
            duration: 0,
            timestamp: new Date()
        };
        const startTime = Date.now();
        try {
            // Run the test command
            const output = await this.runTestCommand(testCommand);
            // Parse test output
            const parsed = this.parseTestOutput(output);
            result.passed = parsed.passed;
            result.failed = parsed.failed;
            result.status = parsed.failed > 0 ? 'failed' : 'passed';
            // If enabled and there are failures, try AI fixes
            if (options.fixFailures && result.failed > 0) {
                await this.suggestTestFixes(parsed.failures);
            }
        }
        catch (error) {
            result.status = 'errored';
            console.error('Test run failed:', error);
        }
        result.duration = Date.now() - startTime;
        return result;
    }
    /**
     * Run test command and get output
     */
    runTestCommand(command) {
        return new Promise((resolve, reject) => {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            const cwd = workspaceFolders?.[0]?.uri.fsPath || process.cwd();
            child_process.exec(command, { cwd }, (error, stdout, stderr) => {
                if (error && !stdout) {
                    reject(error);
                }
                else {
                    resolve(stdout || stderr);
                }
            });
        });
    }
    /**
     * Parse test command output
     */
    parseTestOutput(output) {
        const failures = [];
        let passed = 0;
        let failed = 0;
        // Try to extract numbers from output
        const passedMatch = output.match(/(\d+)\s+passing|passed:\s*(\d+)/i);
        const failedMatch = output.match(/(\d+)\s+failing|failed:\s*(\d+)/i);
        if (passedMatch) {
            passed = parseInt(passedMatch[1] || passedMatch[2] || '0');
        }
        if (failedMatch) {
            failed = parseInt(failedMatch[1] || failedMatch[2] || '0');
        }
        // Extract failure messages
        const failureLines = output.split('\n').filter(line => line.includes('✗') ||
            line.includes('FAIL') ||
            line.includes('Error:'));
        failures.push(...failureLines);
        return { passed, failed, failures };
    }
    /**
     * Suggest fixes for failing tests using AI
     */
    async suggestTestFixes(failures) {
        if (failures.length === 0)
            return;
        const prompt = `The following tests failed. Analyze the failures and suggest fixes:\n\n${failures.join('\n')}`;
        try {
            const response = await this.client.generate({
                messages: [{ role: 'user', content: prompt }]
            });
            if (response && response.content) {
                // Show the suggestions to the user
                const action = await vscode.window.showInformationMessage('AI Test Fix Suggestions Available', 'View Suggestions', 'Dismiss');
                if (action === 'View Suggestions') {
                    const doc = await vscode.workspace.openTextDocument({
                        content: `# AI Test Fix Suggestions\n\n${response.content}`,
                        language: 'markdown'
                    });
                    await vscode.window.showTextDocument(doc);
                }
            }
        }
        catch (error) {
            console.error('Failed to get AI test fixes:', error);
        }
    }
    /**
     * Get test coverage information
     */
    async getCoverage() {
        const config = vscode.workspace.getConfiguration('morse');
        const enableCoverage = config.get('enableCoverage', false);
        if (!enableCoverage)
            return null;
        // Look for coverage report files
        const coverageFiles = await vscode.workspace.findFiles(new vscode.RelativePattern(vscode.workspace.workspaceFolders?.[0] || '', 'coverage/coverage-summary.json'));
        if (coverageFiles.length === 0)
            return null;
        try {
            const document = await vscode.workspace.openTextDocument(coverageFiles[0]);
            const coverage = JSON.parse(document.getText());
            return {
                lines: coverage.lines?.pct || 0,
                branches: coverage.branches?.pct || 0,
                functions: coverage.functions?.pct || 0,
                statements: coverage.statements?.pct || 0
            };
        }
        catch (error) {
            console.error('Failed to parse coverage:', error);
            return null;
        }
    }
    /**
     * Get all test suites
     */
    getAllTestSuites() {
        return Array.from(this.testSuites.values());
    }
    /**
     * Get test suite by ID
     */
    getTestSuite(id) {
        return this.testSuites.get(id);
    }
    /**
     * Dispose of the test adapter
     */
    dispose() {
        this.activeRuns.forEach((tokenSource) => {
            tokenSource.cancel();
        });
        this.activeRuns.clear();
        this._onDidGenerateTests.dispose();
        this._onDidChangeTestResults.dispose();
    }
}
exports.MorseTestAdapter = MorseTestAdapter;
/**
 * Morse Test Run implementation (internal; not vscode.TestRun)
 */
class MorseTestRun {
    request;
    cancellation;
    suites;
    eventEmitter;
    results = new Map();
    constructor(request, cancellation, suites, eventEmitter) {
        this.request = request;
        this.cancellation = cancellation;
        this.suites = suites;
        this.eventEmitter = eventEmitter;
    }
    started(test) {
        this.results.set(test.id, { status: 'running' });
        this.eventEmitter.fire(this);
    }
    passed(test, duration) {
        this.results.set(test.id, { status: 'passed', duration });
        this.eventEmitter.fire(this);
    }
    failed(test, message, duration) {
        this.results.set(test.id, { status: 'failed', message, duration });
        this.eventEmitter.fire(this);
    }
    skipped(test) {
        this.results.set(test.id, { status: 'skipped' });
        this.eventEmitter.fire(this);
    }
    errored(test, message) {
        this.results.set(test.id, { status: 'errored', message });
        this.eventEmitter.fire(this);
    }
    appendOutput(_output) {
        // optional
    }
    end() {
        this.eventEmitter.fire(this);
    }
}
//# sourceMappingURL=MorseTestAdapter.js.map