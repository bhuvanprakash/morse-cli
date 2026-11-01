"use strict";
/**
 * Morse Mode UI
 *
 * Provides UI components for mode switching:
 * - Status bar indicator
 * - Quick pick menu
 * - Mode help panel
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
exports.ModeStatusBar = void 0;
exports.showModeQuickPick = showModeQuickPick;
exports.showModeHelp = showModeHelp;
exports.showModeHistory = showModeHistory;
exports.getModeWelcomeMessage = getModeWelcomeMessage;
exports.registerModeCommands = registerModeCommands;
exports.initializeModeUI = initializeModeUI;
exports.getModeStatusBar = getModeStatusBar;
const vscode = __importStar(require("vscode"));
const config_1 = require("./config");
const service_1 = require("./service");
// ==================== Status Bar ====================
/**
 * Mode status bar item
 */
class ModeStatusBar {
    statusBarItem;
    service;
    disposables = [];
    constructor(service) {
        this.service = service;
        const settings = (0, config_1.getModeSettings)();
        // Create status bar item
        this.statusBarItem = vscode.window.createStatusBarItem(settings.statusBarPosition === 'left'
            ? vscode.StatusBarAlignment.Left
            : vscode.StatusBarAlignment.Right, 98 // Position between plan/act and connection
        );
        this.statusBarItem.command = 'morse.selectMode';
        this.updateDisplay();
        this.statusBarItem.show();
        // Listen for mode changes
        this.disposables.push(this.service.onModeChanged(() => this.updateDisplay()));
        // Listen for configuration changes
        this.disposables.push(vscode.workspace.onDidChangeConfiguration(() => {
            const newSettings = (0, config_1.getModeSettings)();
            this.statusBarItem.show();
        }));
    }
    /**
     * Update the status bar display
     */
    updateDisplay() {
        const mode = (0, service_1.getCurrentMode)();
        this.statusBarItem.text = `${mode.icon} ${mode.name}`;
        this.statusBarItem.tooltip = new vscode.MarkdownString([
            `**Current Mode: ${mode.name}**`,
            ``,
            mode.description,
            ``,
            `Click to switch mode`,
        ].join('\n'));
    }
    /**
     * Show the status bar item
     */
    show() {
        this.statusBarItem.show();
    }
    /**
     * Hide the status bar item
     */
    hide() {
        this.statusBarItem.hide();
    }
    /**
     * Dispose the status bar item
     */
    dispose() {
        this.statusBarItem.dispose();
        this.disposables.forEach(d => d.dispose());
    }
}
exports.ModeStatusBar = ModeStatusBar;
// ==================== Quick Pick ====================
/**
 * Show mode selection quick pick
 */
async function showModeQuickPick() {
    const service = (0, service_1.getModeService)();
    if (!service) {
        return;
    }
    const modes = service.getAllModes();
    const currentModeId = service.getCurrentModeId();
    const items = modes.map(mode => ({
        label: `${mode.icon} ${mode.name}`,
        description: mode.description,
        detail: mode.id === currentModeId ? '$(check) Current' : undefined,
        picked: mode.id === currentModeId,
    }));
    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select a mode',
        canPickMany: false,
        matchOnDescription: true,
        matchOnDetail: true,
    });
    if (selected) {
        const selectedMode = modes.find(m => `${m.icon} ${m.name}` === selected.label);
        if (selectedMode) {
            await (0, service_1.switchMode)(selectedMode.id);
            vscode.window.showInformationMessage(`Switched to ${selectedMode.name} mode`);
        }
    }
}
/**
 * Show mode help panel
 */
async function showModeHelp() {
    const mode = (0, service_1.getCurrentMode)();
    const panel = vscode.window.createWebviewPanel('morseModeHelp', `${mode.name} Mode Help`, vscode.ViewColumn.One, {
        enableScripts: true,
        retainContextWhenHidden: true,
    });
    const html = getModeHelpHtml(mode);
    panel.webview.html = html;
}
/**
 * Get mode help HTML content
 */
function getModeHelpHtml(mode) {
    return `<!DOCTYPE html>
<html>
<head>
    <style>
        body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            max-width: 800px;
            margin: 0 auto;
        }
        h1 {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .icon {
            font-size: 24px;
        }
        .description {
            color: var(--vscode-descriptionForeground);
            margin-bottom: 20px;
        }
        .section {
            margin: 20px 0;
            padding: 15px;
            background: var(--vscode-editor-background);
            border-radius: 5px;
        }
        .section h2 {
            margin-top: 0;
            font-size: 16px;
        }
        .tools {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
        }
        .tool {
            padding: 4px 8px;
            background: var(--vscode-badge-background);
            border-radius: 3px;
            font-size: 12px;
        }
        .allowEdits, .autoApprove {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 3px;
            font-size: 12px;
            margin-right: 8px;
        }
        .allowed {
            background: #2ea04333;
            color: #3fb950;
        }
        .not-allowed {
            background: #f8514933;
            color: #f85149;
        }
    </style>
</head>
<body>
    <h1><span class="icon">${mode.icon}</span> ${mode.name} Mode</h1>
    <p class="description">${mode.description}</p>
    
    <div class="section">
        <h2>Capabilities</h2>
        <span class="allowEdits ${mode.allowEdits ? 'allowed' : 'not-allowed'}">
            ${mode.allowEdits ? '$(check) File Edits Allowed' : '$(x) Read-Only'}
        </span>
        <span class="autoApprove ${mode.autoApprove ? 'allowed' : 'not-allowed'}">
            ${mode.autoApprove ? '$(check) Auto-Approve On' : '$(x) Auto-Approve Off'}
        </span>
    </div>
    
    <div class="section">
        <h2>Available Tools</h2>
        <div class="tools">
            ${mode.tools.map(tool => `<span class="tool">${tool}</span>`).join('')}
        </div>
    </div>
    
    <div class="section">
        <h2>Instructions</h2>
        <pre style="white-space: pre-wrap; font-family: var(--vscode-font-family);">${mode.instructions}</pre>
    </div>
    
    <div class="section">
        <h2>Welcome Message</h2>
        <pre style="white-space: pre-wrap; font-family: var(--vscode-font-family);">${mode.welcomeMessage}</pre>
    </div>
</body>
</html>`;
}
/**
 * Show mode history
 */
