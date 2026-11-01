"use strict";
/**
 * Skills Adapter
 * Handles skill invocation and context passing
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
exports.SkillsAdapter = void 0;
exports.createSkillsAdapter = createSkillsAdapter;
const vscode = __importStar(require("vscode"));
/**
 * Format skill output for display
 */
function formatSkillOutput(skill, result) {
    const lines = [
        `# Skill: ${skill.metadata.name}`,
        `Category: ${skill.category}`,
        `Description: ${skill.metadata.description}`,
        '',
        '---',
        '',
        result
    ];
    return lines.join('\n');
}
/**
 * Build context prompt from VS Code context
 */
function buildContextPrompt(context) {
    const parts = [];
    // Add workspace info
    if (context.workspaceFolder) {
        parts.push(`Workspace: ${context.workspaceFolder.uri.fsPath}`);
    }
    // Add editor info
    if (context.activeEditor) {
        const editor = context.activeEditor;
        parts.push(`File: ${editor.document.uri.fsPath}`);
        parts.push(`Language: ${editor.document.languageId}`);
        // Add selection
        if (!editor.selection.isEmpty) {
            const selection = editor.selection;
            const selectedText = editor.document.getText(selection);
            parts.push(`\nSelected text:\n\`\`\`\n${selectedText}\n\`\`\``);
        }
    }
    // Add parameters
    if (context.parameters && Object.keys(context.parameters).length > 0) {
        parts.push(`\nParameters: ${JSON.stringify(context.parameters, null, 2)}`);
    }
    return parts.join('\n');
}
/**
 * Skills Adapter
 * Handles invoking skills with context
 */
