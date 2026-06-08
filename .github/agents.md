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

Per-extension scopes: use the extension name as prefix, e.g. `browser-profiles`, then optionally narrow with a slash: `browser-profiles/extension`, `browser-profiles/menu`, `browser-profiles/constants`, `browser-profiles/build`, `browser-profiles/tests`. Same pattern for `firefox-profiles`.

Examples:

- `feat(browser-profiles): ✨ support Chromium profiles`
- `fix(browser-profiles/runner): 🐛 handle flatpak path edge-case`
- `build(workspace): 🔧 add pnpm workspace filter script`
- `ci(workspace): 🔧 adapt quality-check for monorepo`
- `docs(agents): 🧾 update EGO submission guidelines`

## Git Absorb (Clean History)

Using **git absorb** is allowed (and encouraged) to keep a clean history.

```bash
git add -A
git absorb
git rebase -i --autosquash origin/main
git push
```

> Install if needed: https://github.com/tummychow/git-absorb

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

Source: https://blogs.gnome.org/jrahmatzadeh/2025/12/06/ai-and-gnome-shell-extensions/
Review guidelines: https://gjs.guide/extensions/review-guidelines/review-guidelines.html

## Repository Structure

```
gnome-extensions/
  extensions/
    firefox-profiles/   ← GNOME indicator for Firefox profile switching (legacy)
    browser-profiles/   ← GNOME indicator for any browser profile switching
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
pnpm -r build                                             # build all extensions
pnpm --filter @baxyz/browser-profiles build               # build one extension
pnpm --filter @baxyz/browser-profiles install:local       # install locally for testing
```

### Quality checks

```bash
pnpm -r lint
pnpm -r format:check
pnpm -r test
```

### Local testing

After `pnpm --filter @baxyz/<ext> install:local`, restart GNOME Shell (Wayland: log out/in) and enable via GNOME Extensions app.

### Packaging & EGO submission

```bash
pnpm --filter @baxyz/browser-profiles pack     # produces browser-profiles.zip
pnpm --filter @baxyz/browser-profiles shexli   # static analysis before submission
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

---

This document is maintained by project contributors. Keep it concise and actionable.
