#!/usr/bin/env bash
set -euo pipefail

pnpm build

if ! command -v shexli >/dev/null 2>&1; then
  echo 'shexli not found — install with: pipx install shexli'
  exit 1
fi

shexli "$PWD/dist"
