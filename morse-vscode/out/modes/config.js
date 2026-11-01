"use strict";
/**
 * Morse Mode Configuration
 *
 * Handles loading and managing mode configurations from settings,
 * including custom mode definitions from project and global config.
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
exports.getModeSettings = getModeSettings;
exports.getCustomModes = getCustomModes;
exports.loadProjectModes = loadProjectModes;
exports.loadGlobalModes = loadGlobalModes;
exports.getAllCustomModes = getAllCustomModes;
exports.saveCustomMode = saveCustomMode;
exports.removeCustomMode = removeCustomMode;
exports.validateModeConfig = validateModeConfig;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * Default mode settings
 */
const DEFAULT_MODE_SETTINGS = {
    defaultMode: 'code',
    showInStatusBar: true,
    statusBarPosition: 'right',
    promptOnStart: false,
    rememberLastMode: true,
    maxHistoryEntries: 50,
};
/**
 * Get mode settings from VS Code configuration
 */
function getModeSettings() {
    const config = vscode.workspace.getConfiguration('morse');
    const modeConfig = config.get('mode') || {};
    return {
        defaultMode: modeConfig.defaultMode ?? DEFAULT_MODE_SETTINGS.defaultMode,
        showInStatusBar: modeConfig.showInStatusBar ?? DEFAULT_MODE_SETTINGS.showInStatusBar,
        statusBarPosition: modeConfig.statusBarPosition ?? DEFAULT_MODE_SETTINGS.statusBarPosition,
        promptOnStart: modeConfig.promptOnStart ?? DEFAULT_MODE_SETTINGS.promptOnStart,
        rememberLastMode: modeConfig.rememberLastMode ?? DEFAULT_MODE_SETTINGS.rememberLastMode,
        maxHistoryEntries: modeConfig.maxHistoryEntries ?? DEFAULT_MODE_SETTINGS.maxHistoryEntries,
    };
}
/**
 * Get custom modes from VS Code configuration
 */
function getCustomModes() {
    const config = vscode.workspace.getConfiguration('morse');
    const customModesConfig = config.get('customModes') || [];
    return customModesConfig.map(mode => ({
        ...mode,
        source: 'global',
    }));
}
/**
 * Load project-level custom modes from .morsemodes.json file
 */
async function loadProjectModes() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        return [];
    }
    const projectModesPath = path.join(workspaceFolders[0].uri.fsPath, '.morsemodes.json');
    try {
        if (!fs.existsSync(projectModesPath)) {
            return [];
        }
        const content = fs.readFileSync(projectModesPath, 'utf-8');
        const jsonConfig = JSON.parse(content);
        if (!jsonConfig.customModes) {
            return [];
        }
        return jsonConfig.customModes.map(mode => ({
            id: mode.slug,
            name: mode.name,
            description: mode.description,
            instructions: mode.instructions,
            tools: mode.tools,
            variables: mode.variables,
            source: 'project',
        }));
    }
    catch (error) {
        console.error('[Morse] Failed to load project modes:', error);
        return [];
    }
}
/**
 * Get global modes file path
 */
function getGlobalModesPath() {
    const homedir = require('os').homedir();
    return path.join(homedir, '.config', 'morse', 'modes.json');
}
/**
 * Load global custom modes from ~/.config/morse/modes.json
 */
async function loadGlobalModes() {
    const globalModesPath = getGlobalModesPath();
    try {
        if (!fs.existsSync(globalModesPath)) {
            return [];
        }
        const content = fs.readFileSync(globalModesPath, 'utf-8');
        const jsonConfig = JSON.parse(content);
        if (!jsonConfig.customModes) {
            return [];
        }
        return jsonConfig.customModes.map(mode => ({
            id: mode.slug,
            name: mode.name,
            description: mode.description,
            instructions: mode.instructions,
            tools: mode.tools,
            variables: mode.variables,
            source: 'global',
        }));
    }
    catch (error) {
        console.error('[Morse] Failed to load global modes:', error);
        return [];
    }
}
/**
 * Get all custom modes (project + global)
 * Project modes take precedence over global modes
 */
