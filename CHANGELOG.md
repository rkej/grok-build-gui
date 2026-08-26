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
- Unsigned local packaging (`npm run package:mac` / `package:linux`)
- Renderer sandbox, single-instance lock, and http(s)-only window opens
- PATH defaults so packaged apps still find `~/.grok/bin/grok` and Homebrew
- Thread chat header (workspace · Local/worktree, title, running/relative time)
- Empty workspace/session canvases matching pi-gui
- Live “Working for Xs” label, ⌘/, settings, topbar zoom on double-click

### Security

- Removed a local-only renderer helper that wrote to the integrated terminal

## [0.1.0] - 2026-08-21

### Added

- Electron desktop shell over `grok agent --no-leader stdio`
- Thread sidebar, streaming transcript, composer, review panel, terminal
