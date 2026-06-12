#!/usr/bin/env bash
set -euo pipefail

uuid=$(node -p "JSON.parse(require('fs').readFileSync('metadata.json','utf8'))['uuid']")
dest="$HOME/.local/share/gnome-shell/extensions/$uuid"

pnpm build

rm -rf "$dest"
mkdir -p "$HOME/.local/share/gnome-shell/extensions"
cp -r dist "$dest"

echo "Installed: $dest"
