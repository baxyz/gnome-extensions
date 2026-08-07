# Browser Hub — Roadmap

Features planned for `browser-hub`. Items are roughly ordered by dependency, not priority.

## In scope

### Browser detection

- [x] Firefox profile support (profiles.ini parser)
- [x] Chromium profile support (Local State JSON parser)
- [x] Falkon profile support (directory listing)
- [x] Simple browser support (binary presence check)
- [x] Flatpak and Snap package managers

### Zen workspace per profile

- [x] Zen workspaces are read and listed per profile.
      Workspace switching on launch sends `--zen-workspace <name>`, which isn't
      recognized by any released Zen Browser yet — see
      [zen-browser/desktop#14104](https://github.com/zen-browser/desktop/pull/14104)
      (open, changes requested as of 2026-07-09), which adds exactly this flag
      with matching syntax. Kept as-is: harmless on current Zen versions, and
      will start working on its own once that PR merges and users update.

### Package manager badge

- [x] Show a small emblem (Flatpak/Snap) on each browser icon, in the Browsers row and in the detailed sections. Native is unmarked (the default).
      No Flatpak/Snap icon exists in Adwaita — two SVGs (`assets/badges/`, recolored from real official marks, see `assets/badges/NOTICE.md`) ship with the extension instead, applied via `Gio.EmblemedIcon` in `resolveDesktopIcon()`. St's texture cache renders `GEmblemedIcon` natively, so every call site got the badge for free with no rendering changes.

### Default browser switcher

- [ ] Change the system default browser (`xdg-settings set default-web-browser`) from the indicator.
      Reference implementation: [totoshko88/browser-switcher](https://github.com/totoshko88/browser-switcher) (GPL-3.0, compatible with AGPL-3.0).
- [ ] Replace the toolbar's Settings button with a one-click dropdown to switch the default browser directly.
      Needs a decision first: where Settings moves (long-press? main menu? its own icon?) once the dropdown takes its spot.

### Panel icon: generic vs default browser

- [x] Add a setting to show the resolved default browser's own icon in the panel instead of the generic `web-browser-symbolic`.
      `show-default-browser-panel-icon` (off by default), read at every `_draw()` alongside the other toolbar settings.

### Default profile per browser

- [x] The default profile/space is shown in bold in the menu.
      Detected from `Default=1` in `profiles.ini` (Firefox) and `profile.last_used` in `Local State` (Chromium).
- [x] Click the browser name directly to open the default profile (no GSettings persistence needed — derived from the detected default).
- [ ] Let the user pin a custom default profile (GSettings or `$XDG_CONFIG_HOME` JSON).

### Donut browser — isolated ephemeral profile

- [ ] Create a throw-away browser profile on the fly:
  - `mktemp -d` → temporary profile directory
  - Launch with `--profile $tmpdir --no-remote`
  - Clean up on close (or leave for manual cleanup — TBD)

### Anti-detect / anti-fingerprint (Donut browser)

- [ ] Inject a `user.js` into the Donut profile at creation time:
  - Canvas fingerprint blocking
  - WebGL vendor/renderer spoofing
  - Timezone spoofing
  - Media device enumeration blocking
  - Reference: [arkenfox/user.js](https://github.com/arkenfox/user.js)

## Ideas to explore (not committed)

### Per-tab media indicator

- Show which tabs are currently playing audio/video, per profile, per browser.
  MPRIS (`org.mpris.MediaPlayer2.*`) only exposes one player per browser _process_, not per tab,
  and doesn't identify which profile launched it (would need to cross-reference the bus owner's
  PID against its `--profile` argv). A real per-tab list would need a companion browser extension
  and native messaging, per browser — a separate project, not an addition to this one.

## Housekeeping

- [x] Update icon from `firefox-symbolic` to a generic browser icon (`web-browser-symbolic`)
- [ ] Update CI: add pnpm store caching to reduce job time
- [x] Evaluate `@nicolo-ribaudo/vite-plugin-gnome-shell` vs current manual Rollup config
