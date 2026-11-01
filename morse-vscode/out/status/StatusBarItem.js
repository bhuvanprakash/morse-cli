"use strict";
/**
 * Status bar manager for Morse
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
exports.StatusBarManager = void 0;
const vscode = __importStar(require("vscode"));
class StatusBarManager {
    statusBarItem;
    client;
    disposables = [];
    updateInterval;
    constructor(client) {
        this.client = client;
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.statusBarItem.command = 'morse.auth';
        this.updateStatus();
        this.statusBarItem.show();
        // Update status periodically
        this.updateInterval = setInterval(() => {
            this.updateStatus();
        }, 30000);
        // Listen for configuration changes
        this.disposables.push(vscode.workspace.onDidChangeConfiguration(() => {
            this.updateStatus();
        }));
    }
    async updateStatus() {
        try {
            const session = await this.client.getSession();
            if (session) {
                // Get usage stats
                try {
                    const stats = await this.client.getUsageStats();
                    const today = stats.daily[stats.daily.length - 1];
                    this.statusBarItem.text = `$(sparkle) Morse: ${session.plan}`;
                    this.statusBarItem.tooltip = new vscode.MarkdownString([
                        `**Morse AI**`,
                        ``,
                        `Signed in as: ${session.email}`,
                        `Plan: ${session.plan}`,
                        ``,
                        `**Today's Usage:**`,
                        `Tokens: ${today?.tokens.toLocaleString() || 0}`,
                        `Cost: $${today?.cost.toFixed(4) || '0.0000'}`,
                        `Requests: ${today?.requests || 0}`,
                    ].join('\n'));
                }
                catch {
                    this.statusBarItem.text = `$(sparkle) Morse: ${session.plan}`;
                    this.statusBarItem.tooltip = `Signed in as ${session.email}`;
                }
            }
            else {
                this.statusBarItem.text = `$(sparkle) Morse: Sign In`;
                this.statusBarItem.tooltip = 'Click to sign in to Morse';
            }
        }
        catch {
            this.statusBarItem.text = `$(sparkle) Morse: Disconnected`;
            this.statusBarItem.tooltip = 'Morse CLI not running. Click to reconnect.';
        }
    }
    dispose() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        this.statusBarItem.dispose();
        this.disposables.forEach(d => d.dispose());
    }
}
exports.StatusBarManager = StatusBarManager;
//# sourceMappingURL=StatusBarItem.js.map