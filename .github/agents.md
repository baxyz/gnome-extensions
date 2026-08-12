# Agents & Commit Conventions

This document defines the commit conventions, agent guidelines, and development practices for this monorepo.

## Conventional Commits (with Emoji)

- Format: `type(scope): <emoji> message`
- The emoji is placed between the scope and the message.
- Keep messages concise and imperative.
- Common types:
  - `feat`: new feature
  - `fix`: bug fix
  - `docs`: documentation
  - `refactor`: code refactoring without behavioral change
  - `perf`: performance improvement
  - `test`: tests
  - `ci`: continuous integration
  - `build`: build system or dependencies
  - `chore`: misc tasks with no functional impact
  - `revert`: revert a previous commit

### Monorepo scopes

Root-level scopes: `workspace`, `tooling`, `ci`, `docs`, `agents`, `deps`.

Per-extension scopes: use the extension name as prefix, e.g. `browser-hub`, then optionally narrow with a slash: `browser-hub/extension`, `browser-hub/menu`, `browser-hub/constants`, `browser-hub/build`, `browser-hub/tests`. Same pattern for `firefox-profiles`.

Examples:

- `feat(browser-hub): ✨ support Chromium profiles`
- `fix(browser-hub/runner): 🐛 handle flatpak path edge-case`
- `build(workspace): 🔧 add pnpm workspace filter script`
- `ci(workspace): 🔧 adapt quality-check for monorepo`
- `docs(agents): 🧾 update EGO submission guidelines`

## Git Workflow — Rebase Only

**No merge commits.** Always rebase, never merge.

- Feature branches are rebased onto `main` before merging via PR.
- When syncing a branch with upstream changes: `git rebase origin/main`, not `git merge main`.
- Force-push after rebase: `git push --force-with-lease`.

Using **git absorb** is allowed (and encouraged) to keep a clean history:

```bash
git add -A
git absorb
git rebase -i --autosquash origin/main
git push --force-with-lease
```

> Install if needed: [tummychow/git-absorb](https://github.com/tummychow/git-absorb)

## EGO (extensions.gnome.org) — AI Policy

**Extensions submitted to EGO must not be AI-generated.**

This is an explicit policy in force since December 2025, motivated by reviewer overload from unvetted AI output.

**Rejected patterns:**

- Large amounts of unnecessary code (e.g. redundant try-catch blocks)
- Inconsistent code style
- Calls to non-existent GNOME Shell APIs
- Comments that look like LLM prompts

**Permitted:** using AI as a learning aid or code completion tool, provided **the submitter can justify and explain every line of submitted code**.

Every commit that touches extension source code must represent code the author understands and owns.

Source: [blogs.gnome.org — AI and GNOME Shell Extensions](https://blogs.gnome.org/jrahmatzadeh/2025/12/06/ai-and-gnome-shell-extensions/)
Review guidelines: [gjs.guide — Review Guidelines](https://gjs.guide/extensions/review-guidelines/review-guidelines.html)

## Repository Structure

```text
gnome-extensions/
  extensions/
    firefox-profiles/   ← GNOME indicator for Firefox profile switching (legacy)
    browser-hub/   ← GNOME indicator for any browser profile switching
  tooling/
    tsconfig.base.json  ← shared TypeScript base config
  .github/
    agents.md           ← this file
    workflows/
      quality-check.yml
```

## Extension Development

### Building

```bash
pnpm install                                              # install all deps
pnpm -r build                                             # build all extensions (dist/ includes metadata.json + stylesheet.css)
pnpm --filter @baxyz/browser-hub build               # build one extension
pnpm --filter @baxyz/browser-hub install:local       # build + install locally
```

### Continuous dev

```bash
pnpm --filter @baxyz/browser-hub dev
```

Watch mode: rebuilds on save, auto-installs to `~/.local/share/gnome-shell/extensions/<uuid>/`, and attempts `gnome-extensions disable/enable` to reload. Falls back to a manual reload hint if the CLI isn't available.

First run: enable the extension once via GNOME Extensions app (or `gnome-extensions enable <uuid>`). Subsequent file saves auto-install without further intervention.

### Quality checks

```bash
pnpm -r lint
pnpm -r format:check
pnpm -r test
```

### Local testing

After `pnpm --filter @baxyz/<ext> install:local`, restart GNOME Shell (Wayland: log out/in) and enable via GNOME Extensions app. With `pnpm dev`, the reload is attempted automatically.

### Packaging & EGO submission

```bash
pnpm --filter @baxyz/browser-hub pack     # produces browser-hub.zip
pnpm --filter @baxyz/browser-hub shexli   # static analysis before submission
```

## GNOME Shell Compatibility Updates

When adding a new GNOME Shell major version to an extension:

1. Add the version to `metadata.json` `shell-version`.
2. Add the dev alias in `package.json`: `"@girs/gnome-shell-<N>": "npm:@girs/gnome-shell@<N>"`.
3. Run `pnpm test` to verify compilation across all versions.
4. Verify APIs remain stable; adjust code if needed.
5. Test in a nested Wayland session.

## Logging and Errors

- Use `Main.notify` for user-visible notifications.
- Use `logError` with a context tag for unexpected exceptions.

### Native crashes are not JS exceptions

GNOME Shell/mutter has a real crash class where a native `g_assert` aborts
the whole process (signal 6) — no JS try/catch can prevent it, only reduce
how often the failing code path runs. Confirmed in `browser-hub`: `St:ERROR`
in `st-icon-theme.c`, assertion on `icon_info_get_pixbuf_ready`, hit when
an `St.Icon` is built from a `Gio.Icon` that genuinely fails to decode
(`journalctl` shows `Could not load a pixbuf from icon theme.` right
before every crash). It takes the whole session down, not just the shell —
`gnome-session` tears down every other service the moment
`org.gnome.Shell@ubuntu.service` dumps core.

Any extension handing an untrusted `Gio.Icon` to `St.Icon` — a `Gio.FileIcon`
from a `.desktop` file, a `Gio.EmblemedIcon`, anything not looked up through
`St.IconTheme.has_icon()` first — is exposed to this. See
`extensions/browser-hub/ROADMAP.md`'s "Icon-loading crash hardening"
section for the full diagnosis and fix plan.

---

This document is maintained by project contributors. Keep it concise and actionable.
