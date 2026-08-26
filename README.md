# Grok Build GUI

Codex-style desktop client for the [Grok Build](https://docs.x.ai/build/overview) harness.

This is a **UI shell** around `grok agent stdio`, not a second agent runtime.
Session files under `~/.grok/sessions` stay the source of truth, the same way
[pi-gui](https://github.com/minghinmatthewlam/pi-gui) sits on `pi` and Codex
clients sit on `codex app-server`.

**It is not an official xAI product.**

## What it talks to

Grok already implements ACP (JSON-RPC over stdio):

```bash
grok agent --no-leader stdio
```

The Electron main process owns that child. The renderer never sees Node,
filesystem, or the agent process. It only gets a typed IPC snapshot: threads,
transcript, tools, approvals, git changes, MCP, models, and usage.

## Features

- Thread sidebar grouped by workspace, with pin / archive / drag-reorder
- Streaming transcript: thoughts, grouped tool summaries, plans
- Lazy tool payloads (labels in RAM, diffs loaded on expand)
- Virtualized timeline for long threads
- Composer with `/` commands, `@` file mentions, and image paste
- Model, reasoning effort, and permission mode (`ask` / `plan` / `auto` / `always-approve`)
- Inline permission cards for `session/request_permission`
- Diff/review panel, integrated terminal, thread find (⌘F)
- Worktrees, fork-from-message, OS notifications when a run finishes
- MCP / skills / settings, weekly SuperGrok usage in the sidebar
- Resume, compact, rename, pin, delete via Grok ACP extensions

## Requirements

- Node 22+
- Authenticated Grok CLI (`~/.grok/bin/grok` or `GROK_BIN`)
- `grok login`, or `XAI_API_KEY`

The packaged app does **not** bundle the Grok CLI. Install and authenticate
`grok` first. macOS `.app` launches have a stripped `PATH`; the app prepends
`~/.grok/bin`, `/opt/homebrew/bin`, and `/usr/local/bin`.

## Run from source

```bash
npm install
npm run dev
```

If you are not already signed in, the app opens a Grok CLI sign-in flow
(`grok login`) before the thread UI. After that, open a folder with
**File → Open Folder** (⌘O), then **New thread**.

| Shortcut | Action |
| --- | --- |
| ⌘/Ctrl+N | New thread |
| ⌘/Ctrl+O | Open folder |
| ⌘/Ctrl+, | Settings |
| ⌘/Ctrl+B | Toggle sidebar |
| ⌘/Ctrl+D | Toggle review panel |
| ⌘/Ctrl+J | Toggle terminal |
| ⌘/Ctrl+F | Find in thread |
| ⌘/Ctrl+Shift+R | Rename current thread |

## Package a local build

Unsigned desktop builds (no Apple notarization):

```bash
npm run package:dir    # unpacked app, fastest to try
npm run package:mac    # .dmg + .zip (macOS)
npm run package:linux  # AppImage
```

Gatekeeper will warn on unsigned macOS builds. That’s expected until a signing
identity is configured.

Maintainers: the signed public-release workflow and checklist are documented in
[docs/releasing.md](docs/releasing.md). Pushing a matching version tag builds a
draft release; it never publishes a release automatically.

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

See [docs/architecture.md](docs/architecture.md) for the process model,
[SECURITY.md](SECURITY.md) for the trust boundary, and [NOTICE](NOTICE) for
attribution.

Visual language is adapted from pi-gui's Codex tokens (4px spacing, compact
type, hairline elevation). Runtime behavior is Grok's, not a reimplementation.

## Development

```bash
npm run typecheck
npm test
npm run build
npm run ci
```

Contributions are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](./LICENSE)
