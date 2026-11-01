/**
 * IDE Detection and Compatibility
 * 
 * Detects the IDE type (VS Code, Cursor, Antigravity, etc.) and provides
 * IDE-specific configurations and feature flags.
 */

import * as vscode from 'vscode';

export enum IDEType {
    VSCode = 'vscode',
    Cursor = 'cursor',
    Antigravity = 'antigravity',
    Windsurf = 'windsurf',
    Trae = 'trae',
    Unknown = 'unknown',
}

export interface IDEConfig {
    name: string;
    supportsNativeTabs: boolean;
    supportsInlineChat: boolean;
    supportsCompletions: boolean;
    supportsSidebar: boolean;
    supportsDiffView: boolean;
    keybindingPrefix: string;
    themeColors: {
        primary: string;
        secondary: string;
    };
    brandName: string;
}

// IDE-specific configurations
export const IDE_CONFIGS: Record<IDEType, IDEConfig> = {
    [IDEType.VSCode]: {
        name: 'VS Code',
        supportsNativeTabs: true,
        supportsInlineChat: true,
        supportsCompletions: true,
        supportsSidebar: true,
        supportsDiffView: true,
        keybindingPrefix: 'ctrl+shift',
        themeColors: {
            primary: '#007ACC',
            secondary: '#1E1E1E',
        },
        brandName: 'Visual Studio Code',
    },
    [IDEType.Cursor]: {
        name: 'Cursor',
        supportsNativeTabs: true,
        supportsInlineChat: false, // Cursor has built-in AI chat
        supportsCompletions: false, // Cursor has built-in completions
        supportsSidebar: true,
        supportsDiffView: true,
        keybindingPrefix: 'ctrl+shift',
        themeColors: {
            primary: '#6366F1',
            secondary: '#1E1E1E',
        },
        brandName: 'Cursor',
    },
    [IDEType.Antigravity]: {
        name: 'Antigravity',
        supportsNativeTabs: true,
        supportsInlineChat: true,
        supportsCompletions: true,
        supportsSidebar: true,
        supportsDiffView: true,
        keybindingPrefix: 'cmd+shift',
        themeColors: {
            primary: '#10B981',
            secondary: '#0F172A',
        },
        brandName: 'Antigravity',
    },
    [IDEType.Windsurf]: {
        name: 'Windsurf',
        supportsNativeTabs: true,
        supportsInlineChat: true,
        supportsCompletions: true,
        supportsSidebar: true,
        supportsDiffView: true,
        keybindingPrefix: 'ctrl+shift',
        themeColors: {
            primary: '#F59E0B',
            secondary: '#1E1E1E',
        },
        brandName: 'Windsurf',
    },
    [IDEType.Trae]: {
        name: 'Trae',
        supportsNativeTabs: true,
        supportsInlineChat: true,
        supportsCompletions: true,
        supportsSidebar: true,
        supportsDiffView: true,
        keybindingPrefix: 'ctrl+shift',
        themeColors: {
            primary: '#EC4899',
            secondary: '#1E1E1E',
        },
        brandName: 'Trae',
    },
    [IDEType.Unknown]: {
        name: 'Unknown',
        supportsNativeTabs: true,
        supportsInlineChat: true,
        supportsCompletions: true,
        supportsSidebar: true,
        supportsDiffView: true,
        keybindingPrefix: 'ctrl+shift',
        themeColors: {
            primary: '#6B7280',
            secondary: '#1E1E1E',
        },
        brandName: 'VS Code Compatible',
    },
};

/**
 * Detect the IDE type from the environment
 */
export function detectIDE(): IDEType {
    const appName = vscode.env.appName.toLowerCase();
    const uriScheme = vscode.env.uriScheme.toLowerCase();

    // Check for Cursor
    if (appName.includes('cursor') || uriScheme === 'cursor') {
        return IDEType.Cursor;
    }

    // Check for Antigravity
    if (appName.includes('antigravity') || uriScheme === 'antigravity') {
        return IDEType.Antigravity;
    }

    // Check for Windsurf
    if (appName.includes('windsurf') || uriScheme === 'windsurf') {
        return IDEType.Windsurf;
    }

    // Check for Trae
    if (appName.includes('trae') || uriScheme === 'trae') {
        return IDEType.Trae;
    }

    // Check for VS Code
    if (appName.includes('code') || uriScheme === 'vscode' || uriScheme === 'code') {
        return IDEType.VSCode;
    }

    return IDEType.Unknown;
}

/**
 * Get the IDE configuration
 */
export function getIDEConfig(ide?: IDEType): IDEConfig {
    const detected = ide || detectIDE();
    return IDE_CONFIGS[detected];
}

/**
 * Get IDE-specific CSS variables
 */
export function getIDECSSVariables(ide?: IDEType): Record<string, string> {
    const config = getIDEConfig(ide);
    return {
        '--morse-primary': config.themeColors.primary,
        '--morse-secondary': config.themeColors.secondary,
    };
}

/**
 * Check if a feature is supported in the current IDE
 */
export function isFeatureSupported(
    feature: keyof IDEConfig,
    ide?: IDEType
): boolean {
    const config = getIDEConfig(ide);
    return config[feature] as boolean;
}

/**
 * Get the appropriate keybinding for the current IDE
 */
export function getKeybinding(
    action: 'chat' | 'fix' | 'explain' | 'accept' | 'reject',
    ide?: IDEType
): string {
    const config = getIDEConfig(ide);
    const prefix = config.keybindingPrefix;

    const keybindings: Record<string, string> = {
        chat: `${prefix}+M`,
        fix: `${prefix}+F`,
        explain: `${prefix}+E`,
        accept: `${prefix}+Y`,
        reject: `${prefix}+N`,
    };

    return keybindings[action] || '';
}

/**
 * Show IDE-specific welcome message
 */
export function showWelcomeMessage(ide?: IDEType): void {
    const config = getIDEConfig(ide);
    const messages: Record<IDEType, string> = {
        [IDEType.VSCode]: `Welcome to Morse for ${config.brandName}! Use ${config.keybindingPrefix}+M to open chat.`,
        [IDEType.Cursor]: `Morse is running in ${config.brandName}. Note: Some AI features are disabled as Cursor has built-in AI.`,
        [IDEType.Antigravity]: `Welcome to Morse for ${config.brandName}! Use ${config.keybindingPrefix}+M to open chat.`,
        [IDEType.Windsurf]: `Welcome to Morse for ${config.brandName}! Use ${config.keybindingPrefix}+M to open chat.`,
        [IDEType.Trae]: `Welcome to Morse for ${config.brandName}! Use ${config.keybindingPrefix}+M to open chat.`,
        [IDEType.Unknown]: `Morse is running in an unknown IDE. Some features may not work correctly.`,
    };

    const detected = ide || detectIDE();
    vscode.window.showInformationMessage(messages[detected]);
}