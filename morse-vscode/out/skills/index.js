"use strict";
/**
 * Skills System
 * Morse VS Code Extension Skills Module
 *
 * This module provides a complete skills system for the Morse VS Code extension,
 * allowing users to load, manage, and invoke skills from the .morse/skills directory.
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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
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
exports.getLoader = getLoader;
exports.getRegistry = getRegistry;
exports.getAdapter = getAdapter;
exports.initializeSkills = initializeSkills;
exports.disposeSkills = disposeSkills;
exports.reloadSkills = reloadSkills;
exports.isSkillsInitialized = isSkillsInitialized;
__exportStar(require("./types"), exports);
__exportStar(require("./loader"), exports);
__exportStar(require("./registry"), exports);
__exportStar(require("./adapter"), exports);
__exportStar(require("./ui"), exports);
const vscode = __importStar(require("vscode"));
const loader_1 = require("./loader");
const registry_1 = require("./registry");
const adapter_1 = require("./adapter");
const ui_1 = require("./ui");
const types_1 = require("./types");
/**
 * Skills System state
 */
let loader = null;
let registry = null;
let adapter = null;
/**
 * Get the skills loader
 */
function getLoader() {
    return loader;
}
/**
 * Get the skills registry
 */
function getRegistry() {
    return registry;
}
/**
 * Get the skills adapter
 */
function getAdapter() {
    return adapter;
}
/**
 * Initialize the skills system
 */
async function initializeSkills(context) {
    console.log('[Skills] Initializing skills system...');
    // Get skills configuration from VS Code settings
    const skillsConfig = vscode.workspace.getConfiguration('morse').get('skills') || {};
    // Merge with defaults
    const config = {
        ...types_1.DEFAULT_SKILLS_CONFIG,
        ...skillsConfig
    };
    if (!config.enabled) {
        console.log('[Skills] Skills system is disabled');
        return;
    }
    // Create loader
    loader = (0, loader_1.createSkillsLoader)(config);
    // Start file watching
    loader.startWatching(context);
    // Create registry
    registry = (0, registry_1.createSkillsRegistry)(loader, config);
    // Create adapter
    adapter = (0, adapter_1.createSkillsAdapter)(registry);
    // Initialize UI
    (0, ui_1.initializeSkillsUI)(registry, adapter, context);
    // Load all skills
    const skills = await registry.loadSkills();
    console.log(`[Skills] Loaded ${skills.length} skills`);
    console.log('[Skills] Skills system initialized');
}
/**
 * Dispose the skills system
 */
function disposeSkills() {
    if (loader) {
        loader.dispose();
        loader = null;
    }
    if (registry) {
        registry.dispose();
        registry = null;
    }
    if (adapter) {
        adapter.dispose();
        adapter = null;
    }
    console.log('[Skills] Skills system disposed');
}
/**
 * Re-load all skills
 */
async function reloadSkills() {
    if (!registry || !loader) {
        console.log('[Skills] Cannot reload - skills not initialized');
        return;
    }
    loader.clearCache();
    await registry.loadSkills();
    console.log('[Skills] Skills reloaded');
}
/**
 * Check if skills system is initialized
 */
function isSkillsInitialized() {
    return loader !== null && registry !== null && adapter !== null;
}
//# sourceMappingURL=index.js.map