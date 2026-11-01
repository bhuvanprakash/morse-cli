"use strict";
/**
 * Auth command - handle authentication with Morse
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
exports.registerAuthCommand = registerAuthCommand;
const vscode = __importStar(require("vscode"));
function registerAuthCommand(context, client) {
    context.subscriptions.push(vscode.commands.registerCommand('morse.auth', async () => {
        const action = await vscode.window.showQuickPick([
            { label: 'Sign In', description: 'Sign in to Morse', value: 'signin' },
            { label: 'Sign Out', description: 'Sign out of Morse', value: 'signout' },
            { label: 'Check Status', description: 'Check authentication status', value: 'status' },
        ], { placeHolder: 'Select authentication action' });
        if (!action) {
            return;
        }
        switch (action.value) {
            case 'signin':
                await signIn(context, client);
                break;
            case 'signout':
                await signOut(context, client);
                break;
            case 'status':
                await checkStatus(client);
                break;
        }
    }));
}
async function signIn(context, client) {
    try {
        const deviceCode = await getDeviceCode();
        const result = await vscode.window.showInformationMessage(`Your device code: ${deviceCode.code}\n\nClick below to open the authentication page.`, { modal: true }, 'Open Browser', 'Copy Code');
        if (result === 'Open Browser') {
            await vscode.env.openExternal(vscode.Uri.parse(deviceCode.verificationUri));
        }
        else if (result === 'Copy Code') {
            await vscode.env.clipboard.writeText(deviceCode.code);
            vscode.window.showInformationMessage('Device code copied to clipboard');
            await vscode.env.openExternal(vscode.Uri.parse(deviceCode.verificationUri));
        }
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Waiting for authentication...',
            cancellable: true,
        }, async (_progress, token) => {
            const session = await pollForAuth(deviceCode.deviceCode, token);
            if (session) {
                await context.secrets.store('morse.apiKey', session.accessToken);
                vscode.window.showInformationMessage('Successfully signed in to Morse!');
            }
        });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        vscode.window.showErrorMessage(`Sign in failed: ${message}`);
    }
}
async function signOut(context, _client) {
    await context.secrets.delete('morse.apiKey');
    vscode.window.showInformationMessage('Signed out of Morse');
}
async function checkStatus(client) {
    try {
        const session = await client.getSession();
        if (session) {
            vscode.window.showInformationMessage(`Signed in as ${session.email} (${session.plan} plan)`);
        }
        else {
            vscode.window.showWarningMessage('Not signed in to Morse');
        }
    }
    catch (err) {
        vscode.window.showWarningMessage('Not signed in to Morse');
    }
}
async function getDeviceCode() {
    return {
        deviceCode: 'mock-device-code',
        code: 'ABCD-1234',
        verificationUri: 'https://morse.sh/cli-auth',
        expiresIn: 1800,
        interval: 5,
    };
}
async function pollForAuth(deviceCode, token) {
    const maxAttempts = 60;
    const intervalMs = 5000;
    for (let i = 0; i < maxAttempts; i++) {
        if (token.isCancellationRequested) {
            return null;
        }
        await new Promise(resolve => setTimeout(resolve, intervalMs));
        try {
            // Poll the Morse API
        }
        catch {
            // Continue polling
        }
    }
    return null;
}
//# sourceMappingURL=auth.js.map