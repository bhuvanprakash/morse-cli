"use strict";
/**
 * Hook UI
 *
 * Provides UI components for the hook system including status bar indicator
 * and hook management dialogs.
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
exports.HookUI = void 0;
exports.createHookUI = createHookUI;
const vscode = __importStar(require("vscode"));
const types_1 = require("./types");
/**
 * Hook UI Manager
 * Provides UI components for the hook system
 */
class HookUI {
    statusBarItem = null;
    context = null;
    enabled = true;
    /**
     * Initialize the UI
     */
    initialize(context) {
        this.context = context;
        this.createStatusBarItem();
    }
    /**
     * Create the status bar item
     */
    createStatusBarItem() {
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.statusBarItem.command = 'morse.hooks.list';
        this.statusBarItem.tooltip = 'Morse Hooks: Click to manage';
        this.updateStatusBar();
        if (this.statusBarItem) {
            this.statusBarItem.show();
        }
    }
    /**
     * Update the status bar indicator
     */
    updateStatusBar(enabled, hookCount) {
        if (!this.statusBarItem)
            return;
        if (enabled !== undefined) {
            this.enabled = enabled;
        }
        const icon = this.enabled ? 'hook' : 'x';
        const text = this.enabled
            ? `$(hook) Morse: ${hookCount ?? 0} hooks`
            : `$(x) Morse: hooks disabled`;
        this.statusBarItem.text = text;
        this.statusBarItem.color = this.enabled ? '#4CAF50' : '#F44336';
        this.statusBarItem.tooltip = this.enabled
            ? `Morse Hooks: ${hookCount ?? 0} active hooks\nClick to manage`
            : 'Morse Hooks: Disabled\nClick to manage';
    }
    /**
     * Show hook creation dialog
     */
    async showCreateHookDialog() {
        // Get hook name
        const name = await vscode.window.showInputBox({
            prompt: 'Hook Name',
            placeHolder: 'Enter hook name',
            validateInput: (value) => {
                if (!value || value.trim() === '') {
                    return 'Name is required';
                }
                return null;
            },
        });
        if (!name)
            return undefined;
        // Get hook type
        const type = await vscode.window.showQuickPick([
            { label: 'Pre-Execute', description: 'Runs before command execution', value: 'preExecute' },
            { label: 'Post-Execute', description: 'Runs after command execution', value: 'postExecute' },
            { label: 'Pre-Edit', description: 'Runs before file edit', value: 'preEdit' },
            { label: 'Post-Edit', description: 'Runs after file edit', value: 'postEdit' },
            { label: 'On Error', description: 'Runs when an error occurs', value: 'onError' },
            { label: 'On Message', description: 'Runs on message events', value: 'onMessage' },
            { label: 'On Tool Call', description: 'Runs when a tool is called', value: 'onToolCall' },
        ], {
            placeHolder: 'Select hook type',
            canPickMany: false,
        });
        if (!type)
            return undefined;
        // Get action type
        const actionType = await vscode.window.showQuickPick([
            { label: 'Script', description: 'Run a JavaScript script', value: 'script' },
            { label: 'Command', description: 'Execute a VS Code command', value: 'command' },
        ], {
            placeHolder: 'Select action type',
            canPickMany: false,
        });
        if (!actionType)
            return undefined;
        // Get action value based on type
        let actionValue = '';
        if (actionType.value === 'script') {
            actionValue = await vscode.window.showInputBox({
                prompt: 'Script',
                placeHolder: 'Enter JavaScript code to execute',
            }) || '';
        }
        else {
            actionValue = await vscode.window.showInputBox({
                prompt: 'Command',
                placeHolder: 'Enter VS Code command (e.g., workbench.action.reloadWindow)',
            }) || '';
        }
        // Get description (optional)
        const description = await vscode.window.showInputBox({
            prompt: 'Description (optional)',
            placeHolder: 'Enter a description for this hook',
        });
        return {
            name,
            type: type.value,
            action: {
                type: actionType.value,
                script: actionType.value === 'script' ? actionValue : undefined,
                command: actionType.value === 'command' ? actionValue : undefined,
            },
            description,
        };
    }
    /**
     * Show hook details
     */
    async showHookDetails(hook) {
        const items = [
            `Name: ${hook.config.name}`,
            `Type: ${(0, types_1.hookTypeToDisplayName)(hook.config.type)}`,
            `Enabled: ${hook.config.enabled ? 'Yes' : 'No'}`,
            `Priority: ${hook.config.priority}`,
            `Execution Mode: ${hook.config.executionMode}`,
            `Continue on Error: ${hook.config.continueOnError ? 'Yes' : 'No'}`,
            `Action Type: ${hook.config.action.type}`,
            `Registered: ${new Date(hook.registeredAt).toLocaleString()}`,
            `Executions: ${hook.executionCount}`,
        ];
        if (hook.config.description) {
            items.push(`Description: ${hook.config.description}`);
        }
        if (hook.lastExecuted) {
            items.push(`Last Executed: ${new Date(hook.lastExecuted).toLocaleString()}`);
        }
        await vscode.window.showInformationMessage(items.join('\n'), { modal: true });
    }
    /**
     * Show execution details
     */
    async showExecutionDetails(execution) {
        const items = [
            `Hook: ${execution.hookName}`,
            `Type: ${(0, types_1.hookTypeToDisplayName)(execution.hookType)}`,
            `Success: ${execution.success ? 'Yes' : 'No'}`,
            `Duration: ${execution.duration}ms`,
            `Started: ${new Date(execution.startTime).toLocaleString()}`,
        ];
        if (execution.error) {
            items.push(`Error: ${execution.error}`);
        }
        if (execution.result?.data) {
            items.push(`Data: ${JSON.stringify(execution.result.data, null, 2)}`);
        }
        await vscode.window.showInformationMessage(items.join('\n'), { modal: true });
    }
    /**
     * Show notification for hook execution
     */
    showExecutionNotification(hookName, success, duration) {
        if (success) {
            vscode.window.showInformationMessage(`Hook "${hookName}" executed successfully${duration ? ` in ${duration}ms` : ''}`);
        }
        else {
            vscode.window.showWarningMessage(`Hook "${hookName}" failed${duration ? ` after ${duration}ms` : ''}`);
        }
    }
    /**
     * Show notification for hook enabled/disabled
     */
    showEnabledNotification(hookName, enabled) {
        if (enabled) {
            vscode.window.showInformationMessage(`Hook "${hookName}" enabled`);
        }
        else {
            vscode.window.showInformationMessage(`Hook "${hookName}" disabled`);
        }
    }
    /**
     * Show confirmation dialog
     */
    async showConfirmation(title, message) {
        const result = await vscode.window.showWarningMessage(message, { modal: true }, 'Confirm', 'Cancel');
        return result === 'Confirm';
    }
    /**
     * Show error message
     */
    showError(message) {
        vscode.window.showErrorMessage(`Hook Error: ${message}`);
    }
    /**
     * Show info message
     */
    showInfo(message) {
        vscode.window.showInformationMessage(message);
    }
    /**
     * Set status bar visibility
     */
    setStatusBarVisible(visible) {
        if (this.statusBarItem) {
            if (visible) {
                this.statusBarItem.show();
            }
            else {
                this.statusBarItem.hide();
            }
        }
    }
    /**
     * Set enabled state
     */
    setEnabled(enabled) {
        this.enabled = enabled;
        this.updateStatusBar(enabled);
    }
    /**
     * Dispose the UI
     */
    dispose() {
        if (this.statusBarItem) {
            this.statusBarItem.dispose();
            this.statusBarItem = null;
        }
    }
}
exports.HookUI = HookUI;
/**
 * Create a new HookUI instance
 */
function createHookUI() {
    return new HookUI();
}
//# sourceMappingURL=ui.js.map