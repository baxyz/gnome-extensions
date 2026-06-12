#!/usr/bin/env bash
set -euo pipefail

uuid=$(node -p "JSON.parse(require('fs').readFileSync('metadata.json','utf8'))['uuid']")

pnpm build
(cd dist && zip "../$uuid.zip" -9r .)

echo "Packed: $uuid.zip"
