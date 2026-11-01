"use strict";
/**
 * Morse Mode Service
 *
 * Provides core mode management functionality including:
 * - Getting/setting current mode
 * - Mode history tracking
 * - Mode-specific tool and prompt retrieval
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
exports.ModeService = void 0;
exports.initializeModeService = initializeModeService;
exports.getModeService = getModeService;
exports.getCurrentMode = getCurrentMode;
exports.getCurrentModeId = getCurrentModeId;
exports.switchMode = switchMode;
exports.getAvailableTools = getAvailableTools;
exports.getModeInstructions = getModeInstructions;
exports.modeAllowsEdits = modeAllowsEdits;
exports.modeAllowsAutoApprove = modeAllowsAutoApprove;
const vscode = __importStar(require("vscode"));
const types_1 = require("./types");
const config_1 = require("./config");
// ==================== Mode Service ====================
/**
 * Mode service for managing mode state and operations
 */
class ModeService {
    context;
    currentMode = 'code';
    modeHistory = [];
    customModes = new Map();
    modeStartTime = null;
    // Event emitters
    _onModeChanged = new vscode.EventEmitter();
    onModeChanged = this._onModeChanged.event;
    constructor(context) {
        this.context = context;
        this.initialize();
    }
    /**
     * Initialize the mode service
     */
    async initialize() {
        // Load settings
        const settings = (0, config_1.getModeSettings)();
        // Load current mode from global state
        const savedMode = this.context.globalState.get('currentMode');
        if (savedMode && (0, types_1.isBuiltinMode)(savedMode)) {
            this.currentMode = savedMode;
        }
        else if (settings.rememberLastMode && savedMode) {
            // Try custom mode
            await this.loadCustomModes();
            if (this.customModes.has(savedMode)) {
                this.currentMode = savedMode;
            }
            else {
                this.currentMode = settings.defaultMode;
            }
        }
        else {
            this.currentMode = settings.defaultMode;
        }
        // Load history
        const savedHistory = this.context.globalState.get('modeHistory');
        if (savedHistory) {
            this.modeHistory = savedHistory.map(entry => ({
                ...entry,
                timestamp: new Date(entry.timestamp),
            }));
        }
        // Trim history if needed
        this.trimHistory(settings.maxHistoryEntries);
        // Load custom modes
        await this.loadCustomModes();
        // Start mode timer
        this.modeStartTime = new Date();
    }
    /**
     * Load custom modes from configuration
     */
    async loadCustomModes() {
        try {
            const customModes = await (0, config_1.getAllCustomModes)();
            this.customModes.clear();
            for (const mode of customModes) {
                this.customModes.set(mode.id, mode);
            }
        }
        catch (error) {
            console.error('[Morse] Failed to load custom modes:', error);
        }
    }
    /**
     * Trim history to max entries
     */
    trimHistory(maxEntries) {
        if (this.modeHistory.length > maxEntries) {
            this.modeHistory = this.modeHistory.slice(-maxEntries);
        }
    }
    /**
     * Get the current mode
     */
    getCurrentMode() {
        const builtin = (0, types_1.getBuiltinMode)(this.currentMode);
        if (builtin) {
            return builtin;
        }
        // Custom mode
        const custom = this.customModes.get(this.currentMode);
        if (custom) {
            return this.customModeToMode(custom);
        }
        // Fallback to code mode
        return types_1.BUILTIN_MODES.code;
    }
    /**
     * Get current mode ID
     */
    getCurrentModeId() {
        return this.currentMode;
    }
    /**
     * Switch to a different mode
     */
    async switchMode(modeId) {
        const previousMode = this.currentMode;
        // Validate mode exists
        if (!this.isValidMode(modeId)) {
            console.error(`[Morse] Invalid mode: ${modeId}`);
            return false;
        }
        // Record previous mode duration
        if (this.modeStartTime) {
            const duration = Math.floor((Date.now() - this.modeStartTime.getTime()) / 1000);
            if (this.modeHistory.length > 0) {
                const lastEntry = this.modeHistory[this.modeHistory.length - 1];
                if (lastEntry && lastEntry.modeId === previousMode) {
                    lastEntry.durationSeconds = duration;
                }
            }
        }
        // Switch mode
        this.currentMode = modeId;
        this.modeStartTime = new Date();
        // Save to global state
        await this.context.globalState.update('currentMode', this.currentMode);
        // Add to history
        this.addToHistory(this.currentMode);
        // Emit event
        this._onModeChanged.fire({
            previousMode,
            newMode: this.currentMode,
            timestamp: new Date(),
        });
        return true;
    }
    /**
     * Check if a mode ID is valid
     */
    isValidMode(modeId) {
        if ((0, types_1.isBuiltinMode)(modeId)) {
            return true;
        }
        return this.customModes.has(modeId);
    }
    /**
     * Get all available modes (builtin + custom)
     */
    getAllModes() {
        const modes = [];
        // Add builtin modes
        for (const mode of Object.values(types_1.BUILTIN_MODES)) {
            modes.push(mode);
        }
        // Add custom modes
        for (const config of this.customModes.values()) {
            modes.push(this.customModeToMode(config));
        }
        return modes;
    }
    /**
     * Get available tools for current mode
     */
    getAvailableTools() {
        return this.getCurrentMode().tools;
    }
    /**
     * Get mode-specific system prompt
     */
    getModeInstructions() {
        return this.getCurrentMode().instructions;
    }
    /**
     * Get mode-specific welcome message
     */
    getWelcomeMessage() {
        return this.getCurrentMode().welcomeMessage;
    }
    /**
     * Check if current mode allows edits
     */
    allowsEdits() {
        return this.getCurrentMode().allowEdits;
    }
    /**
     * Check if current mode allows auto-approve
     */
    allowsAutoApprove() {
        return this.getCurrentMode().autoApprove;
    }
    /**
     * Get mode history
     */
    getHistory() {
        return [...this.modeHistory];
    }
    /**
     * Add entry to history
     */
    addToHistory(modeId) {
        const entry = {
            modeId,
            timestamp: new Date(),
        };
        this.modeHistory.push(entry);
        // Trim history
        const settings = (0, config_1.getModeSettings)();
        this.trimHistory(settings.maxHistoryEntries);
        // Save to global state
        this.context.globalState.update('modeHistory', this.modeHistory);
    }
    /**
     * Clear mode history
     */
    clearHistory() {
        this.modeHistory = [];
        this.context.globalState.update('modeHistory', []);
    }
    /**
     * Convert custom ModeConfig to Mode
     */
    customModeToMode(config) {
        return {
            id: config.id,
            name: config.name,
            description: config.description || '',
            icon: config.icon || '$(gear)',
            instructions: config.instructions,
            tools: config.tools || [],
            welcomeMessage: `## ${config.name}\n\n${config.description || config.instructions}`,
            allowEdits: true,
            autoApprove: false,
        };
    }
    /**
     * Get mode by ID
     */
    getMode(modeId) {
        const builtin = (0, types_1.getBuiltinMode)(modeId);
        if (builtin) {
            return builtin;
        }
        const custom = this.customModes.get(modeId);
        if (custom) {
            return this.customModeToMode(custom);
        }
        return undefined;
    }
    /**
     * Reload custom modes from configuration
     */
    async reloadCustomModes() {
        await this.loadCustomModes();
    }
    /**
     * Get mode context variables
     */
    getModeVariables() {
        const custom = this.customModes.get(this.currentMode);
        if (custom && custom.variables) {
            return custom.variables;
        }
        return {
            MORSE_MODE: this.currentMode,
        };
    }
    /**
     * Dispose the service
     */
    dispose() {
        this._onModeChanged.dispose();
    }
}
exports.ModeService = ModeService;
// ==================== Global Service Instance ====================
let modeService;
/**
 * Initialize the mode service
 */
function initializeModeService(context) {
    modeService = new ModeService(context);
    return modeService;
}
/**
 * Get the mode service instance
 */
function getModeService() {
    return modeService;
}
/**
 * Get current mode (convenience function)
 */
function getCurrentMode() {
    return modeService?.getCurrentMode() ?? types_1.BUILTIN_MODES.code;
}
/**
 * Get current mode ID (convenience function)
 */
function getCurrentModeId() {
    return modeService?.getCurrentModeId() ?? 'code';
}
/**
 * Switch mode (convenience function)
 */
async function switchMode(modeId) {
    return modeService?.switchMode(modeId) ?? false;
}
/**
 * Get available tools for current mode (convenience function)
 */
function getAvailableTools() {
    return modeService?.getAvailableTools() ?? [];
}
/**
 * Get mode instructions (convenience function)
 */
function getModeInstructions() {
    return modeService?.getModeInstructions() ?? '';
}
/**
 * Check if current mode allows edits
 */
function modeAllowsEdits() {
    return modeService?.allowsEdits() ?? true;
}
/**
 * Check if current mode allows auto-approve
 */
function modeAllowsAutoApprove() {
    return modeService?.allowsAutoApprove() ?? false;
}
//# sourceMappingURL=service.js.map