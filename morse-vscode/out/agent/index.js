"use strict";
/**
 * Agent Module Index for Morse VS Code Extension
 * Exports all agent-related functionality
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
exports.registerAgentCommands = exports.AgentPanel = exports.hideAgentPanel = exports.showAgentPanel = exports.getAgentPanel = exports.AgentService = exports.getAgentClient = exports.getAgentService = void 0;
exports.initializeAgentSystem = initializeAgentSystem;
exports.disposeAgentSystem = disposeAgentSystem;
// Types
__exportStar(require("./types"), exports);
// Service
var service_1 = require("./service");
Object.defineProperty(exports, "getAgentService", { enumerable: true, get: function () { return service_1.getAgentService; } });
Object.defineProperty(exports, "getAgentClient", { enumerable: true, get: function () { return service_1.getAgentClient; } });
Object.defineProperty(exports, "AgentService", { enumerable: true, get: function () { return service_1.AgentService; } });
// Panel
var panel_1 = require("./panel");
Object.defineProperty(exports, "getAgentPanel", { enumerable: true, get: function () { return panel_1.getAgentPanel; } });
Object.defineProperty(exports, "showAgentPanel", { enumerable: true, get: function () { return panel_1.showAgentPanel; } });
Object.defineProperty(exports, "hideAgentPanel", { enumerable: true, get: function () { return panel_1.hideAgentPanel; } });
Object.defineProperty(exports, "AgentPanel", { enumerable: true, get: function () { return panel_1.AgentPanel; } });
// Commands
var commands_1 = require("./commands");
Object.defineProperty(exports, "registerAgentCommands", { enumerable: true, get: function () { return commands_1.registerAgentCommands; } });
const commands_2 = require("./commands");
const service_2 = require("./service");
const panel_2 = require("./panel");
let initialized = false;
/**
 * Initialize the agent system
 * Should be called from the extension's activate function
 */
function initializeAgentSystem(context) {
    if (initialized) {
        return;
    }
    // Register all agent commands
    (0, commands_2.registerAgentCommands)(context);
    // Initialize the agent panel
    const panel = (0, panel_2.getAgentPanel)();
    panel.init(context);
    initialized = true;
}
/**
 * Dispose of the agent system
 * Should be called from the extension's deactivate function
 */
function disposeAgentSystem() {
    const panel = (0, panel_2.getAgentPanel)();
    panel.dispose();
    const service = (0, service_2.getAgentService)();
    service.dispose();
    initialized = false;
}
//# sourceMappingURL=index.js.map