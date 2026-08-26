# Architecture

Grok Build GUI is an Electron shell. It does not run an agent loop of its own.

```
renderer  --IPC-->  preload  --IPC-->  main AppStore  --ACP-->  grok agent stdio
                                              |
                                              +-- ~/.grok/sessions/<cwd>/<id>/updates.jsonl
```

## Processes

| Piece | Role |
| --- | --- |
| Renderer | React UI. No Node, no fs, no child_process. Sandboxed. |
| Preload | `contextBridge.exposeInMainWorld("grokApp", …)` — the only API the UI gets. |
| Main | Spawns `grok agent --no-leader stdio`, folds `session/update`, serves a snapshot over IPC. |
| Grok CLI | Source of truth for sessions, tools, MCP, git worktrees, auth. |

The renderer cannot open windows or navigate off the app origin. External
links go through `shell.openExternal` and must be `http` or `https`. A
second instance focuses the existing window instead of spawning another
Grok child.

## Transcript

Live ACP notifications and persisted JSONL share `src/main/transcript.ts`.
Opening a thread replays `updates.jsonl`; streaming continues from the same
shape. Updates are dropped unless they belong to the active session
(`src/main/session-scope.ts`).

The transcript is a separate IPC channel from the rest of app state so
keystrokes and chrome updates do not clone the whole chat.

## Reading column

The composer and plan strip sit in a 920px conversation column. The
transcript itself is a 768px measure, centered in the full-width main pane
so the vertical scrollbar can sit on the window edge.

## Permissions

`ask` shows inline cards. `auto` allows read-ish tools. `always-approve`
(yolo) allows everything. Mode is pushed to the harness via
`session/set_mode` and `_meta.yoloMode` / `autoMode` on `session/new`.
