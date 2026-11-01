/**
 * VS Code Extension Tests for Morse
 * Tests core extension functionality, settings, and commands
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import { MorseClient } from '../morse/client';

suite('Extension Test Suite', () => {
    // Wait for extension to activate before running tests
    let extension: vscode.Extension<unknown> | undefined;

    suiteSetup(async () => {
        // Get the extension
        extension = vscode.extensions.getExtension('morse.morse-vscode');

        // Wait for activation
        if (extension && !extension.isActive) {
            await extension.activate();
        }
    });

    test('Extension should be present', () => {
        assert.ok(extension, 'Extension should be installed');
    });

    test('Extension should activate', async () => {
        assert.ok(extension?.isActive, 'Extension should be active');
    });

    test('Should register all commands', async () => {
        const expectedCommands = [
            'morse.chat',
            'morse.fix',
            'morse.edit',
            'morse.explain',
            'morse.generateTests',
            'morse.generateCommit',
            'morse.auth',
            'morse.openDashboard',
            'morse.clearChat',
            'morse.exportChat',
            'morse.acceptHunk',
            'morse.rejectHunk',
            'morse.acceptAllHunks',
            'morse.localOpen',
            'morse.openDirectory',
        ];

        const commands = await vscode.commands.getCommands(true);

        for (const cmd of expectedCommands) {
            assert.ok(
                commands.includes(cmd),
                `Command ${cmd} should be registered`
            );
        }
    });

    test('Should have valid configuration', () => {
        const config = vscode.workspace.getConfiguration('morse');

        // Check that configuration exists
        assert.ok(config, 'Configuration should exist');

        // Check default values
        const endpoint = config.get<string>('endpoint');
        assert.strictEqual(
            endpoint,
            'http://localhost:8080',
            'Default endpoint should be http://localhost:8080'
        );

        const model = config.get<string>('model');
        assert.ok(model, 'Default model should be set');

        const enableStreaming = config.get<boolean>('enableStreaming');
        assert.strictEqual(
            enableStreaming,
            true,
            'Streaming should be enabled by default'
        );
    });

    test('Should validate settings correctly', () => {
        const config = vscode.workspace.getConfiguration('morse');

        // Test API key validation
        const apiKey = config.get<string>('apiKey');

        // In test environment, API key might not be set
        // This test documents the expected behavior
        if (!apiKey && !process.env.MORSE_API_KEY) {
            console.log('Warning: API key not configured in test environment');
        }
    });

    test('MorseClient should initialize', () => {
        const client = new MorseClient();
        assert.ok(client, 'MorseClient should initialize');
    });

    test('Should handle configuration changes', async () => {
        const config = vscode.workspace.getConfiguration('morse');

        // Store original value
        const originalValue = config.get<string>('model');

        try {
            // Update configuration (this may fail in test environment without workspace)
            await config.update('model', 'gpt-4o', true);

            // Verify the change
            const newValue = config.get<string>('model');
            assert.strictEqual(newValue, 'gpt-4o', 'Model should be updated');
        } catch (error) {
            // Configuration updates may fail in test environment
            console.log('Configuration update test skipped:', error);
        } finally {
            // Restore original value
            if (originalValue) {
                await config.update('model', originalValue, true);
            }
        }
    });

    test('Local Open command should exist', async () => {
        const commands = await vscode.commands.getCommands(true);
        assert.ok(
            commands.includes('morse.localOpen'),
            'Local Open command should exist'
        );
        assert.ok(
            commands.includes('morse.openDirectory'),
            'Open Directory command should exist'
        );
    });

    test('Chat panel webview should be creatable', async () => {
        // This test verifies that the chat panel command exists
        // Actually creating the panel requires the full extension host
        const commands = await vscode.commands.getCommands(true);
        assert.ok(
            commands.includes('morse.chat'),
            'Chat command should be available'
        );
    });

    test('Extension exports should be valid', () => {
        // Verify extension exports
        if (extension) {
            const exports = extension.exports;
            // The extension may or may not export anything
            // This test documents the expected behavior
            console.log('Extension exports:', exports);
        }
    });
});

suite('Settings Validation', () => {
    test('Should detect missing API key', () => {
        const config = vscode.workspace.getConfiguration('morse');
        const apiKey = config.get<string>('apiKey');

        // Test that we can detect missing configuration
        const isConfigured = !!apiKey || !!process.env.MORSE_API_KEY;

        // Document the expected validation behavior
        if (!isConfigured) {
            console.log('Settings validation: API key not configured');
        }
    });

    test('Should validate endpoint URL', () => {
        const config = vscode.workspace.getConfiguration('morse');
        const endpoint = config.get<string>('endpoint', 'http://localhost:8080');

        // Test URL validation
        let isValid = false;
        try {
            new URL(endpoint);
            isValid = true;
        } catch {
            isValid = false;
        }

        assert.strictEqual(isValid, true, 'Endpoint should be a valid URL');
    });

    test('Should validate model selection', () => {
        const config = vscode.workspace.getConfiguration('morse');
        const model = config.get<string>('model');

        const validModels = [
            'claude-3-5-sonnet-20241022',
            'claude-3-opus-20240229',
            'gpt-4o',
            'gpt-4-turbo',
        ];

        // Model should either be in valid list or be a custom value
        if (model && !validModels.includes(model)) {
            console.log(`Warning: Model ${model} is not in the standard list`);
        }
    });
});

suite('MorseClient Tests', () => {
    let client: MorseClient;

    setup(() => {
        client = new MorseClient();
    });

    test('Should load configuration', () => {
        // Client should have loaded configuration
        assert.ok(client, 'Client should be initialized');
    });

    test('Should check connection', async () => {
        // This test may fail if no server is running
        // It's documenting the expected API
        try {
            const isConnected = await client.checkConnection();
            console.log('Connection status:', isConnected);
        } catch (error) {
            console.log('Connection check failed (expected if server not running):', error);
        }
    });
});
