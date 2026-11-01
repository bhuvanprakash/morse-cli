/**
 * Manages the current diff context for hunk operations
 */

import * as vscode from 'vscode';
import { MorseProtocol } from '../../morse/protocol';

export interface DiffContext {
    document: vscode.TextDocument;
    range: vscode.Range;
    original: string;
    modified: string;
    diff: MorseProtocol.DiffHunk[];
    explanation: string;
    timestamp: number;
}

let currentDiffContext: DiffContext | null = null;

export function setCurrentDiffContext(context: DiffContext | null): void {
    currentDiffContext = context;
}

export function getCurrentDiffContext(): DiffContext | null {
    return currentDiffContext;
}

export function clearCurrentDiffContext(): void {
    currentDiffContext = null;
}
