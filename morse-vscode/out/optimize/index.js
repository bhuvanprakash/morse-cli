"use strict";
/**
 * Optimize Module for Morse VS Code Extension
 * Provides code optimization functionality
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
exports.OptimizeSidebarProvider = exports.registerOptimizeSidebar = exports.registerOptimizeCommands = void 0;
__exportStar(require("./types"), exports);
__exportStar(require("./service"), exports);
__exportStar(require("./sidebar"), exports);
var commands_1 = require("./commands");
Object.defineProperty(exports, "registerOptimizeCommands", { enumerable: true, get: function () { return commands_1.registerOptimizeCommands; } });
var sidebar_1 = require("./sidebar");
Object.defineProperty(exports, "registerOptimizeSidebar", { enumerable: true, get: function () { return sidebar_1.registerOptimizeSidebar; } });
Object.defineProperty(exports, "OptimizeSidebarProvider", { enumerable: true, get: function () { return sidebar_1.OptimizeSidebarProvider; } });
//# sourceMappingURL=index.js.map