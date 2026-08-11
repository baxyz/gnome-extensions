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

- [x] Change the system default browser from the indicator.
      `Gio.AppInfo.set_as_default_for_type()` for http/https/text-html (default-browser.ts's `setDefaultBrowser()`) — matches [totoshko88/browser-switcher](https://github.com/totoshko88/browser-switcher)'s approach, no `xdg-settings` subprocess needed.
- [x] One-click way to switch the default browser directly from the toolbar.
      Took the edit-pencil button's slot instead of Settings': it's now a caret that expands a list of detected browsers (icon + name, sourced from the same data as the "Browsers" row) right below the toolbar. Picking one calls `setDefaultBrowser()` and collapses the list. Settings itself is untouched.

### Panel icon: generic vs default browser

- [x] Add a setting to show the resolved default browser's own icon in the panel instead of the generic `web-browser-symbolic`.
      `show-default-browser-panel-icon` (off by default), read at every `_draw()` alongside the other toolbar settings.

### Default profile per browser

- [x] The default profile/space is shown in bold in the menu.
      Detected from `Default=1` in `profiles.ini` (Firefox) and `profile.last_used` in `Local State` (Chromium).
- [x] Click the browser name directly to open the default profile (no GSettings persistence needed — derived from the detected default).
- [ ] Let the user pin a custom default profile (GSettings or `$XDG_CONFIG_HOME` JSON).

### Donut browser — isolated ephemeral profile

- [x] Create a throw-away browser profile on the fly:
  - Directory under `$XDG_RUNTIME_DIR/browser-hub/donut/<uuid>` → launch with `--profile <dir> -no-remote`.
  - Cleanup: none in-menu — `$XDG_RUNTIME_DIR` is removed by the system on logout/reboot (tmpfs-backed), which is also why the dir lives there instead of e.g. `~/.cache`. `--profile` never touches `profiles.ini` either (confirmed against MozillaZine's docs), so there's no registry entry left behind even before that.
  - Firefox-family only (see below) — priority order (default browser first, then Firefox > Zen > Floorp > LibreWolf > Mullvad Browser > Waterfox > Firedragon, then whatever else qualifies) in `donut-browser.ts`'s `findDonutBrowser()`. Snap-packaged browsers are excluded: granting a Flatpak sandbox ad-hoc access to the profile dir works via `flatpak run --filesystem=`, snap's confinement model has no equivalent verified here.
  - Toolbar button (`view-conceal-symbolic`, a real Adwaita icon — "mask"/"spy" don't exist as icons) shows a spinner while the profile directory is being created, and is hidden entirely when no eligible browser is installed. New `show-donut-browser` setting (sub-setting of `show-toolbar`).

### Anti-detect / anti-fingerprint (Donut browser)

- [x] Set fingerprint-resistance prefs in the Donut profile's `user.js` at creation time.
      A single Mozilla pref, `privacy.resistFingerprinting` (RFP — also what Tor Browser uses), already covers all four items originally listed here (canvas, WebGL, timezone, MediaDevices) — no need to hand-roll each one or bundle arkenfox's full 1265-line file. `donut-browser.ts`'s `DONUT_USER_JS` also sets `letterboxing`/`spoof_english` (arkenfox's recommended RFP companions) and forces `browser.privatebrowsing.autostart`, belt-and-suspenders for a profile that's already disposable.
      Chrome family: no equivalent built-in mechanism exists (no pref, no serious CLI flag) — real hardening there needs an extension, force-installed via enterprise policy. Out of scope for now, see below.

### Donut browser follow-ups (not started)

- [ ] Chrome family support — `--user-data-dir` gives an isolated profile easily enough, but there's no `resistFingerprinting` equivalent; would need a force-installed extension (`ExtensionInstallForcelist` policy) for real anti-fingerprinting, not just an isolated profile.
- [ ] Manual browser selection for Donut, in addition to the automatic pick — let the user override `findDonutBrowser()`'s choice from the toolbar.

### Icon-loading crash hardening (GNOME Shell native bug)

GNOME Shell has a native crash class (`St:ERROR` in `st-icon-theme.c`,
assertion on `icon_info_get_pixbuf_ready`, signal 6) triggered by requesting
many icon loads at once — confirmed via `journalctl` on real hardware
(NVIDIA + Wayland). It's a native `g_assert` abort, not a JS exception: no
try/catch can prevent it, only reducing how hard we push the icon loader.

- [x] Stagger the "Browsers" row's icon construction — one line (6 icons) at
      a time with a real delay in between, instead of requesting up to ~50
      icons in one synchronous burst. `buildSimpleBrowserRow()`.
- [x] Extend the same batching to the profiled-family entries loop
      (`buildProfileMenuItem` in `fillMenu()`) — same batch size/delay as
      the Browsers row, paced across every entry's items via a shared
      counter (`makePacer()`).
- [x] Hard cap on how many rows/icons `fillMenu()` ever builds in one pass,
      independent of whether staggering alone is enough — 50 icons total
      across every entry, spent in entry order; a trailing row reports how
      many more are hidden. `truncateEntriesToIconBudget()`.
- [x] Document a manual smoke-test checklist (open the menu with many
      browsers installed, toggle every setting, click every button) to run
      on a real machine before each release — see `SMOKE-TEST.md`.
- [ ] Real e2e harness via a nested GNOME Shell session
      (`dbus-run-session -- gnome-shell --nested --wayland` + AT-SPI/Looking
      Glass) to script "open the menu, assert it doesn't crash" in CI. The
      only real automated protection against this whole class of bug, but
      no known precedent in the GNOME extensions ecosystem to build on —
      big lift, lowest priority unless this recurs.
- [ ] File the bug upstream against `mutter` (`st-icon-theme.c` lives
      there, not `gnome-shell`) — real diagnosis in hand now (exact
      assertion, NVIDIA + Wayland environment, a `journalctl` trace). No
      fix on our side is final; this is a native bug. Closest existing
      precedent found:
      [gnome-shell#1743](https://gitlab.gnome.org/GNOME/gnome-shell/-/issues/1743)
      (2019, same assertion, GTK's icon theme code rather than St's own
      fork of it).

## Ideas to explore (not committed)

### Per-tab media indicator

- Show which tabs are currently playing audio/video, per profile, per browser.
  MPRIS (`org.mpris.MediaPlayer2.*`) only exposes one player per browser _process_, not per tab,
  and doesn't identify which profile launched it (would need to cross-reference the bus owner's
  PID against its `--profile` argv). A real per-tab list would need a companion browser extension
  and native messaging, per browser — a separate project, not an addition to this one.

## Housekeeping

- [x] Update icon from `firefox-symbolic` to a generic browser icon (`web-browser-symbolic`)
- [x] Update CI: add pnpm store caching to reduce job time
      Already done — `cache: pnpm` on every job's `actions/setup-node` step since the workflow's very first commit (6904ed2). The checkbox was just never ticked.
- [x] Evaluate `@nicolo-ribaudo/vite-plugin-gnome-shell` vs current manual Rollup config
