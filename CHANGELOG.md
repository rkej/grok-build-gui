# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- MIT license, contributing guide, code of conduct, and security policy
- GitHub Actions CI for typecheck, unit tests, and production build
- Unit tests for session scoping, plan merge, path confinement, and JSON-RPC classify
- Contributor-facing `AGENTS.md` (root and path-scoped)
- Unsigned local packaging (`npm run package:mac` / `package:linux` / `package:win`)
- Hybrid public releases: attested Linux and unsigned Windows builds from CI,
  with signed and notarized macOS builds assembled locally
- Renderer sandbox, single-instance lock, and http(s)-only window opens
- PATH defaults so packaged apps still find `~/.grok/bin/grok` and Homebrew
- Sign-in gate that runs SpaceXAI OAuth in-process (PKCE loopback, device-code fallback) and writes `~/.grok/auth.json`
- Setup screen that shows the official Grok CLI install command for the current OS
- Paste an `XAI_API_KEY` on the sign-in screen (stored owner-only in `~/.grok/gui-api-key`)
- Thread chat header (workspace · Local/worktree, title, running/relative time)
- Empty workspace/session canvases matching pi-gui
- Live “Working for Xs” label, ⌘/, settings, topbar zoom on double-click
- Thought blocks render their text; thread composer is one line until it grows
- File → New Thread opens the new-thread surface instead of creating a session
- Folder rows: chevron collapses, name focuses the workspace
- Settings: show-thoughts toggle and thinking-level pills

### Fixed

- Integrated terminal no longer spawns macOS `script` over pipes (`tcgetattr/ioctl: Operation not supported on socket`)
- Attachment-only sends on an existing thread were dropped
- Compact did not reload the on-disk transcript
- Deleting a session left it in pin/archive lists
- Native window theme ignored Appearance settings
- Integrated terminal accepted any cwd from the renderer

### Security

- Removed a local-only renderer helper that wrote to the integrated terminal

## [0.1.0] - 2026-08-21

### Added

- Electron desktop shell over `grok agent --no-leader stdio`
- Thread sidebar, streaming transcript, composer, review panel, terminal
