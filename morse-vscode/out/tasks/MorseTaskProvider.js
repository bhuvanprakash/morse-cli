"use strict";
/**
 * Task Provider for Morse AI-suggested TODO/FIXME tracking
 * Tracks tasks suggested by AI and provides quick navigation
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
exports.MorseTaskProvider = void 0;
exports.registerTaskProvider = registerTaskProvider;
const vscode = __importStar(require("vscode"));
class MorseTaskProvider {
    tasks = new Map();
    _onDidChangeTasks = new vscode.EventEmitter();
    onDidChangeTasks = this._onDidChangeTasks.event;
    constructor() {
        // Watch for configuration changes
        vscode.workspace.onDidChangeConfiguration(() => {
            this._onDidChangeTasks.fire();
        });
    }
    provideTasks(token) {
        const tasks = [];
        // Convert internal tasks to VS Code tasks
        this.tasks.forEach((task) => {
            if (task.status !== 'completed' && task.status !== 'dismissed') {
                const execution = new vscode.ShellExecution(`echo "Morse Task: ${task.title}"`);
                const vscodeTask = new vscode.Task({ type: 'morse', task: task.id }, vscode.TaskScope.Workspace, task.title, 'morse', execution, task.priority === 'high' ? '$$' : task.priority === 'medium' ? '$' : undefined);
                vscodeTask.detail = task.description;
                tasks.push(vscodeTask);
            }
        });
        // Also scan for TODO/FIXME comments in the workspace
        this.scanForComments(tasks);
        return tasks;
    }
    resolveTask(task, token) {
        return task;
    }
    /**
     * Scan workspace for TODO/FIXME comments
     */
    async scanForComments(tasks) {
        const config = vscode.workspace.getConfiguration('morse');
        const scanComments = config.get('taskScanComments', true);
        if (!scanComments)
            return;
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders)
            return;
        for (const folder of workspaceFolders) {
            const pattern = new vscode.RelativePattern(folder, '**/*.{ts,js,tsx,jsx,py,go,rs}');
            const files = await vscode.workspace.findFiles(pattern, '**/node_modules/**', 100);
            for (const file of files) {
                try {
                    const document = await vscode.workspace.openTextDocument(file);
                    const text = document.getText();
                    // Find TODO and FIXME comments
                    const todoRegex = /(?:\/\/|\/\*|#|;;)\s*(TODO|FIXME|HACK|XXX):?\s*(.*)/gi;
                    let match;
                    while ((match = todoRegex.exec(text)) !== null) {
                        const line = document.positionAt(match.index).line;
                        const lineText = document.lineAt(line).text;
                        const execution = new vscode.ShellExecution(`echo "Open ${file.path}:${line + 1}"`);
                        const commentTask = new vscode.Task({ type: 'morse-comment', file: file.path, line: line.toString() }, vscode.TaskScope.Workspace, `TODO: ${match[2] || 'Task'}`, 'morse', execution);
                        commentTask.detail = `${file.path}:${line + 1} - ${lineText.trim()}`;
                        tasks.push(commentTask);
                    }
                }
                catch {
                    // Skip files that can't be read
                }
            }
        }
    }
    /**
     * Add a new task
     */
    addTask(task) {
        const id = `morse-task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const now = new Date();
        this.tasks.set(id, {
            ...task,
            id,
            createdAt: now,
            updatedAt: now
        });
        this._onDidChangeTasks.fire();
        return id;
    }
    /**
     * Update an existing task
     */
    updateTask(id, updates) {
        const task = this.tasks.get(id);
        if (!task)
            return false;
        this.tasks.set(id, {
            ...task,
            ...updates,
            updatedAt: new Date()
        });
        this._onDidChangeTasks.fire();
        return true;
    }
    /**
     * Delete a task
     */
    deleteTask(id) {
        const deleted = this.tasks.delete(id);
        if (deleted) {
            this._onDidChangeTasks.fire();
        }
        return deleted;
    }
    /**
     * Get all tasks
     */
    getAllTasks() {
        return Array.from(this.tasks.values());
    }
    /**
     * Get task by ID
     */
    getTask(id) {
        return this.tasks.get(id);
    }
    /**
     * Clear all tasks
     */
    clearTasks() {
        this.tasks.clear();
        this._onDidChangeTasks.fire();
    }
    /**
     * Show task picker and execute action
     */
    async showTaskPicker(title, action) {
        const tasks = this.getAllTasks().filter(t => t.status !== 'completed');
        if (tasks.length === 0) {
            vscode.window.showInformationMessage('No Morse tasks found');
            return;
        }
        const items = tasks.map(task => ({
            label: `$(circle-filled) ${task.title}`,
            description: `${task.status} - ${task.priority} priority`,
            detail: task.description,
            task
        }));
        const selected = await vscode.window.showQuickPick(items, {
            title,
            placeHolder: 'Select a task'
        });
        if (selected) {
            action(selected.task);
        }
    }
    /**
     * Create task from AI suggestion
     */
    createFromAISuggestion(suggestion) {
        return this.addTask({
            title: suggestion.title,
            description: suggestion.description,
            priority: suggestion.priority || 'medium',
            status: 'pending',
            source: 'ai-suggestion'
        });
    }
    dispose() {
        this._onDidChangeTasks.dispose();
    }
}
exports.MorseTaskProvider = MorseTaskProvider;
/**
 * Register the task provider
 */
function registerTaskProvider(context) {
    const taskProvider = new MorseTaskProvider();
    // Register the task provider
    const registration = vscode.workspace.registerTaskProvider('morse', taskProvider);
    // Register commands
    const addTaskCommand = vscode.commands.registerCommand('morse.addTask', async () => {
        const title = await vscode.window.showInputBox({
            title: 'Task Title',
            placeHolder: 'Enter task title'
        });
        if (!title)
            return;
        const description = await vscode.window.showInputBox({
            title: 'Task Description',
            placeHolder: 'Enter task description (optional)'
        });
        const priority = await vscode.window.showQuickPick(['low', 'medium', 'high'], {
            title: 'Priority',
            placeHolder: 'Select priority'
        });
        taskProvider.addTask({
            title,
            description: description || '',
            priority: priority || 'medium',
            status: 'pending',
            source: 'manual'
        });
        vscode.window.showInformationMessage(`Task "${title}" added`);
    });
    const showTasksCommand = vscode.commands.registerCommand('morse.showTasks', async () => {
        await taskProvider.showTaskPicker('Morse Tasks', (task) => {
            const actions = ['Mark In Progress', 'Mark Completed', 'Dismiss'];
            vscode.window.showQuickPick(actions, {
                title: `Action for: ${task.title}`,
                placeHolder: 'Select action'
            }).then(async (action) => {
                if (!action)
                    return;
                switch (action) {
                    case 'Mark In Progress':
                        taskProvider.updateTask(task.id, { status: 'in-progress' });
                        break;
                    case 'Mark Completed':
                        taskProvider.updateTask(task.id, { status: 'completed' });
                        break;
                    case 'Dismiss':
                        taskProvider.updateTask(task.id, { status: 'dismissed' });
                        break;
                }
            });
        });
    });
    const clearTasksCommand = vscode.commands.registerCommand('morse.clearTasks', async () => {
        const confirm = await vscode.window.showWarningMessage('Are you sure you want to clear all Morse tasks?', { modal: true }, 'Yes', 'No');
        if (confirm === 'Yes') {
            taskProvider.clearTasks();
            vscode.window.showInformationMessage('All tasks cleared');
        }
    });
    context.subscriptions.push(registration, addTaskCommand, showTasksCommand, clearTasksCommand);
    return {
        dispose: () => {
            registration.dispose();
            addTaskCommand.dispose();
            showTasksCommand.dispose();
            clearTasksCommand.dispose();
            taskProvider.dispose();
        }
    };
}
//# sourceMappingURL=MorseTaskProvider.js.map