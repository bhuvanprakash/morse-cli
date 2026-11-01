"use strict";
/**
 * Plan/Act mode state — Cline-style safety.
 * Plan = read-only (no file writes); Act = allow edits.
 * Persisted and shared so chat panel and Fix/Edit commands can gate behavior.
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
exports.onDidChangePlanActMode = void 0;
exports.initPlanActMode = initPlanActMode;
exports.getPlanActMode = getPlanActMode;
exports.setPlanActMode = setPlanActMode;
exports.isPlanMode = isPlanMode;
exports.isActMode = isActMode;
const vscode = __importStar(require("vscode"));
const STORAGE_KEY = 'morse.planActMode';
let currentMode = 'act';
let context;
let onDidChangeEmitter;
/**
 * Initialize plan/act state from extension context. Call once from activate().
 */
function initPlanActMode(ctx) {
    context = ctx;
    onDidChangeEmitter = new vscode.EventEmitter();
    exports.onDidChangePlanActMode = onDidChangeEmitter.event;
    const config = vscode.workspace.getConfiguration('morse');
    const defaultMode = config.get('defaultPlanActMode', 'act');
    const stored = context.globalState.get(STORAGE_KEY);
    currentMode = stored ?? defaultMode;
}
/**
 * Get current Plan/Act mode.
 */
function getPlanActMode() {
    return currentMode;
}
/**
 * Set Plan/Act mode and persist. Notifies listeners (e.g. chat webview).
 */
async function setPlanActMode(mode) {
    if (currentMode === mode)
        return;
    currentMode = mode;
    if (context) {
        await context.globalState.update(STORAGE_KEY, mode);
    }
    onDidChangeEmitter?.fire(mode);
}
/**
 * Returns true when in Plan (read-only) mode — Fix/Edit should block or confirm before applying.
 */
function isPlanMode() {
    return currentMode === 'plan';
}
/**
 * Returns true when in Act mode — allow applying edits.
 */
function isActMode() {
    return currentMode === 'act';
}
//# sourceMappingURL=planActMode.js.map