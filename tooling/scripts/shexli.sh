#!/usr/bin/env bash
set -euo pipefail

pnpm build

shexli "$PWD/dist" || (echo 'shexli not found — install with: pipx install shexli' && exit 1)
