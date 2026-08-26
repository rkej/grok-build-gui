# Main process

- Own the Grok ACP child here. The renderer never talks to it.
- Add IPC in `ipc.ts` rather than calling `ipcMain.handle` from feature files.
- Live `session/update` folding lives in `transcript.ts`. Session isolation
  lives in `session-scope.ts`. Do not apply an update to the on-screen
  transcript unless it belongs to the active session.
- Renderer-facing `readFile` / git paths must go through `resolveInside`.
