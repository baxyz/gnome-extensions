# Claude Code — Project Context

Full canonical rules (commit format, restrictions, license) live in the workspace's
[AGENTS.md](https://github.com/baxyz/.dev/blob/main/AGENTS.md); project-specific deltas are in
[AGENTS.md](AGENTS.md) at this repo's root. Key points:

## Git

- **Rebase only — no merge commits.** Sync branches with `git rebase origin/main`, not `git merge`.
- Force-push after rebase: `git push --force-with-lease`.
- Scopes: see `scopes.json`.

## Monorepo

- Workspace packages under `extensions/*`
- Run all: `pnpm -r <script>` — run one: `pnpm --filter @baxyz/<name> <script>`
- After rename/add of a workspace package: `pnpm install --no-frozen-lockfile` to update `pnpm-lock.yaml`

## CI

- `shexli` requires an **absolute path**: `shexli "$PWD/dist"` — relative `dist/` breaks `path.relative_to()`
- Lockfile must be committed and in sync with all workspace `package.json` files

## EGO AI Policy

Extensions submitted to EGO must not be AI-generated. Every line of submitted code must be
understood and owned by the author. See [AGENTS.md](AGENTS.md) for details.
