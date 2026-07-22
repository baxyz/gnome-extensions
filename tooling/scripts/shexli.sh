#!/usr/bin/env bash
set -euo pipefail

uuid=$(jq -r '.uuid' metadata.json)

# Scan the actual packaged zip, not the raw dist/ folder — dist/ legitimately
# still contains gschemas.compiled (kept there for `pnpm dev`'s live-reload
# install; see pack.sh), which pack.sh excludes from what's actually shipped.
# Scanning dist/ directly would flag a file the real upload never contains.
pnpm run pack:extension

if ! command -v shexli >/dev/null 2>&1; then
  echo 'shexli not found — install with: pipx install shexli'
  exit 1
fi

# shexli's own CLI always exits 0, findings or not — it's a reporting tool,
# not a CI gate by exit code. Check summary.finding_count from --format json
# ourselves to actually enforce a clean result; the human-readable run right
# after is just for a readable log (running it twice is simpler than
# reformatting the JSON findings by hand).
finding_count=$(shexli --format json "$uuid.zip" | jq -r '.summary.finding_count')

shexli "$uuid.zip"
rm -f "$uuid.zip"

if [ "$finding_count" -gt 0 ]; then
  echo "shexli found $finding_count issue(s) — see above."
  exit 1
fi
