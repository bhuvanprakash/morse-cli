"use strict";
/**
 * Morse Walkthrough/Onboarding
 * Welcome walkthrough and first-time setup wizard
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
exports.FirstTimeSetupWizard = exports.MorseWalkthrough = void 0;
exports.registerWalkthroughFeatures = registerWalkthroughFeatures;
const vscode = __importStar(require("vscode"));
const WELCOME_WALKTHROUGH = [
    {
        id: 'welcome',
        title: 'Welcome to Morse',
        description: 'Morse is an AI-powered coding assistant that helps you write, debug, and refactor code faster.',
    },
    {
        id: 'setup-api',
        title: 'Set Up Your API Key',
        description: 'To get started, you need to configure your AI provider API key. You can use OpenAI, Anthropic, Google Gemini, or any supported provider.',
        button: { title: 'Configure API Key', command: 'morse.selectProvider' },
    },
    {
        id: 'open-chat',
        title: 'Start Coding',
        description: 'Open the Morse chat panel to start chatting with the AI. You can ask questions, request code changes, or get explanations.',
        button: { title: 'Open Chat', command: 'morse.chat' },
    },
    {
        id: 'features',
        title: 'Explore Features',
        description: 'Morse offers many features including inline completions, code lens suggestions, diff editing, and more. Check the command palette for all options.',
        button: { title: 'View Commands', command: 'workbench.action.showCommands' },
    },
];
const QUICK_START_WALKTHROUGH = [
    {
        id: 'quick-start',
        title: 'Quick Start Guide',
        description: 'Learn the basics of using Morse in your workflow.',
    },
    {
        id: 'inline-completion',
        title: 'Inline Completion',
        description: 'Morse provides inline code completions as you type. Just press Tab to accept suggestions.',
    },
    {
        id: 'chat-assistant',
        title: 'Chat Assistant',
        description: 'Use the chat panel to have conversations about your code. Ask questions or request changes.',
    },
    {
        id: 'code-actions',
        title: 'Code Actions',
        description: 'Use commands like Fix, Edit, Explain, and Test to refactor and understand your code.',
    },
];
class MorseWalkthrough {
    context;
    client;
    hasShownWelcome = false;
    constructor(context, client) {
        this.context = context;
        this.client = client;
    }
    async showWelcomeWalkthrough() {
        // Check if welcome has been shown before
        const hasShownWelcome = this.context.globalState.get('morse.welcomeShown', false);
        if (!hasShownWelcome) {
            // Show welcome walkthrough
            await this.executeWalkthrough(WELCOME_WALKTHROUGH, 'Welcome to Morse');
            // Mark as shown
            await this.context.globalState.update('morse.welcomeShown', true);
        }
        this.hasShownWelcome = true;
    }
    async showQuickStartGuide() {
        await this.executeWalkthrough(QUICK_START_WALKTHROUGH, 'Quick Start Guide');
    }
    async showFeatureTour() {
        const featureSteps = [
            {
                id: 'mode-selection',
                title: 'Mode Selection',
                description: 'Morse supports different modes: Code, Ask, Architect, Debug, and more. Select the right mode for your task.',
                button: { title: 'Select Mode', command: 'morse.selectMode' },
            },
            {
                id: 'provider-selection',
                title: 'Provider Selection',
                description: 'Choose from multiple AI providers. Each provider has different models and pricing.',
                button: { title: 'Select Provider', command: 'morse.selectProvider' },
            },
            {
                id: 'session-management',
                title: 'Session Management',
                description: 'Your conversations are saved in sessions. You can resume previous sessions anytime.',
                button: { title: 'View Sessions', command: 'morse.sessions' },
            },
            {
                id: 'marketplace',
                title: 'Plugins & Skills',
                description: 'Extend Morse with plugins and skills from the marketplace.',
                button: { title: 'Browse Marketplace', command: 'morse.marketplace' },
            },
        ];
        await this.executeWalkthrough(featureSteps, 'Feature Tour');
    }
    async executeWalkthrough(steps, title) {
        // Create a walkthrough panel
        const panel = vscode.window.createWebviewPanel('morseWalkthrough', title, vscode.ViewColumn.One, {
            enableScripts: true,
            retainContextWhenHidden: true,
        });
        const html = this.generateWalkthroughHTML(steps, title);
        panel.webview.html = html;
        // Handle button clicks
        panel.webview.onDidReceiveMessage(async (message) => {
            if (message.command === 'executeCommand' && message.commandId) {
                await vscode.commands.executeCommand(message.commandId);
            }
            else if (message.command === 'close') {
                panel.dispose();
            }
            else if (message.command === 'nextStep') {
                // Navigate to next step
            }
            else if (message.command === 'prevStep') {
                // Navigate to previous step
            }
        });
    }
    generateWalkthroughHTML(steps, title) {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            padding: 20px;
            max-width: 800px;
            margin: 0 auto;
            background: #1e1e1e;
            color: #cccccc;
        }
        .step {
            display: none;
            padding: 20px;
            border: 1px solid #3c3c3c;
            border-radius: 8px;
            margin-bottom: 20px;
        }
        .step.active {
            display: block;
        }
        .step h2 {
            color: #569cd6;
            margin-top: 0;
        }
        .step p {
            line-height: 1.6;
        }
        .button-container {
            display: flex;
            gap: 10px;
            margin-top: 20px;
        }
        button {
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
        }
        .primary-button {
            background: #007acc;
            color: white;
        }
        .secondary-button {
            background: #3c3c3c;
            color: white;
        }
        .nav-buttons {
            display: flex;
            justify-content: space-between;
            margin-top: 20px;
        }
        .progress {
            display: flex;
            justify-content: center;
            gap: 8px;
            margin-bottom: 20px;
        }
        .progress-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #3c3c3c;
        }
        .progress-dot.active {
            background: #007acc;
        }
    </style>
</head>
<body>
    <h1>${title}</h1>
    
    <div class="progress" id="progress"></div>
    
    ${steps.map((step, index) => `
    <div class="step ${index === 0 ? 'active' : ''}" data-step="${index}">
        <h2>${step.title}</h2>
        <p>${step.description}</p>
        ${step.button ? `
        <div class="button-container">
            <button class="primary-button" onclick="executeCommand('${step.button.command}')">${step.button.title}</button>
        </div>
        ` : ''}
    </div>
    `).join('')}
    
    <div class="nav-buttons">
        <button class="secondary-button" id="prevBtn" onclick="prevStep()">Previous</button>
        <button class="secondary-button" id="nextBtn" onclick="nextStep()">Next</button>
    </div>

    <script>
        let currentStep = 0;
        const totalSteps = ${steps.length};

        function updateProgress() {
            const progress = document.getElementById('progress');
            progress.innerHTML = '';
            for (let i = 0; i < totalSteps; i++) {
                const dot = document.createElement('div');
                dot.className = 'progress-dot' + (i === currentStep ? ' active' : '');
                progress.appendChild(dot);
            }
        }

        function showStep(stepIndex) {
            const steps = document.querySelectorAll('.step');
            steps.forEach((step, i) => {
                step.classList.toggle('active', i === stepIndex);
            });
            
            document.getElementById('prevBtn').disabled = stepIndex === 0;
            document.getElementById('nextBtn').textContent = stepIndex === totalSteps - 1 ? 'Finish' : 'Next';
            
            currentStep = stepIndex;
            updateProgress();
        }

        function nextStep() {
            if (currentStep < totalSteps - 1) {
                showStep(currentStep + 1);
            } else {
                // Close the walkthrough
                vscode.postMessage({ command: 'close' });
            }
        }

        function prevStep() {
            if (currentStep > 0) {
                showStep(currentStep - 1);
            }
        }

        function executeCommand(commandId) {
            vscode.postMessage({ command: 'executeCommand', commandId: commandId });
        }

        // Initialize
        updateProgress();
    </script>
</body>
</html>`;
    }
}
exports.MorseWalkthrough = MorseWalkthrough;
class FirstTimeSetupWizard {
    context;
    client;
    constructor(context, client) {
        this.context = context;
        this.client = client;
    }
    async start() {
        const panel = vscode.window.createWebviewPanel('morseSetup', 'Morse Setup Wizard', vscode.ViewColumn.One, {
            enableScripts: true,
            retainContextWhenHidden: true,
        });
        const html = this.generateSetupHTML();
        panel.webview.html = html;
        panel.webview.onDidReceiveMessage(async (message) => {
            if (message.command === 'selectProvider') {
                await vscode.commands.executeCommand('morse.selectProvider');
            }
            else if (message.command === 'selectModel') {
                await vscode.commands.executeCommand('morse.selectModel');
            }
            else if (message.command === 'openChat') {
                await vscode.commands.executeCommand('morse.chat');
            }
            else if (message.command === 'complete') {
                await this.context.globalState.update('morse.setupCompleted', true);
                panel.dispose();
            }
            else if (message.command === 'skip') {
                panel.dispose();
            }
        });
    }
    generateSetupHTML() {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Morse Setup Wizard</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            padding: 40px;
            max-width: 600px;
            margin: 0 auto;
            background: #1e1e1e;
            color: #cccccc;
        }
        h1 {
            color: #569cd6;
            text-align: center;
        }
        .step {
            background: #252526;
            border: 1px solid #3c3c3c;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
        }
        .step h3 {
            color: #4ec9b0;
            margin-top: 0;
        }
        .step p {
            color: #cccccc;
            line-height: 1.6;
        }
        .button-container {
            display: flex;
            gap: 10px;
            justify-content: center;
            margin-top: 20px;
        }
        button {
            padding: 10px 20px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
        }
        .primary-button {
            background: #007acc;
            color: white;
        }
        .secondary-button {
            background: #3c3c3c;
            color: white;
        }
        .skip-link {
            display: block;
            text-align: center;
            margin-top: 20px;
            color: #666;
            cursor: pointer;
        }
    </style>
</head>
<body>
    <h1>🚀 Welcome to Morse!</h1>
    <p style="text-align: center; color: #888;">Let's get you set up in just a few steps</p>

    <div class="step">
        <h3>Step 1: Select Your AI Provider</h3>
        <p>Choose an AI provider that you'd like to use. Morse supports OpenAI, Anthropic, Google Gemini, and many more.</p>
        <div class="button-container">
            <button class="primary-button" onclick="vscode.postMessage({ command: 'selectProvider' })">Select Provider</button>
        </div>
    </div>

    <div class="step">
        <h3>Step 2: Choose a Model</h3>
        <p>Select the AI model that best fits your needs. Different models have different capabilities and pricing.</p>
        <div class="button-container">
            <button class="primary-button" onclick="vscode.postMessage({ command: 'selectModel' })">Select Model</button>
        </div>
    </div>

    <div class="step">
        <h3>Step 3: Start Coding!</h3>
        <p>You're all set! Open the Morse chat panel to start chatting with the AI assistant.</p>
        <div class="button-container">
            <button class="primary-button" onclick="vscode.postMessage({ command: 'openChat' })">Open Chat</button>
        </div>
    </div>

    <div class="button-container">
        <button class="secondary-button" onclick="vscode.postMessage({ command: 'complete' })">Complete Setup</button>
    </div>

    <a class="skip-link" onclick="vscode.postMessage({ command: 'skip' })">Skip for now</a>
</body>
</html>`;
    }
}
exports.FirstTimeSetupWizard = FirstTimeSetupWizard;
function registerWalkthroughFeatures(context, client) {
    const walkthrough = new MorseWalkthrough(context, client);
    const setupWizard = new FirstTimeSetupWizard(context, client);
    // Show welcome walkthrough on first activation
    setTimeout(() => {
        walkthrough.showWelcomeWalkthrough();
    }, 3000);
    // Register commands
    context.subscriptions.push(vscode.commands.registerCommand('morse.walkthrough.showWelcome', () => {
        walkthrough.showWelcomeWalkthrough();
    }));
    context.subscriptions.push(vscode.commands.registerCommand('morse.walkthrough.quickStart', () => {
        walkthrough.showQuickStartGuide();
    }));
    context.subscriptions.push(vscode.commands.registerCommand('morse.walkthrough.featureTour', () => {
        walkthrough.showFeatureTour();
    }));
    context.subscriptions.push(vscode.commands.registerCommand('morse.setupWizard.start', () => {
        setupWizard.start();
    }));
}
//# sourceMappingURL=Walkthrough.js.map