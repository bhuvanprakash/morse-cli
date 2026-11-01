"use strict";
/**
 * Agent Types for Morse VS Code Extension
 * Defines interfaces and types for the agent system
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAgentId = createAgentId;
exports.createTaskId = createTaskId;
exports.createDefaultAgentConfig = createDefaultAgentConfig;
exports.createAgent = createAgent;
exports.createTask = createTask;
exports.getAgentStatusColor = getAgentStatusColor;
exports.getAgentStatusIcon = getAgentStatusIcon;
// ==================== Utility Functions ====================
/**
 * Creates a new agent ID
 */
function createAgentId() {
    return `agent-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}
/**
 * Creates a new task ID
 */
function createTaskId() {
    return `task-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}
/**
 * Creates a default agent configuration
 */
function createDefaultAgentConfig() {
    return {
        maxIterations: 20,
        timeout: 300000, // 5 minutes
        autoApprove: false,
        temperature: 0.7,
        useGraphContext: true,
        enableLoopDetection: true,
    };
}
/**
 * Creates a new agent
 */
function createAgent(name, type, config) {
    const now = new Date().toISOString();
    return {
        id: createAgentId(),
        name,
        type,
        status: 'idle',
        config: { ...createDefaultAgentConfig(), ...config },
        createdAt: now,
        progress: 0,
    };
}
/**
 * Creates a new task
 */
function createTask(task, agentId, priority = 0) {
    return {
        id: createTaskId(),
        task,
        agentId,
        status: 'pending',
        priority,
        createdAt: new Date().toISOString(),
    };
}
/**
 * Gets agent status color for UI
 */
function getAgentStatusColor(status) {
    switch (status) {
        case 'idle':
            return '#8e8e8e';
        case 'initializing':
            return '#4fc3f7';
        case 'running':
            return '#66bb6a';
        case 'paused':
            return '#ffa726';
        case 'completed':
            return '#26a69a';
        case 'failed':
            return '#ef5350';
        case 'cancelled':
            return '#ab47bc';
        default:
            return '#8e8e8e';
    }
}
/**
 * Gets agent status icon for UI
 */
function getAgentStatusIcon(status) {
    switch (status) {
        case 'idle':
            return '$(circle-outline)';
        case 'initializing':
            return '$(sync~spin)';
        case 'running':
            return '$(play)';
        case 'paused':
            return '$(debug-pause)';
        case 'completed':
            return '$(check)';
        case 'failed':
            return '$(error)';
        case 'cancelled':
            return '$(circle-slash)';
        default:
            return '$(circle-outline)';
    }
}
//# sourceMappingURL=types.js.map