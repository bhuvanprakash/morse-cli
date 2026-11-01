"use strict";
/**
 * Code Search Types
 * Type definitions for code search functionality in morse-vscode
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_SEARCH_CONFIG = void 0;
/**
 * Default search configuration
 */
exports.DEFAULT_SEARCH_CONFIG = {
    maxResults: 10,
    fileTypes: ['.ts', '.tsx', '.js', '.jsx', '.go', '.py', '.java', '.rs'],
    languages: [],
    algorithm: 'bm25',
    includeExternal: false,
    includeTests: true,
    excludePatterns: ['node_modules', '.git', 'dist', 'build', 'coverage', '.next', '__pycache__'],
    caseSensitive: false,
    useRegex: false,
};
//# sourceMappingURL=types.js.map