"use strict";
/**
 * Command registration for Morse VS Code extension
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
exports.registerCommands = registerCommands;
const vscode = __importStar(require("vscode"));
const fix_1 = require("./fix");
const edit_1 = require("./edit");
const chat_1 = require("./chat");
const explain_1 = require("./explain");
const test_1 = require("./test");
const commit_1 = require("./commit");
const auth_1 = require("./auth");
function registerCommands(context, client) {
    // Register all command modules
    (0, fix_1.registerFixCommand)(context, client);
    (0, edit_1.registerEditCommand)(context, client);
    (0, chat_1.registerChatCommand)(context, client);
    (0, explain_1.registerExplainCommand)(context, client);
    (0, test_1.registerTestCommand)(context, client);
    (0, commit_1.registerCommitCommand)(context, client);
    (0, auth_1.registerAuthCommand)(context, client);
    // Register dashboard command
    context.subscriptions.push(vscode.commands.registerCommand('morse.openDashboard', () => {
        const dashboardUrl = 'https://morse.sh/dashboard';
        vscode.env.openExternal(vscode.Uri.parse(dashboardUrl));
    }));
}
//# sourceMappingURL=index.js.map