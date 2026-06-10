# Firefox Profiles

> **Maintained in the [gnome-extensions](https://github.com/baxyz/gnome-extensions) monorepo.**
> Issues and contributions → [baxyz/gnome-extensions](https://github.com/baxyz/gnome-extensions/issues)

Easily launch Firefox with your favorite profile right from the indicator menu!

Supports Firefox (regular, snap, and flatpak), Floorp (flatpak), and Zen (flatpak).

_Note: This extension is not sponsored, endorsed, or affiliated with Mozilla, Firefox, Floorp, or Zen._

## Installation

Install from [GNOME Extensions](https://extensions.gnome.org/) or locally:

```bash
pnpm --filter @baxyz/firefox-profiles install:local
```

## Development

```bash
pnpm install
pnpm --filter @baxyz/firefox-profiles build
pnpm --filter @baxyz/firefox-profiles test
```

### Local testing (Wayland)

```bash
# Install and restart shell
pnpm --filter @baxyz/firefox-profiles install:local
# In the nested session:
gnome-extensions enable firefox-profiles@arnaud.work
```

See the root [agents.md](../../.github/agents.md) for full development workflow.
