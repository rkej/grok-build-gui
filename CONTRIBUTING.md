# Contributing

Thanks for wanting to improve Grok Build GUI. This is a Codex-style desktop
shell around `grok agent stdio`, not a fork of the Grok harness.

## Prerequisites

- Node 22+
- An authenticated Grok CLI (`~/.grok/bin/grok` or `GROK_BIN`) if you need to
  run the app against a live agent
- npm (this repo's lockfile is `package-lock.json`)
- Build config is `electron.vite.config.ts` (not `vite.config.ts`)

```bash
npm install
npm run dev          # Electron app, hot reload
npm run typecheck
npm test
npm run build
npm run package:dir  # unpacked desktop build (unsigned)
```

macOS is the source of truth for desktop UI. Linux is fine for typecheck,
tests, and packaging experiments.

## What "done" means

- **Keep the renderer/main/preload boundary tight.** The renderer must not
  gain Node, filesystem, or child_process access. Add IPC, don't widen
  `contextBridge`.
- **Do not reimplement Grok.** Session JSONL under `~/.grok/sessions` is the
  source of truth. Prefer adapting ACP / `_x.ai/*` behavior over inventing a
  second runtime.
- **Verify on the real surface.** Transcript, session switching, plan strip,
  and composer changes are product features. Unit tests are not enough for
  those.
- **Keep PRs focused.** One logical change per PR.

## Tests

`npm test` runs Node's test runner via `tsx` against `tests/`. These cover
pure helpers (session scoping, plan merge, path confinement, JSON-RPC
classify). They do not spawn Electron or Grok.

If you change `src/main/session-scope.ts`, `src/shared/plan.ts`,
`src/shared/workspace-path.ts`, or `src/acp/rpc.ts`, add or update a test.

## Pull requests

- Describe what changed and how you verified it.
- `npm run typecheck` and `npm test` must pass.
- UI changes: say what you clicked in the Electron app.
- Do not paste AI-generated walls of text. Short and specific wins.

## License

By contributing, you agree that your contributions are licensed under the
[MIT License](./LICENSE).
