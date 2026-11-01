"use strict";
/**
 * Morse VS Code Extension - Checkpoint Module
 * Main entry point for checkpoint/rollback functionality
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
exports.CheckpointManager = void 0;
exports.initializeCheckpoint = initializeCheckpoint;
__exportStar(require("./types"), exports);
__exportStar(require("./service"), exports);
__exportStar(require("./snapshot"), exports);
__exportStar(require("./auto"), exports);
__exportStar(require("./ui"), exports);
const service_1 = require("./service");
const auto_1 = require("./auto");
const ui_1 = require("./ui");
const types_1 = require("./types");
/**
 * Checkpoint manager that combines service, auto-snapshot, and UI
 */
class CheckpointManager {
    service;
    autoManager;
    ui;
    context;
    config;
    constructor(context, config) {
        this.context = context;
        this.config = { ...types_1.DEFAULT_CHECKPOINT_CONFIG, ...config };
    }
    /**
     * Initialize the checkpoint manager
     */
    async initialize() {
        // Create and initialize service
        this.service = await (0, service_1.createCheckpointService)(this.context, this.config);
        // Create auto-snapshot manager
        this.autoManager = (0, auto_1.createAutoSnapshotManager)(this.service, this.config);
        // Create UI
        this.ui = new ui_1.CheckpointUI(this.context, this.service, this.autoManager);
    }
    /**
     * Get the checkpoint service
     */
    getService() {
        return this.service;
    }
    /**
     * Get the auto-snapshot manager
     */
    getAutoManager() {
        return this.autoManager;
    }
    /**
     * Get current configuration
     */
    getConfig() {
        return this.config;
    }
    /**
     * Update configuration
     */
    updateConfig(config) {
        this.config = { ...this.config, ...config };
        this.service.updateConfig(config);
        this.autoManager.updateConfig(config);
    }
    /**
     * Create a manual checkpoint
     */
    async createCheckpoint(message) {
        await this.service.createCheckpoint(message);
    }
    /**
     * Create an automatic checkpoint before an operation
     */
    async createAutoCheckpoint(operationType, sessionID) {
        await this.autoManager.snapshotBeforeOperation(operationType, sessionID);
    }
    /**
     * Dispose of the manager
     */
    dispose() {
        this.autoManager.dispose();
        this.service.dispose();
        this.ui.dispose();
    }
}
exports.CheckpointManager = CheckpointManager;
/**
 * Initialize the checkpoint system
 */
async function initializeCheckpoint(context, config) {
    const manager = new CheckpointManager(context, config);
    await manager.initialize();
    return manager;
}
//# sourceMappingURL=index.js.map