class SkillsAdapter {
    registry;
    outputChannel;
    constructor(registry) {
        this.registry = registry;
        this.outputChannel = vscode.window.createOutputChannel('Morse Skills');
    }
    /**
     * Get the output channel for skill results
     */
    getOutputChannel() {
        return this.outputChannel;
    }
    /**
     * Invoke a skill by ID
     */
    async invoke(skillId, context) {
        const skill = this.registry.getSkill(skillId);
        if (!skill) {
            return {
                success: false,
                error: `Skill not found: ${skillId}`
            };
        }
        if (!this.registry.isSkillEnabled(skillId)) {
            return {
                success: false,
                error: `Skill is disabled: ${skillId}`
            };
        }
        console.log(`[Skills] Invoking skill: ${skillId}`);
        try {
            // Build the full prompt
            const contextPrompt = buildContextPrompt(context);
            const fullPrompt = this.buildSkillPrompt(skill, context);
            // Show progress
            const progress = await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Running skill: ${skill.metadata.name}`,
                cancellable: true
            }, async (progress) => {
                progress.report({ message: 'Processing...' });
                // Display skill info in output channel
                this.outputChannel.clear();
                this.outputChannel.appendLine(`Invoking skill: ${skill.metadata.name}`);
                this.outputChannel.appendLine(`Category: ${skill.category}`);
                this.outputChannel.appendLine(`Description: ${skill.metadata.description}`);
                this.outputChannel.appendLine('');
                this.outputChannel.appendLine('--- Context ---');
                this.outputChannel.appendLine(contextPrompt);
                this.outputChannel.appendLine('');
                this.outputChannel.appendLine('--- Skill Content ---');
                this.outputChannel.appendLine(skill.content);
                this.outputChannel.show();
                // Return the skill content to be processed by the chat system
                return {
                    success: true,
                    output: fullPrompt,
                    metadata: {
                        skillId: skill.id,
                        skillName: skill.metadata.name,
                        category: skill.category,
                        context: contextPrompt
                    }
                };
            });
            return progress;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error(`[Skills] Error invoking skill ${skillId}:`, error);
            return {
                success: false,
                error: errorMessage
            };
        }
    }
    /**
     * Build the full prompt for a skill
     */
    buildSkillPrompt(skill, context) {
        const parts = [];
        // Add skill role/purpose
        parts.push(skill.content);
        // Add command-specific prompt if provided
        if (context.commandId) {
            const command = skill.commands.find(c => c.id === context.commandId);
            if (command?.prompt) {
                parts.push(`\n## Command: ${command.name}\n${command.prompt}`);
            }
        }
        // Add context information
        const contextPrompt = buildContextPrompt(context);
        if (contextPrompt) {
            parts.push(`\n## Current Context\n${contextPrompt}`);
        }
        return parts.join('\n\n');
    }
    /**
     * Invoke a skill by name (case-insensitive)
     */
    async invokeByName(name, context) {
        const skill = this.registry.getSkillByName(name);
        if (!skill) {
            return {
                success: false,
                error: `Skill not found: ${name}`
            };
        }
        return this.invoke(skill.id, context);
    }
    /**
     * Invoke a skill command
     */
    async invokeCommand(skillId, commandId, context) {
        const skill = this.registry.getSkill(skillId);
        if (!skill) {
            return {
                success: false,
                error: `Skill not found: ${skillId}`
            };
        }
        const command = skill.commands.find(c => c.id === commandId);
        if (!command) {
            return {
                success: false,
                error: `Command not found: ${commandId} in skill ${skillId}`
            };
        }
        // Create context with command
        const commandContext = {
            ...context,
            commandId
        };
        return this.invoke(skillId, commandContext);
    }
    /**
     * List all available skills with their commands
     */
    listSkills() {
        const skills = this.registry.getEnabledSkills();
        return skills.map(skill => ({
            skill,
            commands: skill.commands
        }));
    }
    /**
     * Search skills and return formatted results
     */
    async searchAndInvoke(query, context) {
        const results = this.registry.searchSkills(query);
        if (results.length === 0) {
            return {
                success: false,
                error: `No skills found matching: ${query}`
            };
        }
        // Use the first matching skill
        const bestMatch = results[0];
        return this.invoke(bestMatch.id, context);
    }
    /**
     * Get skill suggestions based on current context
     */
    getSuggestions(context) {
        const allSkills = this.registry.getEnabledSkills();
        const suggestions = [];
        // Get current file language and content
        const language = context.activeEditor?.document.languageId || '';
        const content = context.activeEditor?.document.getText() || '';
        for (const skill of allSkills) {
            let score = 0;
            // Check if skill category matches file type
            if (skill.category === 'frontend' && /html|css|javascript|typescript|react|vue/i.test(language)) {
                score += 10;
            }
            if (skill.category === 'backend' && /python|java|go|rust|node/i.test(language)) {
                score += 10;
            }
            if (skill.category === 'ai-ml' && /ai|ml|llm|rag/i.test(content)) {
                score += 10;
            }
            if (skill.category === 'devops' && /docker|k8s|yaml|ci|cd/i.test(content)) {
                score += 10;
            }
            if (skill.category === 'security' && /password|auth|token|encrypt/i.test(content)) {
                score += 10;
            }
            // Boost enabled skills (already enabled)
            score += 1;
            if (score > 0) {
                suggestions.push({ skill, score });
            }
        }
        // Sort by score and return top 5
        suggestions.sort((a, b) => b.score - a.score);
        return suggestions.slice(0, 5).map(s => s.skill);
    }
    /**
     * Format skill for chat display
     */
    formatForChat(skill) {
        const lines = [
            `## ${skill.metadata.name}`,
            '',
            skill.metadata.description,
            '',
            `**Category:** ${skill.category}`,
            `**Commands:** ${skill.commands.map(c => `\`${c.name}\``).join(', ')}`,
            ''
        ];
        if (skill.metadata.risk !== 'unknown') {
            lines.push(`**Risk Level:** ${skill.metadata.risk}`);
        }
        if (skill.metadata.tags && skill.metadata.tags.length > 0) {
            lines.push(`**Tags:** ${skill.metadata.tags.join(', ')}`);
        }
        return lines.join('\n');
    }
    /**
     * Dispose the adapter
     */
    dispose() {
        this.outputChannel.dispose();
    }
}
exports.SkillsAdapter = SkillsAdapter;
/**
 * Create a skills adapter
 */
function createSkillsAdapter(registry) {
    return new SkillsAdapter(registry);
}
//# sourceMappingURL=adapter.js.map