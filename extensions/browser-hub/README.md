# Browser Hub

Launch any browser profile from the GNOME indicator — Firefox, Floorp, LibreWolf, Waterfox, Zen, IceCat, Palemoon, and more.

_Not affiliated with any browser vendor._

## Installation

Install from [GNOME Extensions](https://extensions.gnome.org/) or locally:

```bash
pnpm --filter @baxyz/browser-hub install:local
```

## Development

```bash
pnpm install
pnpm --filter @baxyz/browser-hub build
pnpm --filter @baxyz/browser-hub test
```

### Local testing (Wayland)

```bash
pnpm --filter @baxyz/browser-hub install:local
# In the nested session:
gnome-extensions enable browser-hub@baxyz.dev
```

See the root [agents.md](../../.github/agents.md) for full development workflow.
