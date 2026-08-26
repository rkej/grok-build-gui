# Repo guidelines

These rules apply for the full session. Path-scoped notes live in nested
`AGENTS.md` files.

## Product

This repo is a Codex-style **desktop UI** for the Grok Build harness.
Preserve that direction. It is a shell around `grok agent --no-leader stdio`,
not a second agent loop.

- Session files under `~/.grok/sessions` stay the source of truth.
- Transcript, timeline, session isolation, and Codex-style UX are product
  features, not polish.
- Desktop work is not done until it is verified on the real Electron surface.

## Structure

- `src/acp` — newline-delimited JSON-RPC to the Grok child
- `src/main` — Electron main: AppStore, git, files, billing, IPC
- `src/preload` — the only bridge the renderer may use
- `src/renderer` — React UI
- `src/shared` — types and pure helpers used on both sides
- `tests/` — Node unit tests for pure helpers

Keep the renderer/main/preload boundary tight. Do not expose broad Node APIs
through preload.

## Commands

```bash
npm run dev
npm run typecheck
npm test
npm run build
```

## Safety

- Never delete user session history under `~/.grok/sessions` without approval.
- Don't widen renderer filesystem access. Confine renderer-facing git/file
  IPC to the workspace.
- ACP `fs/*` is honored for the Grok child; that is a different boundary.
