/**
 * Auth command - handle authentication with Morse
 */

import * as vscode from 'vscode';
import { MorseClient } from '../morse/client';

export function registerAuthCommand(context: vscode.ExtensionContext, client: MorseClient): void {
    context.subscriptions.push(
        vscode.commands.registerCommand('morse.auth', async () => {
            const action = await vscode.window.showQuickPick(
                [
                    { label: 'Sign In', description: 'Sign in to Morse', value: 'signin' },
                    { label: 'Sign Out', description: 'Sign out of Morse', value: 'signout' },
                    { label: 'Check Status', description: 'Check authentication status', value: 'status' },
                ],
                { placeHolder: 'Select authentication action' }
            );

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
        })
    );
}

async function signIn(context: vscode.ExtensionContext, client: MorseClient): Promise<void> {
    try {
        const deviceCode = await getDeviceCode();

        const result = await vscode.window.showInformationMessage(
            `Your device code: ${deviceCode.code}\n\nClick below to open the authentication page.`,
            { modal: true },
            'Open Browser',
            'Copy Code'
        );

        if (result === 'Open Browser') {
            await vscode.env.openExternal(vscode.Uri.parse(deviceCode.verificationUri));
        } else if (result === 'Copy Code') {
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

    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        vscode.window.showErrorMessage(`Sign in failed: ${message}`);
    }
}

async function signOut(context: vscode.ExtensionContext, _client: MorseClient): Promise<void> {
    await context.secrets.delete('morse.apiKey');
    vscode.window.showInformationMessage('Signed out of Morse');
}

async function checkStatus(client: MorseClient): Promise<void> {
    try {
        const session = await client.getSession();

        if (session) {
            vscode.window.showInformationMessage(
                `Signed in as ${session.email} (${session.plan} plan)`
            );
        } else {
            vscode.window.showWarningMessage('Not signed in to Morse');
        }
    } catch (err) {
        vscode.window.showWarningMessage('Not signed in to Morse');
    }
}

interface DeviceCodeResponse {
    deviceCode: string;
    code: string;
    verificationUri: string;
    expiresIn: number;
    interval: number;
}

interface TokenResponse {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
}

async function getDeviceCode(): Promise<DeviceCodeResponse> {
    return {
        deviceCode: 'mock-device-code',
        code: 'ABCD-1234',
        verificationUri: 'https://morse.sh/cli-auth',
        expiresIn: 1800,
        interval: 5,
    };
}

async function pollForAuth(deviceCode: string, token: vscode.CancellationToken): Promise<TokenResponse | null> {
    const maxAttempts = 60;
    const intervalMs = 5000;

    for (let i = 0; i < maxAttempts; i++) {
        if (token.isCancellationRequested) {
            return null;
        }

        await new Promise(resolve => setTimeout(resolve, intervalMs));

        try {
            // Poll the Morse API
        } catch {
            // Continue polling
        }
    }

    return null;
}
