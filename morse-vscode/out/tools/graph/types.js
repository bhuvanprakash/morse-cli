"use strict";
/**
 * Graph Tool Types
 * Type definitions for code dependency graph visualization in morse-vscode
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_GRAPH_CONFIG = void 0;
/**
 * Default graph configuration
 */
exports.DEFAULT_GRAPH_CONFIG = {
    depth: 3,
    includeExternal: false,
    format: 'mermaid',
    includeTests: false,
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.go', '.py', '.java', '.rs'],
    excludePatterns: ['node_modules', '.git', 'dist', 'build', 'coverage'],
};
//# sourceMappingURL=types.js.map