# Browser Hub — Roadmap

Features planned for `browser-hub`. Items are roughly ordered by dependency, not priority.

## In scope

### Chromium profile support
Parse `Local State` JSON to detect profiles for Chrome, Chromium, Brave, Edge, Vivaldi, Opera.
Chromium stores profiles differently from Gecko (`profiles.ini`) — requires a separate parser.

### Zen workspace per profile
When launching a Zen Browser profile, also select the associated Zen workspace.
Requires reading Zen workspace config and passing the right argument at launch.

### Default browser switcher
Change the system default browser (`xdg-settings set default-web-browser`) from the indicator.
Reference implementation: [totoshko88/browser-switcher](https://github.com/totoshko88/browser-switcher) (GPL-3.0, compatible with AGPL-3.0).

### Default profile per browser
Define a "default" profile per browser that opens when clicking the browser name directly (not a specific profile).
Requires local persistence (GSettings or a JSON file in `$XDG_CONFIG_HOME`).

### Donut browser — isolated ephemeral profile
Create a throw-away browser profile on the fly:
- `mktemp -d` → temporary profile directory
- Launch with `--profile $tmpdir --no-remote`
- Clean up on close (or leave for manual cleanup — TBD)

### Anti-detect / anti-fingerprint (Donut browser)
Inject a `user.js` into the Donut profile at creation time:
- Canvas fingerprint blocking
- WebGL vendor/renderer spoofing
- Timezone spoofing
- Media device enumeration blocking
- Reference: [arkenfox/user.js](https://github.com/arkenfox/user.js)

## Housekeeping

- [ ] Update icon from `firefox-symbolic` to a generic browser icon (`web-browser-symbolic`)
- [ ] Update CI: add pnpm store caching to reduce job time
- [ ] Evaluate `@nicolo-ribaudo/vite-plugin-gnome-shell` vs current manual Rollup config
