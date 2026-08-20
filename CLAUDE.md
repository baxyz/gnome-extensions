# Claude Code — Project Context

See [.github/agents.md](.github/agents.md) for full conventions. Key points:

## Git

- **Rebase only — no merge commits.** Sync branches with `git rebase origin/main`, not `git merge`.
- Force-push after rebase: `git push --force-with-lease`.
- Conventional commits: `type(scope): <emoji> message`
- Scopes: `workspace`, `tooling`, `ci`, `docs`, `agents`, `deps`, `browser-hub`, `firefox-profiles`, `quick-exit`

## Monorepo

- Workspace packages under `extensions/*`
- Run all: `pnpm -r <script>` — run one: `pnpm --filter @baxyz/<name> <script>`
- After rename/add of a workspace package: `pnpm install --no-frozen-lockfile` to update `pnpm-lock.yaml`

## CI

- `shexli` requires an **absolute path**: `shexli "$PWD/dist"` — relative `dist/` breaks `path.relative_to()`
- Lockfile must be committed and in sync with all workspace `package.json` files

## EGO AI Policy

Extensions submitted to EGO must not be AI-generated. Every line of submitted code must be understood and owned by the author. See agents.md for details.
