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
#
# shexli 0.2.1 (latest release, April 2026) hard-codes `major > 50` as an
# "implausible future release", so a stable GNOME 51 entry trips EGO-M-004.
# Skip that rule only when every shell-version entry is a plain major
# version: then nothing else in the rule (invalid value, alpha/beta/rc) can
# be what fired it.
ignored_rule=""
if jq -e '.["shell-version"] | length > 0 and all(type == "string" and test("^[0-9]+$"))' \
  metadata.json >/dev/null; then
  ignored_rule="EGO-M-004"
fi
report=$(shexli --format json "$uuid.zip")
finding_count=$(jq --arg ignored "$ignored_rule" '[.findings[] | select(.rule_id != $ignored)] | length' <<<"$report")
ignored_count=$(jq --arg ignored "$ignored_rule" '[.findings[] | select(.rule_id == $ignored)] | length' <<<"$report")

shexli "$uuid.zip"
rm -f "$uuid.zip"
if [ "$ignored_count" -gt 0 ]; then
  echo "Note: $ignored_rule ignored (shexli 0.2.1 rejects any shell-version above 50)."
fi

if [ "$finding_count" -gt 0 ]; then
  echo "shexli found $finding_count issue(s) — see above."
  exit 1
fi
