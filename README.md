<div align="center">

# Morse

**A terminal-first AI coding assistant, with a VS Code companion.**

Ask a question, open a chat, or hand a task to an agent that can read, edit, and run commands in the project. Morse talks to many model providers, keeps a local knowledge graph, and can limit what the agent is allowed to touch.

[Install](#install) · [Quick start](#quick-start) · [Providers](#providers) · [Commands](#everyday-commands) · [VS Code](#vs-code)

</div>

---

## Install

You need a recent Rust toolchain ([rustup](https://rustup.rs)).

```bash
git clone https://github.com/bhuvanprakash/morse-cli.git
cd morse-cli
cargo install --path .
```

That installs the `morse` binary. To build without installing:

```bash
cargo build --release
./target/release/morse --help
```

## Quick start

Set a provider key, then check the setup:

```bash
export GROQ_API_KEY="your-key"
morse init
morse doctor
```

Ask something, or open the chat:

```bash
morse ask "what does this repo do?"
morse
```

With no command and no prompt, Morse opens the interactive chat. A prompt on its own is a one-shot question:

```bash
morse "explain src/main.rs"
morse --agent "add a --version flag and run the tests"
```

`--yolo` skips confirmation before tool actions. Leave it off unless you trust the task.

## Providers

Keys come from the environment. They are not written into project config.

| Provider | Variable |
| --- | --- |
| Groq | `GROQ_API_KEY` |
| OpenAI | `OPENAI_API_KEY` |
| Anthropic | `ANTHROPIC_API_KEY` |
| Gemini | `GEMINI_API_KEY` |
| OpenRouter | `OPENROUTER_API_KEY` |
| Together | `TOGETHER_API_KEY` |
| Mistral | `MISTRAL_API_KEY` |
| DeepSeek | `DEEPSEEK_API_KEY` |
| xAI | `XAI_API_KEY` |
| Fireworks | `FIREWORKS_API_KEY` |
| Cerebras | `CEREBRAS_API_KEY` |
| SambaNova | `SAMBANOVA_API_KEY` |
| DeepInfra | `DEEPINFRA_API_KEY` |
| Nebius | `NEBIUS_API_KEY` |
| Novita | `NOVITA_API_KEY` |
| Hyperbolic | `HYPERBOLIC_API_KEY` |
| Lepton | `LEPTON_API_KEY` |
| Azure OpenAI | `AZURE_OPENAI_API_KEY` |
| Amazon Bedrock | `AWS_ACCESS_KEY_ID` |
| Ollama | `OLLAMA_HOST` (defaults to local) |

Pick a model with `--model`, using `provider/model`:

```bash
morse --model groq/llama-3.1-8b-instant ask "summarize the last commit"
morse models
morse models --refresh
```

If the preferred provider has no key, Morse walks a fallback list and will use a labelled mock so offline commands still run.

## Everyday commands

```bash
morse chat                      # interactive chat
morse ask "where is config loaded?"
morse agent "fix the failing test"
morse explain src/lib.rs
morse review
morse fix "error: cannot find value `cfg`"
morse commit                    # draft a commit message
morse doctor
morse health
morse cost
morse limit
```

Pipe input, or read the prompt from a file:

```bash
cat error.log | morse -q "what failed?"
morse -f prompt.txt
```

`-q` prints the answer only, which is what you want in scripts.

## Project memory

`morse init` writes `.morse/config.yaml` in the current project.

```bash
morse trust-init                # write authority.yaml
morse trust-status
morse trust-check src/main.rs

morse graph-build
morse graph-query "Config"
morse graph-impact "load"
morse graph-visualize

morse rag-init
morse rag-search "how are API keys loaded?"

morse memory add style "prefer small functions"
morse memory search style
morse sessions list
morse checkpoint create "before refactor"
morse backup create
```

Trust checks decide what the agent may read or write. The graph is symbol-level. RAG is a semantic index over the same tree.

## Other commands

| Area | Commands |
| --- | --- |
| Git | `diff`, `git-status`, `git-log`, `undo`, `verify` |
| Safety | `rollback`, `checkpoint`, `backup`, `secrets`, `auto-approval` |
| Runtime | `daemon`, `daemon-stop`, `daemon-status`, `serve` |
| Integrations | `mcp`, `lsp`, `native-mac`, `cloud-run`, `cloud-status` |
| Extras | `swarm`, `modes`, `skills`, `ralph`, `slash`, `tutorial`, `docs`, `completion` |

`morse verify` runs the project's build and tests (Cargo, Go, npm, or pytest, depending on what is in the tree).

`morse <command> --help` prints that command's flags. `morse --list` lists every command.

## Global flags

| Flag | What it does |
| --- | --- |
| `-c, --config <file>` | Use a specific config file |
| `--model <provider/model>` | Override the default model |
| `-a, --agent` | Let the assistant use tools for this prompt |
| `--yolo` | Auto-approve tool actions |
| `--no-cache` | Skip the completion cache |
| `-q, --quiet` | Raw answer only |
| `-f, --message-file <file>` | Read the prompt from a file |
| `--output <text\|json\|stream-json>` | Choose the output format |
| `-v, --verbose` | More logging |
| `--no-color` | Disable color |

## VS Code

The editor extension lives in [`morse-vscode`](morse-vscode). It adds chat, explain, fix, edit, test generation, and commit-message commands inside VS Code 1.85 or newer.

```bash
cd morse-vscode
npm install
npm run compile
```

Then use **Extensions: Install from Location...** in VS Code and pick that folder. Open the chat with `Cmd+Shift+M` on macOS, or `Ctrl+Shift+M` elsewhere. Fix a selection with `Cmd+Shift+F` / `Ctrl+Shift+F`.

The extension expects the `morse` binary on your `PATH`.

## Layout

```
src/main.rs       command-line entry
src/lib.rs        library modules
src/agent/        tool-using agent loop
src/providers/    model providers
src/tui/          interactive chat
src/graph/        code knowledge graph
src/rag/          semantic search
src/trust/        path trust boundaries
morse-vscode/     VS Code extension
```

Rust build output, local `.morse` data, and editor caches stay out of git.
