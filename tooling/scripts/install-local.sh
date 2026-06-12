#!/usr/bin/env bash
set -euo pipefail

uuid=$(jq -r '.uuid' metadata.json)
dest="$HOME/.local/share/gnome-shell/extensions/$uuid"

pnpm build

rm -rf "$dest"
mkdir -p "$HOME/.local/share/gnome-shell/extensions"
cp -r dist "$dest"

echo "Installed: $dest"

if gnome-extensions info "$uuid" &>/dev/null; then
  gnome-extensions disable "$uuid" && gnome-extensions enable "$uuid"
  echo "Reloaded:  $uuid"
else
  echo "Restart GNOME Shell to discover the extension, then re-run to reload automatically."
fi
