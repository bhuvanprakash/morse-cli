"use strict";
/**
 * Cloud Sync UI
 *
 * Provides UI components for cloud sync: login/logout, sync status indicator,
 * conflict resolution, and sync settings.
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
exports.CloudSyncUI = void 0;
exports.registerCloudSyncCommands = registerCloudSyncCommands;
const vscode = __importStar(require("vscode"));
const types_1 = require("./types");
/**
 * Cloud Sync UI Controller
 */
class CloudSyncUI {
    auth;
    syncManager;
    statusBarItem = null;
    context;
    /**
     * Create a new CloudSyncUI instance
     */
    constructor(auth, syncManager, context) {
        this.auth = auth;
        this.syncManager = syncManager;
        this.context = context;
    }
    /**
     * Initialize the UI components
     */
    initialize() {
        this.createStatusBarItem();
        this.registerEventListeners();
        this.updateStatusBar();
    }
    /**
     * Dispose UI components
     */
    dispose() {
        if (this.statusBarItem) {
            this.statusBarItem.dispose();
            this.statusBarItem = null;
        }
    }
    /**
     * Show login dialog
     */
    async showLoginDialog() {
        const email = await vscode.window.showInputBox({
            prompt: 'Enter your email',
            placeHolder: 'email@example.com',
            validateInput: (value) => {
                if (!value || !value.includes('@')) {
                    return 'Please enter a valid email address';
                }
                return null;
            },
        });
        if (!email)
            return;
        const password = await vscode.window.showInputBox({
            prompt: 'Enter your password',
            placeHolder: 'Password',
            password: true,
            validateInput: (value) => {
                if (!value || value.length < 6) {
                    return 'Password must be at least 6 characters';
                }
                return null;
            },
        });
        if (!password)
            return;
        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Signing in...',
                cancellable: false,
            }, async () => {
                await this.auth.login({ email, password });
            });
            vscode.window.showInformationMessage('Successfully signed in to Morse Cloud');
            this.updateStatusBar();
        }
        catch (error) {
            vscode.window.showErrorMessage(`Login failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Show logout confirmation
     */
    async showLogoutConfirmation() {
        const result = await vscode.window.showWarningMessage('Are you sure you want to sign out from Morse Cloud?', { modal: true }, 'Sign Out', 'Cancel');
        if (result === 'Sign Out') {
            await this.auth.logout();
            this.syncManager.stopSync();
            vscode.window.showInformationMessage('Signed out from Morse Cloud');
            this.updateStatusBar();
        }
    }
    /**
     * Show sync settings
     */
    async showSyncSettings() {
        const config = this.syncManager.getConfig();
        const items = [
            {
                label: `Sync Enabled: ${config.enabled ? 'Yes' : 'No'}`,
                description: 'Toggle cloud sync',
            },
            {
                label: `Auto Sync: ${config.autoSync ? 'Yes' : 'No'}`,
                description: 'Automatically sync changes',
            },
            {
                label: `Sync Interval: ${config.syncIntervalMinutes} minutes`,
                description: 'Change sync interval',
            },
            {
                label: `Conflict Policy: ${(0, types_1.conflictPolicyToDisplayText)(config.conflictPolicy)}`,
                description: 'Change conflict resolution policy',
            },
            {
                label: 'Sync Types',
                description: config.syncTypes.join(', '),
            },
        ];
        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select a setting to modify',
        });
        if (!selected)
            return;
        if (selected.label.startsWith('Sync Enabled')) {
            this.syncManager.updateConfig({ enabled: !config.enabled });
            vscode.window.showInformationMessage(`Cloud sync ${config.enabled ? 'disabled' : 'enabled'}`);
        }
        else if (selected.label.startsWith('Auto Sync')) {
            this.syncManager.updateConfig({ autoSync: !config.autoSync });
        }
        else if (selected.label.startsWith('Sync Interval')) {
            await this.showIntervalPicker();
        }
        else if (selected.label.startsWith('Conflict Policy')) {
            await this.showConflictPolicyPicker();
        }
        else if (selected.label.startsWith('Sync Types')) {
            await this.showSyncTypesPicker();
        }
        this.updateStatusBar();
    }
    /**
     * Show manual sync
     */
    async showManualSync() {
        const result = await vscode.window.showQuickPick(['Push Changes', 'Pull Changes', 'Full Sync'], {
            placeHolder: 'Select sync action',
        });
        if (!result)
            return;
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Syncing...',
            cancellable: true,
        }, async () => {
            switch (result) {
                case 'Push Changes':
                    await this.syncManager.push();
                    break;
                case 'Pull Changes':
                    await this.syncManager.pull();
                    break;
                case 'Full Sync':
                    await this.syncManager.doSync();
                    break;
            }
        });
        vscode.window.showInformationMessage('Sync completed');
        this.updateStatusBar();
    }
    /**
     * Show conflict resolution dialog
     */
    async showConflictResolution(conflicts) {
        const config = this.syncManager.getConfig();
        if (config.conflictPolicy === 'manual' && conflicts.length > 0) {
            const conflict = conflicts[0];
            const items = [
                {
                    label: 'Keep Local',
                    description: 'Use local version',
                },
                {
                    label: 'Keep Cloud',
                    description: 'Use cloud version',
                },
                {
                    label: 'Keep Both',
                    description: 'Keep both versions',
                },
            ];
            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: `Resolve conflict for ${conflict.itemId}`,
            });
            if (selected) {
                const resolutions = new Map();
                resolutions.set(conflict.itemId, {
                    strategy: selected.label === 'Keep Local' ? 'keepLocal' :
                        selected.label === 'Keep Cloud' ? 'keepCloud' : 'keepBoth',
                });
                await this.syncManager.resolveConflicts(resolutions);
                vscode.window.showInformationMessage('Conflict resolved');
            }
        }
    }
    /**
     * Show sync status
     */
    async showSyncStatus() {
        const status = this.syncManager.getStatus();
        const authState = this.auth.getAuthState();
        const message = [
            `Status: ${status.isEnabled ? 'Enabled' : 'Disabled'}`,
            `Running: ${status.isRunning ? 'Yes' : 'No'}`,
            `Last Sync: ${status.lastSyncTime ? status.lastSyncTime.toLocaleString() : 'Never'}`,
            `Pending Items: ${status.pendingItems}`,
            `Conflicts: ${status.conflicts}`,
            `User: ${authState.user?.email || 'Not signed in'}`,
        ].join('\n');
        await vscode.window.showInformationMessage(message, { modal: true });
    }
    async showIntervalPicker() {
        const intervals = [1, 5, 10, 15, 30, 60];
        const items = intervals.map(i => ({
            label: `${i} minute${i > 1 ? 's' : ''}`,
            description: `Sync every ${i} minutes`,
        }));
        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select sync interval',
        });
        if (selected) {
            const minutes = parseInt(selected.label.split(' ')[0]);
            this.syncManager.updateConfig({ syncIntervalMinutes: minutes });
        }
    }
    async showConflictPolicyPicker() {
        const policies = ['lastWriteWin', 'localFirst', 'cloudFirst', 'manual'];
        const items = policies.map(p => ({
            label: (0, types_1.conflictPolicyToDisplayText)(p),
            description: this.getPolicyDescription(p),
        }));
        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select conflict resolution policy',
        });
        if (selected) {
            const policy = policies.find(p => (0, types_1.conflictPolicyToDisplayText)(p) === selected.label);
            if (policy) {
                this.syncManager.updateConfig({ conflictPolicy: policy });
            }
        }
    }
    async showSyncTypesPicker() {
        const types = ['session', 'settings', 'history', 'checkpoints'];
        const config = this.syncManager.getConfig();
        const items = types.map(t => ({
            label: t,
            picked: config.syncTypes.includes(t),
        }));
        // Show checkbox picker by using multi-select
        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select sync types',
            canPickMany: true,
        });
        if (selected) {
            this.syncManager.updateConfig({
                syncTypes: selected.map(s => s.label),
            });
        }
    }
    getPolicyDescription(policy) {
        switch (policy) {
            case 'lastWriteWin':
                return 'Use the most recent version';
            case 'localFirst':
                return 'Always prefer local changes';
            case 'cloudFirst':
                return 'Always prefer cloud changes';
            case 'manual':
                return 'Ask for resolution';
            default:
                return '';
        }
    }
    createStatusBarItem() {
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.statusBarItem.command = 'morse.cloud.menu';
        this.statusBarItem.tooltip = 'Morse Cloud Sync';
        this.statusBarItem.show();
    }
    registerEventListeners() {
        // Listen for auth state changes
        this.auth.onAuthStateChanged((state) => {
            this.updateStatusBar();
        });
        // Listen for sync events
        this.syncManager.onSyncEvent((event) => {
            this.updateStatusBar();
        });
    }
    updateStatusBar() {
        if (!this.statusBarItem)
            return;
        const status = this.syncManager.getStatus();
        const authState = this.auth.getAuthState();
        if (!authState.isAuthenticated) {
            this.statusBarItem.text = '$(cloud-offline) Morse';
            this.statusBarItem.tooltip = 'Not signed in - Click to sign in';
            return;
        }
        if (status.isRunning) {
            this.statusBarItem.text = '$(sync) Syncing';
        }
        else if (status.conflicts > 0) {
            this.statusBarItem.text = `$(warning) ${status.conflicts} Conflicts`;
            this.statusBarItem.tooltip = `${status.conflicts} conflicts need resolution`;
        }
        else if (status.pendingItems > 0) {
            this.statusBarItem.text = `$(sync) ${status.pendingItems} Pending`;
        }
        else {
            this.statusBarItem.text = '$(check) Synced';
        }
        if (status.lastSyncTime) {
            this.statusBarItem.tooltip = `Last sync: ${status.lastSyncTime.toLocaleTimeString()}`;
        }
    }
}
exports.CloudSyncUI = CloudSyncUI;
/**
 * Register cloud sync commands
 */
function registerCloudSyncCommands(context, auth, syncManager) {
    const ui = new CloudSyncUI(auth, syncManager, context);
    ui.initialize();
    // Sign In
    context.subscriptions.push(vscode.commands.registerCommand('morse.cloud.login', () => {
        ui.showLoginDialog();
    }));
    // Sign Out
    context.subscriptions.push(vscode.commands.registerCommand('morse.cloud.logout', () => {
        ui.showLogoutConfirmation();
    }));
    // Sync Menu
    context.subscriptions.push(vscode.commands.registerCommand('morse.cloud.menu', async () => {
        const status = syncManager.getStatus();
        const authState = auth.getAuthState();
        if (!authState.isAuthenticated) {
            await ui.showLoginDialog();
            return;
        }
        const items = [
            {
                label: 'Sync Now',
                description: 'Perform manual sync',
            },
            {
                label: 'Sync Status',
                description: 'View sync status',
            },
            {
                label: 'Sync Settings',
                description: 'Configure sync options',
            },
        ];
        if (status.conflicts > 0) {
            items.unshift({
                label: `Resolve Conflicts (${status.conflicts})`,
                description: 'Resolve sync conflicts',
            });
        }
        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Cloud Sync',
        });
        if (!selected)
            return;
        if (selected.label === 'Sync Now') {
            await ui.showManualSync();
        }
        else if (selected.label === 'Sync Status') {
            await ui.showSyncStatus();
        }
        else if (selected.label === 'Sync Settings') {
            await ui.showSyncSettings();
        }
        else if (selected.label.startsWith('Resolve Conflicts')) {
            // Would need to implement conflict list
            vscode.window.showInformationMessage('Conflict resolution not yet implemented');
        }
    }));
    // Sync Now
    context.subscriptions.push(vscode.commands.registerCommand('morse.cloud.syncNow', () => {
        ui.showManualSync();
    }));
    // Dispose
    context.subscriptions.push({
        dispose: () => {
            ui.dispose();
        },
    });
}
//# sourceMappingURL=ui.js.map