"use strict";
/**
 * Morse Mode Types
 *
 * Defines types for the mode switching system in the VS Code extension.
 * Modes define distinct behaviors for the AI assistant:
 * - ask: Answer questions only, no file edits
 * - code: Full editing capabilities
 * - debug: Debugging-focused prompts and tools
 * - architect: Planning and design mode
 * - review: Code review mode
 * - test-engineer: Test generation mode
 * - frontend-specialist: UI development mode
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BUILTIN_MODES = void 0;
exports.getBuiltinModeIds = getBuiltinModeIds;
exports.getBuiltinMode = getBuiltinMode;
exports.isBuiltinMode = isBuiltinMode;
// ==================== Built-in Modes ====================
/**
 * Built-in mode definitions
 */
exports.BUILTIN_MODES = {
    ask: {
        id: 'ask',
        name: 'Ask',
        description: 'Answer questions and explain code',
        icon: '$(question)',
        instructions: `You are in Ask mode. Your role is to:
1. Answer questions about the codebase
2. Explain how code works
3. Provide information and analysis
4. Never modify files unless explicitly requested

You have read-only access to files. Use tools like ReadFile, Grep, Glob, and WebFetch to gather information.`,
        tools: ['read', 'grep', 'glob', 'webFetch', 'fetch', 'searchCode'],
        welcomeMessage: '## Ask Mode\n\nI can answer questions about your codebase, explain code, and provide information. What would you like to know?',
        allowEdits: false,
        autoApprove: false,
        contextLimit: 100000,
    },
    code: {
        id: 'code',
        name: 'Code',
        description: 'Full editing capabilities',
        icon: '$(edit)',
        instructions: `You are in Code mode. Your role is to:
1. Write and edit code
2. Implement features
3. Fix bugs
4. Refactor existing code

You have full access to all tools including file editing. Use ReadFile, WriteFile, Patch, Bash, and other tools to accomplish tasks.`,
        tools: ['read', 'write', 'patch', 'glob', 'grep', 'bash', 'executeCommand', 'browser', 'fetch', 'webFetch'],
        welcomeMessage: '## Code Mode\n\nI can help you write, edit, and refactor code. What would you like to build or fix?',
        allowEdits: true,
        autoApprove: true,
        contextLimit: 200000,
    },
    debug: {
        id: 'debug',
        name: 'Debug',
        description: 'Debug and fix issues',
        icon: '$(debug)',
        instructions: `You are in Debug mode. Your role is to:
1. Reproduce and understand bugs
2. Analyze error messages and stack traces
3. Identify root causes
4. Fix issues and add tests

Focus on thorough investigation. Use debugging tools, read logs, and test fixes carefully.`,
        tools: ['read', 'grep', 'glob', 'bash', 'executeCommand', 'patch', 'browser'],
        welcomeMessage: '## Debug Mode\n\nI can help you debug issues. Describe the problem or error you\'re seeing, and I\'ll help investigate and fix it.',
        allowEdits: true,
        autoApprove: false,
        contextLimit: 150000,
    },
    architect: {
        id: 'architect',
        name: 'Architect',
        description: 'Plan and design software',
        icon: '$(diagram)',
        instructions: `You are in Architect mode. Your role is to:
1. Analyze requirements and design systems
2. Create component diagrams and data flows
3. Evaluate trade-offs and best practices
4. Provide technical guidance

Focus on planning and design. Use read-only tools to understand the codebase.`,
        tools: ['read', 'grep', 'glob', 'graph', 'searchCode'],
        welcomeMessage: '## Architect Mode\n\nI can help you design and plan software architecture. What would you like to plan or analyze?',
        allowEdits: false,
        autoApprove: false,
        contextLimit: 100000,
    },
    review: {
        id: 'review',
        name: 'Review',
        description: 'Review code changes',
        icon: '$(eye)',
        instructions: `You are in Review mode. Your role is to:
1. Review code changes for bugs
2. Check for security vulnerabilities
3. Evaluate code quality and style
4. Suggest improvements

Provide constructive feedback. Use read-only tools to analyze changes.`,
        tools: ['read', 'grep', 'glob', 'diff', 'searchCode'],
        welcomeMessage: '## Review Mode\n\nI can review your code changes. Share the code or describe what you\'d like me to review.',
        allowEdits: false,
        autoApprove: false,
        contextLimit: 100000,
    },
    'test-engineer': {
        id: 'test-engineer',
        name: 'Test Engineer',
        description: 'Generate and run tests',
        icon: '$(beaker)',
        instructions: `You are in Test Engineer mode. Your role is to:
1. Write unit tests
2. Write integration tests
3. Test edge cases
4. Ensure good test coverage

Focus on creating comprehensive tests. Use testing frameworks appropriate for the language.`,
        tools: ['read', 'write', 'patch', 'glob', 'grep', 'bash', 'executeCommand'],
        welcomeMessage: '## Test Engineer Mode\n\nI can help you write tests. What code would you like me to test?',
        allowEdits: true,
        autoApprove: false,
        contextLimit: 150000,
    },
    'frontend-specialist': {
        id: 'frontend-specialist',
        name: 'Frontend Specialist',
        description: 'Build UI and web interfaces',
        icon: '$(code)',
        instructions: `You are in Frontend Specialist mode. Your role is to:
1. Build user interfaces
2. Style components
3. Create responsive layouts
4. Work with frontend frameworks

Focus on UI/UX best practices. Use modern CSS, component patterns, and accessibility standards.`,
        tools: ['read', 'write', 'patch', 'glob', 'grep', 'bash', 'fetch', 'webFetch', 'browser'],
        welcomeMessage: '## Frontend Specialist Mode\n\nI can help you build user interfaces. What UI component or page would you like to create?',
        allowEdits: true,
        autoApprove: false,
        contextLimit: 150000,
    },
};
/**
 * Get all built-in mode IDs
 */
function getBuiltinModeIds() {
    return Object.keys(exports.BUILTIN_MODES);
}
/**
 * Get a built-in mode by ID
 */
function getBuiltinMode(id) {
    return exports.BUILTIN_MODES[id];
}
/**
 * Check if a mode ID is a built-in mode
 */
function isBuiltinMode(id) {
    return id in exports.BUILTIN_MODES;
}
//# sourceMappingURL=types.js.map