async function getAllCustomModes() {
    const [projectModes, globalModes, configModes] = await Promise.all([
        loadProjectModes(),
        loadGlobalModes(),
        Promise.resolve(getCustomModes()),
    ]);
    // Merge all modes, project takes precedence over global, global over config
    const modeMap = new Map();
    // Add config modes first (lowest priority)
    for (const mode of configModes) {
        modeMap.set(mode.id, { ...mode, source: 'global' });
    }
    // Add global modes
    for (const mode of globalModes) {
        if (!modeMap.has(mode.id)) {
            modeMap.set(mode.id, mode);
        }
    }
    // Add project modes (highest priority)
    for (const mode of projectModes) {
        modeMap.set(mode.id, mode);
    }
    return Array.from(modeMap.values());
}
/**
 * Save custom mode to configuration
 */
async function saveCustomMode(mode, isProject = false) {
    if (isProject) {
        await saveProjectMode(mode);
    }
    else {
        await saveGlobalMode(mode);
    }
}
/**
 * Save custom mode to project .morsemodes.json file
 */
async function saveProjectMode(mode) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        throw new Error('No workspace folder open');
    }
    const projectModesPath = path.join(workspaceFolders[0].uri.fsPath, '.morsemodes.json');
    await saveModeToFile(projectModesPath, mode);
}
/**
 * Save custom mode to global modes file
 */
async function saveGlobalMode(mode) {
    const globalModesPath = getGlobalModesPath();
    // Ensure directory exists
    const dir = path.dirname(globalModesPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    await saveModeToFile(globalModesPath, mode);
}
/**
 * Save a mode to a JSON file
 */
async function saveModeToFile(filePath, mode) {
    let existingConfig = {};
    try {
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf-8');
            existingConfig = JSON.parse(content);
        }
    }
    catch {
        // Start fresh if parsing fails
    }
    const existingModes = existingConfig.customModes || [];
    const modeIndex = existingModes.findIndex((m) => m.slug === mode.id);
    const jsonMode = {
        slug: mode.id,
        name: mode.name,
        description: mode.description,
        instructions: mode.instructions,
        tools: mode.tools,
        variables: mode.variables,
    };
    if (modeIndex >= 0) {
        existingModes[modeIndex] = jsonMode;
    }
    else {
        existingModes.push(jsonMode);
    }
    existingConfig.customModes = existingModes;
    fs.writeFileSync(filePath, JSON.stringify(existingConfig, null, 2), 'utf-8');
}
/**
 * Remove a custom mode
 */
async function removeCustomMode(modeId, isProject = false) {
    if (isProject) {
        await removeProjectMode(modeId);
    }
    else {
        await removeGlobalMode(modeId);
    }
}
/**
 * Remove a mode from project configuration
 */
async function removeProjectMode(modeId) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        return;
    }
    const projectModesPath = path.join(workspaceFolders[0].uri.fsPath, '.morsemodes.json');
    await removeModeFromFile(projectModesPath, modeId);
}
/**
 * Remove a mode from global configuration
 */
async function removeGlobalMode(modeId) {
    const globalModesPath = getGlobalModesPath();
    await removeModeFromFile(globalModesPath, modeId);
}
/**
 * Remove a mode from a JSON file
 */
async function removeModeFromFile(filePath, modeId) {
    if (!fs.existsSync(filePath)) {
        return;
    }
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const config = JSON.parse(content);
        if (!config.customModes) {
            return;
        }
        config.customModes = config.customModes.filter(m => m.slug !== modeId);
        fs.writeFileSync(filePath, JSON.stringify(config, null, 2), 'utf-8');
    }
    catch (error) {
        console.error('[Morse] Failed to remove mode:', error);
    }
}
/**
 * Validate a custom mode configuration
 */
function validateModeConfig(mode) {
    const errors = [];
    if (!mode.id || mode.id.trim() === '') {
        errors.push('Mode ID is required');
    }
    if (!mode.name || mode.name.trim() === '') {
        errors.push('Mode name is required');
    }
    if (!mode.instructions || mode.instructions.trim() === '') {
        errors.push('Mode instructions are required');
    }
    // Check for invalid characters in ID
    if (mode.id && !/^[a-z0-9-]+$/.test(mode.id)) {
        errors.push('Mode ID must contain only lowercase letters, numbers, and hyphens');
    }
    return errors;
}
//# sourceMappingURL=config.js.map