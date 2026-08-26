# Security

This app is a **desktop UI shell** around the local Grok CLI. It is not a
second agent runtime. That shapes the threat model.

## Report a vulnerability

Please **do not** open a public issue for security reports.

Use GitHub's private vulnerability reporting on this repository (Security →
Report a vulnerability). Include:

- Grok Build GUI version / commit
- OS and Electron version if relevant
- Steps to reproduce
- Impact (what an untrusted renderer, malicious session file, or URL can do)

## What this process can and cannot do

The Electron renderer is isolated: no Node, no filesystem, no child_process.
It talks to main only through the typed IPC surface in `src/preload` /
`src/main/ipc.ts`.

The **Grok agent child** (`grok agent --no-leader stdio`) is a local coding
agent. It already has filesystem and process access comparable to the user
who launched the app. ACP `fs/read_text_file` and `fs/write_text_file` are
honored because the child can do the same work with its own tools.

Renderer-facing file preview, git stage/discard, and `openExternal` are
narrower: paths must stay inside the workspace (or `~/.grok` for session
files), and external URLs must be `http(s)`.

## Out of scope

- Bugs that require an already-compromised Grok CLI or a stolen `~/.grok/auth.json`
- Prompt injection against the Grok agent (report those to the Grok CLI /
  xAI, not this UI)
- Unsigned local builds and lack of notarization — packaging is not set up yet
