"use strict";
/**
 * Auto-Approval System
 *
 * A comprehensive auto-approval system for Morse VS Code extension that provides:
 * - Risk assessment for actions
 * - Configurable approval rules
 * - User approval dialogs
 * - Approval history and auditing
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
exports.ApprovalHistory = exports.createApprovalUI = exports.ApprovalUI = exports.createAutoApprovalService = exports.AutoApprovalService = void 0;
exports.initializeAutoApproval = initializeAutoApproval;
__exportStar(require("./types"), exports);
__exportStar(require("./rules"), exports);
__exportStar(require("./service"), exports);
__exportStar(require("./history"), exports);
__exportStar(require("./ui"), exports);
const service_1 = require("./service");
Object.defineProperty(exports, "AutoApprovalService", { enumerable: true, get: function () { return service_1.AutoApprovalService; } });
Object.defineProperty(exports, "createAutoApprovalService", { enumerable: true, get: function () { return service_1.createAutoApprovalService; } });
const ui_1 = require("./ui");
Object.defineProperty(exports, "ApprovalUI", { enumerable: true, get: function () { return ui_1.ApprovalUI; } });
Object.defineProperty(exports, "createApprovalUI", { enumerable: true, get: function () { return ui_1.createApprovalUI; } });
const history_1 = require("./history");
Object.defineProperty(exports, "ApprovalHistory", { enumerable: true, get: function () { return history_1.ApprovalHistory; } });
/**
 * Initialize the auto-approval system
 */
async function initializeAutoApproval(context, options) {
    const service = (0, service_1.createAutoApprovalService)();
    const ui = (0, ui_1.createApprovalUI)();
    // Initialize service
    await service.initialize(context);
    // Initialize UI
    ui.initialize(context);
    // Set up approval callback if provided
    if (options?.onApprovalRequest) {
        service.setApprovalCallback(options.onApprovalRequest);
    }
    // Set status bar visibility
    if (options?.showStatusBar !== undefined) {
        ui.setStatusBarVisible(options.showStatusBar);
    }
    return { service, ui };
}
//# sourceMappingURL=index.js.map