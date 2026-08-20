# Quick Exit

Shortens the 60-second countdown GNOME shows before Log Out, Power Off, Restart, or Restart & Install Updates actually happens — configurable down to 1 second, from the extension's Preferences.

It only ever _shortens_ GNOME's own countdown, never lengthens it: it clamps the wait GNOME requested down to the configured value, nothing more.

_Not affiliated with the GNOME Project._

## Installation

Install from [GNOME Extensions](https://extensions.gnome.org/) or locally:

```bash
pnpm --filter @baxyz/quick-exit install:local
```

## Development

```bash
pnpm install
pnpm --filter @baxyz/quick-exit build
pnpm --filter @baxyz/quick-exit test
```

### Local testing (Wayland)

```bash
pnpm --filter @baxyz/quick-exit install:local
# In the nested session:
gnome-extensions enable quick-exit@baxyz.dev
```

See the root [agents.md](../../.github/agents.md) for full development workflow.
