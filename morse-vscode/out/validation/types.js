"use strict";
/**
 * Morse Code Validation Pipeline
 * Provides comprehensive validation for code files including syntax, security, tests, lint, and dependencies
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_VALIDATION_STAGES = exports.DEFAULT_VALIDATION_CONFIG = void 0;
/**
 * Default validation configuration
 */
exports.DEFAULT_VALIDATION_CONFIG = {
    enabled: true,
    stages: {
        syntax: true,
        security: true,
        tests: true,
        lint: true,
        dependency: true,
    },
    stageTimeout: 30000,
    runOnSave: true,
    runOnChange: false,
    maxParallelFiles: 5,
    showStatusBar: true,
    showInProblems: true,
};
/**
 * Default validation stages
 */
exports.DEFAULT_VALIDATION_STAGES = [
    {
        name: 'Syntax',
        type: 'syntax',
        enabled: true,
        timeout: 10000,
        rules: [
            { id: 'syntax-parse', description: 'Parse errors', severity: 'error', enabled: true },
        ],
    },
    {
        name: 'Security',
        type: 'security',
        enabled: true,
        timeout: 15000,
        rules: [
            { id: 'sec-dangerous-command', description: 'Dangerous command detection', severity: 'error', enabled: true },
            { id: 'sec-path-traversal', description: 'Path traversal prevention', severity: 'error', enabled: true },
            { id: 'sec-hardcoded-secrets', description: 'Hardcoded secrets', severity: 'warning', enabled: true },
            { id: 'sec-insecure-random', description: 'Insecure random', severity: 'warning', enabled: true },
        ],
    },
    {
        name: 'Tests',
        type: 'tests',
        enabled: true,
        timeout: 30000,
        rules: [
            { id: 'test-existence', description: 'Test file existence', severity: 'warning', enabled: true },
            { id: 'test-coverage', description: 'Test coverage', severity: 'info', enabled: false },
        ],
    },
    {
        name: 'Lint',
        type: 'lint',
        enabled: true,
        timeout: 20000,
        rules: [
            { id: 'lint-eslint', description: 'ESLint validation', severity: 'warning', enabled: true },
            { id: 'lint-tsc', description: 'TypeScript compilation', severity: 'error', enabled: true },
        ],
    },
    {
        name: 'Dependency',
        type: 'dependency',
        enabled: true,
        timeout: 15000,
        rules: [
            { id: 'dep-package-json', description: 'package.json integrity', severity: 'error', enabled: true },
            { id: 'dep-vulnerabilities', description: 'Security vulnerabilities', severity: 'error', enabled: true },
            { id: 'dep-outdated', description: 'Outdated dependencies', severity: 'info', enabled: false },
        ],
    },
];
//# sourceMappingURL=types.js.map