async function showModeHistory() {
    const service = (0, service_1.getModeService)();
    if (!service) {
        return;
    }
    const history = service.getHistory();
    if (history.length === 0) {
        vscode.window.showInformationMessage('No mode history yet');
        return;
    }
    const items = history.slice(-10).reverse().map(entry => {
        const date = new Date(entry.timestamp);
        const formatted = date.toLocaleString();
        const duration = entry.durationSeconds
            ? ` (${formatDuration(entry.durationSeconds)})`
            : '';
        return {
            label: `$(history) ${entry.modeId}${duration}`,
            description: formatted,
        };
    });
    await vscode.window.showQuickPick(items, {
        placeHolder: 'Recent mode history',
        canPickMany: false,
    });
}
/**
 * Format duration in seconds to human readable
 */
function formatDuration(seconds) {
    if (seconds < 60) {
        return `${seconds}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes < 60) {
        return remainingSeconds > 0
            ? `${minutes}m ${remainingSeconds}s`
            : `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0
        ? `${hours}h ${remainingMinutes}m`
        : `${hours}h`;
}
// ==================== Welcome Message ====================
/**
 * Get welcome message for current mode
 */
function getModeWelcomeMessage() {
    const mode = (0, service_1.getCurrentMode)();
    return mode.welcomeMessage;
}
// ==================== Mode Commands ====================
/**
 * Register mode-related commands
 */
function registerModeCommands(context) {
    const disposables = [];
    // Select mode command
    disposables.push(vscode.commands.registerCommand('morse.selectMode', async () => {
        await showModeQuickPick();
    }));
    // Mode-specific commands
    disposables.push(vscode.commands.registerCommand('morse.mode.ask', async () => {
        await (0, service_1.switchMode)('ask');
        vscode.window.showInformationMessage('Switched to Ask mode');
    }), vscode.commands.registerCommand('morse.mode.code', async () => {
        await (0, service_1.switchMode)('code');
        vscode.window.showInformationMessage('Switched to Code mode');
    }), vscode.commands.registerCommand('morse.mode.debug', async () => {
        await (0, service_1.switchMode)('debug');
        vscode.window.showInformationMessage('Switched to Debug mode');
    }), vscode.commands.registerCommand('morse.mode.architect', async () => {
        await (0, service_1.switchMode)('architect');
        vscode.window.showInformationMessage('Switched to Architect mode');
    }), vscode.commands.registerCommand('morse.mode.review', async () => {
        await (0, service_1.switchMode)('review');
        vscode.window.showInformationMessage('Switched to Review mode');
    }), vscode.commands.registerCommand('morse.mode.testEngineer', async () => {
        await (0, service_1.switchMode)('test-engineer');
        vscode.window.showInformationMessage('Switched to Test Engineer mode');
    }), vscode.commands.registerCommand('morse.mode.frontendSpecialist', async () => {
        await (0, service_1.switchMode)('frontend-specialist');
        vscode.window.showInformationMessage('Switched to Frontend Specialist mode');
    }));
    // Mode help command
    disposables.push(vscode.commands.registerCommand('morse.mode.help', async () => {
        await showModeHelp();
    }));
    // Mode history command
    disposables.push(vscode.commands.registerCommand('morse.mode.history', async () => {
        await showModeHistory();
    }));
    // Show current mode command
    disposables.push(vscode.commands.registerCommand('morse.mode.show', async () => {
        const mode = (0, service_1.getCurrentMode)();
        const modeId = (0, service_1.getCurrentModeId)();
        vscode.window.showInformationMessage(`Current mode: ${mode.name} (${modeId})`, 'Change Mode', 'Help').then(selection => {
            if (selection === 'Change Mode') {
                showModeQuickPick();
            }
            else if (selection === 'Help') {
                showModeHelp();
            }
        });
    }));
    return disposables;
}
// ==================== Initialize Mode UI ====================
let modeStatusBar;
/**
 * Initialize mode UI components
 */
function initializeModeUI(context, service) {
    const settings = (0, config_1.getModeSettings)();
    // Create status bar
    modeStatusBar = new ModeStatusBar(service);
    if (settings.showInStatusBar) {
        modeStatusBar.show();
    }
    else {
        modeStatusBar.hide();
    }
    // Register commands
    const commandDisposables = registerModeCommands(context);
    context.subscriptions.push(...commandDisposables);
    // Listen for configuration changes to update status bar visibility
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(() => {
        const newSettings = (0, config_1.getModeSettings)();
        if (modeStatusBar) {
            if (newSettings.showInStatusBar) {
                modeStatusBar.show();
            }
            else {
                modeStatusBar.hide();
            }
        }
    }));
    return modeStatusBar;
}
/**
 * Get mode status bar instance
 */
function getModeStatusBar() {
    return modeStatusBar;
}
//# sourceMappingURL=ui.js.map