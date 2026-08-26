# Grok Build GUI

Codex-style desktop client for the [Grok Build](https://docs.x.ai/build/overview) harness.

This is a **UI shell** around `grok agent stdio`, not a second agent runtime.
Session files under `~/.grok/sessions` stay the source of truth, the same way
[pi-gui](https://github.com/minghinmatthewlam/pi-gui) sits on `pi` and Codex
clients sit on `codex app-server`.

It is not an official xAI product.

## What it talks to

Grok already implements ACP (JSON-RPC over stdio):

```bash
grok agent --no-leader stdio
```

The Electron main process owns that child. The renderer never sees Node,
filesystem, or the agent process. It only gets a typed IPC snapshot: threads,
transcript, tools, approvals, git changes, MCP, models, and usage.

## Features

- Thread sidebar + inbox (needs-input / running)
- Streaming transcript with thoughts, tool calls, and plans
- Composer with `/` commands and `@` file mentions
- Model, reasoning effort, and permission mode (`ask` / `plan` / `auto` / `always-approve`)
- Inline permission cards for `session/request_permission`
- Diff/review panel from `_x.ai/git/status`
- Worktree-aware session metadata from the Grok harness
- MCP / skills / settings views
- Resume, fork, compact, rename, pin, delete via Grok ACP extensions

## Requirements

- Node 22+
- Authenticated Grok CLI (`~/.grok/bin/grok` or `GROK_BIN`)
- `grok login`, or `XAI_API_KEY`

## Run

```bash
npm install
npm run dev
```

Open a folder with **File → Open Folder** (⌘O), then **New thread**.

| Shortcut | Action |
| --- | --- |
| ⌘/Ctrl+N | New thread |
| ⌘/Ctrl+O | Open folder |
| ⌘/Ctrl+B | Toggle sidebar |
| ⌘/Ctrl+D | Toggle review panel |
| ⌘/Ctrl+J | Toggle terminal |
| ⌘/Ctrl+Shift+R | Rename current thread |

## Architecture

```
renderer  --IPC-->  preload  --IPC-->  main AppStore  --ACP-->  grok agent stdio
                                              |
                                              +-- ~/.grok/sessions JSONL
```

- `src/acp` — newline-delimited JSON-RPC multiplexer
- `src/main` — session snapshot, live `session/update` folding, persisted JSONL replay
- `src/renderer` — pi-gui/Codex layout: sidebar, timeline, composer, review
- `src/shared` — protocol types and pure helpers

See [docs/architecture.md](docs/architecture.md) for the process model and
[SECURITY.md](SECURITY.md) for the trust boundary.

Visual language is adapted from pi-gui's Codex tokens (4px spacing, compact
type, hairline elevation). Runtime behavior is Grok's, not a reimplementation.

## Development

```bash
npm run typecheck
npm test
npm run build
```

Contributions are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](./LICENSE)
