#!/usr/bin/env bash
set -euo pipefail

uuid=$(jq -r '.uuid' metadata.json)

pnpm build
# `zip` updates an existing archive rather than starting fresh — without
# this, a stale zip from a previous run keeps entries (e.g. gschemas.compiled,
# excluded below) that the current build no longer produces or intends to ship.
rm -f "$uuid.zip"
# gschemas.compiled is kept in dist/ (see vite.config.ts's gnomeSchemas
# plugin) for `pnpm dev`'s live-reload install, which copies dist/ straight
# into ~/.local/share/gnome-shell/extensions/ and bypasses the compile step
# the real install pipeline normally does. EGO review flags shipping a
# pre-compiled schema as an unnecessary build artifact for GNOME 45+ (its
# own install pipeline compiles the schema itself) — exclude it here, at
# packaging time, rather than not compiling it at all.
(cd dist && zip "../$uuid.zip" -9r . -x schemas/gschemas.compiled)

echo "Packed: $uuid.zip"
