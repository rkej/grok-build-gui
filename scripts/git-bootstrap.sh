#!/bin/zsh
set -euo pipefail
cd /Users/rkej/dev/stonks/grok-build-gui
{
  echo "=== git status ==="
  git status 2>&1 || true
  echo "=== git remote -v ==="
  git remote -v 2>&1 || true
  echo "=== gh auth status ==="
  gh auth status 2>&1 || true
  echo "=== git log ==="
  git log -1 --oneline 2>&1 || echo "NO_COMMITS"
} | tee /tmp/grok-build-gui-git-preflight.txt
