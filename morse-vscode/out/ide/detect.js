"use strict";
/**
 * IDE Detection and Compatibility
 *
 * Detects the IDE type (VS Code, Cursor, Antigravity, etc.) and provides
 * IDE-specific configurations and feature flags.
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
exports.IDE_CONFIGS = exports.IDEType = void 0;
exports.detectIDE = detectIDE;
exports.getIDEConfig = getIDEConfig;
exports.getIDECSSVariables = getIDECSSVariables;
exports.isFeatureSupported = isFeatureSupported;
exports.getKeybinding = getKeybinding;
exports.showWelcomeMessage = showWelcomeMessage;
const vscode = __importStar(require("vscode"));
var IDEType;
(function (IDEType) {
    IDEType["VSCode"] = "vscode";
    IDEType["Cursor"] = "cursor";
    IDEType["Antigravity"] = "antigravity";
    IDEType["Windsurf"] = "windsurf";
    IDEType["Trae"] = "trae";
    IDEType["Unknown"] = "unknown";
})(IDEType || (exports.IDEType = IDEType = {}));
// IDE-specific configurations
exports.IDE_CONFIGS = {
    [IDEType.VSCode]: {
        name: 'VS Code',
        supportsNativeTabs: true,
        supportsInlineChat: true,
        supportsCompletions: true,
        supportsSidebar: true,
        supportsDiffView: true,
        keybindingPrefix: 'ctrl+shift',
        themeColors: {
            primary: '#007ACC',
            secondary: '#1E1E1E',
        },
        brandName: 'Visual Studio Code',
    },
    [IDEType.Cursor]: {
        name: 'Cursor',
        supportsNativeTabs: true,
        supportsInlineChat: false, // Cursor has built-in AI chat
        supportsCompletions: false, // Cursor has built-in completions
        supportsSidebar: true,
        supportsDiffView: true,
        keybindingPrefix: 'ctrl+shift',
        themeColors: {
            primary: '#6366F1',
            secondary: '#1E1E1E',
        },
        brandName: 'Cursor',
    },
    [IDEType.Antigravity]: {
        name: 'Antigravity',
        supportsNativeTabs: true,
        supportsInlineChat: true,
        supportsCompletions: true,
        supportsSidebar: true,
        supportsDiffView: true,
        keybindingPrefix: 'cmd+shift',
        themeColors: {
            primary: '#10B981',
            secondary: '#0F172A',
        },
        brandName: 'Antigravity',
    },
    [IDEType.Windsurf]: {
        name: 'Windsurf',
        supportsNativeTabs: true,
        supportsInlineChat: true,
        supportsCompletions: true,
        supportsSidebar: true,
        supportsDiffView: true,
        keybindingPrefix: 'ctrl+shift',
        themeColors: {
            primary: '#F59E0B',
            secondary: '#1E1E1E',
        },
        brandName: 'Windsurf',
    },
    [IDEType.Trae]: {
        name: 'Trae',
        supportsNativeTabs: true,
        supportsInlineChat: true,
        supportsCompletions: true,
        supportsSidebar: true,
        supportsDiffView: true,
        keybindingPrefix: 'ctrl+shift',
        themeColors: {
            primary: '#EC4899',
            secondary: '#1E1E1E',
        },
        brandName: 'Trae',
    },
    [IDEType.Unknown]: {
        name: 'Unknown',
        supportsNativeTabs: true,
        supportsInlineChat: true,
        supportsCompletions: true,
        supportsSidebar: true,
        supportsDiffView: true,
        keybindingPrefix: 'ctrl+shift',
        themeColors: {
            primary: '#6B7280',
            secondary: '#1E1E1E',
        },
        brandName: 'VS Code Compatible',
    },
};
/**
 * Detect the IDE type from the environment
 */
function detectIDE() {
    const appName = vscode.env.appName.toLowerCase();
    const uriScheme = vscode.env.uriScheme.toLowerCase();
    // Check for Cursor
    if (appName.includes('cursor') || uriScheme === 'cursor') {
        return IDEType.Cursor;
    }
    // Check for Antigravity
    if (appName.includes('antigravity') || uriScheme === 'antigravity') {
        return IDEType.Antigravity;
    }
    // Check for Windsurf
    if (appName.includes('windsurf') || uriScheme === 'windsurf') {
        return IDEType.Windsurf;
    }
    // Check for Trae
    if (appName.includes('trae') || uriScheme === 'trae') {
        return IDEType.Trae;
    }
    // Check for VS Code
    if (appName.includes('code') || uriScheme === 'vscode' || uriScheme === 'code') {
        return IDEType.VSCode;
    }
    return IDEType.Unknown;
}
/**
 * Get the IDE configuration
 */
function getIDEConfig(ide) {
    const detected = ide || detectIDE();
    return exports.IDE_CONFIGS[detected];
}
/**
 * Get IDE-specific CSS variables
 */
function getIDECSSVariables(ide) {
    const config = getIDEConfig(ide);
    return {
        '--morse-primary': config.themeColors.primary,
        '--morse-secondary': config.themeColors.secondary,
    };
}
/**
 * Check if a feature is supported in the current IDE
 */
function isFeatureSupported(feature, ide) {
    const config = getIDEConfig(ide);
    return config[feature];
}
/**
 * Get the appropriate keybinding for the current IDE
 */
function getKeybinding(action, ide) {
    const config = getIDEConfig(ide);
    const prefix = config.keybindingPrefix;
    const keybindings = {
        chat: `${prefix}+M`,
        fix: `${prefix}+F`,
        explain: `${prefix}+E`,
        accept: `${prefix}+Y`,
        reject: `${prefix}+N`,
    };
    return keybindings[action] || '';
}
/**
 * Show IDE-specific welcome message
 */
function showWelcomeMessage(ide) {
    const config = getIDEConfig(ide);
    const messages = {
        [IDEType.VSCode]: `Welcome to Morse for ${config.brandName}! Use ${config.keybindingPrefix}+M to open chat.`,
        [IDEType.Cursor]: `Morse is running in ${config.brandName}. Note: Some AI features are disabled as Cursor has built-in AI.`,
        [IDEType.Antigravity]: `Welcome to Morse for ${config.brandName}! Use ${config.keybindingPrefix}+M to open chat.`,
        [IDEType.Windsurf]: `Welcome to Morse for ${config.brandName}! Use ${config.keybindingPrefix}+M to open chat.`,
        [IDEType.Trae]: `Welcome to Morse for ${config.brandName}! Use ${config.keybindingPrefix}+M to open chat.`,
        [IDEType.Unknown]: `Morse is running in an unknown IDE. Some features may not work correctly.`,
    };
    const detected = ide || detectIDE();
    vscode.window.showInformationMessage(messages[detected]);
}
//# sourceMappingURL=detect.js.map