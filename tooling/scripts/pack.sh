#!/usr/bin/env bash
set -euo pipefail

uuid=$(jq -r '.uuid' metadata.json)

pnpm build
(cd dist && zip "../$uuid.zip" -9r .)

echo "Packed: $uuid.zip"
