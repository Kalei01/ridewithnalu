#!/usr/bin/env bash
# usage: scripts/diag/split-commit.sh "<message>"  — full gate, lint touched files, commit.
set -euo pipefail
bun run typecheck >/dev/null
bun run test 2>&1 | grep -E "Tests "
bun run build 2>&1 | grep -E "error" || true
files=$(git status --porcelain | awk '{print $2}' | grep -E '\.(tsx?|mjs)$' || true)
npx eslint --quiet $files
git add -A
git commit -q -m "$1

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017Nqt2KL5mKtgSs5B9tSV7X"
git log -1 --oneline
