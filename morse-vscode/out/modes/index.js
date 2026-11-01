"use strict";
/**
 * Morse Modes Module
 *
 * Mode switching system for the VS Code extension.
 * Provides distinct behaviors for different tasks:
 * - ask: Answer questions only
 * - code: Full editing capabilities
 * - debug: Debugging-focused
 * - architect: Planning and design
 * - review: Code review
 * - test-engineer: Test generation
 * - frontend-specialist: UI development
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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
// Types
__exportStar(require("./types"), exports);
// Configuration
__exportStar(require("./config"), exports);
// Service
__exportStar(require("./service"), exports);
// UI
__exportStar(require("./ui"), exports);
//# sourceMappingURL=index.js.map