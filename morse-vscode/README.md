# Morse — AI Coding Agent for VS Code

Morse is an AI-powered coding agent that brings the power of large language models directly into your VS Code editor. With HRCA (Human-Reviewed Context Assembly) architecture, Morse helps you fix bugs, implement features, generate tests, and understand code — all with human oversight.

## Features

### 🚀 Quick Actions
- **Fix** (`Ctrl+Shift+F` / `Cmd+Shift+F`): Automatically fix bugs in selected code
- **Edit** (`Ctrl+Shift+E` / `Cmd+Shift+E`): Apply natural language edits to your code
- **Explain** (`Ctrl+Shift+X` / `Cmd+Shift+X`): Get detailed explanations of any code selection
- **Generate Tests**: Create comprehensive test suites for your functions
- **Commit Message**: Generate meaningful commit messages from your changes

### 💬 Interactive Chat
Open the chat panel (`Ctrl+Shift+M` / `Cmd+Shift+M`) for:
- Multi-turn conversations about your codebase
- Context-aware suggestions
- File attachments and references

### 🔍 Smart Completions
- **Inline Completions**: Type `// morse:` followed by your intent for AI-powered completions
- **CodeLens**: Action buttons above functions and classes
- **Context Awareness**: Morse understands your project structure

### 📊 Usage Tracking
Monitor your API usage, token consumption, and estimated costs directly in the status bar.

## Installation

1. Install the Morse CLI:
   ```bash
   npm install -g @morse/cli
   ```

2. Install this VS Code extension from the marketplace

3. Sign in with your Morse account (or create one)

## Configuration

Open VS Code settings (`Ctrl+,`) and search for "Morse" to configure:

| Setting | Description | Default |
|---------|-------------|---------|
| `morse.apiKey` | Your Morse API key | - |
| `morse.model` | Default model to use | `claude-sonnet-4` |
| `morse.enableInlineCompletions` | Show inline suggestions | `true` |
| `morse.enableCodeLens` | Show action buttons above code | `true` |
| `morse.autoApplyEdits` | Automatically apply safe edits | `false` |

## Commands

All commands are available via the Command Palette (`Ctrl+Shift+P`):

- `Morse: Fix` - Fix bugs in selected code
- `Morse: Edit` - Apply natural language edits
- `Morse: Open Chat` - Open the chat panel
- `Morse: Explain Selection` - Explain the selected code
- `Morse: Generate Tests` - Create tests for selected code
- `Morse: Generate Commit Message` - Generate commit message from changes
- `Morse: Sign In` - Authenticate with Morse
- `Morse: Open Dashboard` - Open web dashboard

## Keybindings

| Shortcut | Command |
|----------|---------|
| `Ctrl+Shift+F` / `Cmd+Shift+F` | Morse: Fix |
| `Ctrl+Shift+M` / `Cmd+Shift+M` | Morse: Open Chat |

## Requirements

- VS Code 1.85.0 or higher
- Morse CLI installed globally
- Active Morse account (free tier available)

## Support

- [Documentation](https://morse.sh/docs)
- [GitHub Issues](https://github.com/morse-sh/morse-vscode/issues)
- [Discord Community](https://discord.gg/morse)

## License

MIT License - see LICENSE file for details
