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

- [x] Show a small emblem (Flatpak/Snap) on the "Browsers" row's icon buttons — the only place a browser's package manager isn't already spelled out in a visible text label. Native is unmarked (the default).
      No Flatpak/Snap icon exists in Adwaita — two SVGs (`assets/badges/`, recolored from real official marks, see `assets/badges/NOTICE.md`) ship with the extension instead. Originally composited into the resolved `Gio.Icon` via `Gio.EmblemedIcon` — moved to a plain CSS `background-image` overlay (`menu/shared.ts`'s `withBadge()`, `Clutter.BinLayout`) after that path turned out to be a second, unvalidated source of the icon-loading crash below: the emblem was rendered by St's icon-theme loader at a size this codebase never validated. A CSS background goes through St's texture cache instead, not the icon-theme loader.

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
It also takes the whole session down, not just gnome-shell — `journalctl`
shows `gnome-session` tearing down every other service the moment
`org.gnome.Shell@ubuntu.service` dumps core.

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

**Staggering/capping alone did not fix it.** Confirmed by `journalctl`: the
exact same crash recurred on 2026-08-12 12:23, a full day after all four
`[x]` items above had already shipped and been reinstalled. Root cause
found by reading the source, not yet fixed:

- `resolveDesktopIcon()` (`internal/desktop-icon.ts`) returns each
  browser's _real_ `.desktop` icon via `Gio.DesktopAppInfo.get_icon()`.
  For the Flatpak/Snap browsers (Zen, Chrome, brave, firefox, opera in
  local testing) this is a `Gio.FileIcon`, sometimes wrapped in a
  `Gio.EmblemedIcon` for the package-manager badge. It's handed straight
  to `St.Icon` via `iconProps()` (`menu/shared.ts`) with **no
  existence/load validation** — a plain file path, trusted as-is.
- Contrast with `resolve-icon.ts`'s symbolic catalog path, which _does_
  validate every name via `theme().has_icon()` before use
  (`firstExistingIcon()`). That asymmetry is exactly why a crash-repro
  extension built from `icon-catalog.ts`'s symbolic names never
  reproduced anything (it was deleted — see below): it only bursts icons
  guaranteed to load successfully. The real crashes are always preceded
  in `journalctl` by `Could not load a pixbuf from icon theme.` — a
  genuine decode failure, not a pure timing race. Staggering makes a
  single bad load less likely to land inside a burst, but doesn't stop
  it from crashing the shell the moment it does land, staggered or not.
- Deleted `extensions/icon-burst-crash-repro/` (2026-08-12, untracked,
  never a real fix candidate) rather than fixing it, since a correct
  repro would need to target this FileIcon/EmblemedIcon path specifically
  — burst _that_ instead of symbolic names, if a repro is ever worth
  rebuilding.

- [x] Validate every `Gio.FileIcon` from `resolveDesktopIcon()` before it
      reaches `St.Icon` — a real, cached `GdkPixbuf.Pixbuf.new_from_file_at_size()`
      decode probe (bounded to 64×64, above every `icon_size` this extension
      renders), rejecting both a thrown decode error and a decoded-but-
      degenerate (0×0) pixbuf — the same failure shape as
      [GNOME/gtk#3077](https://gitlab.gnome.org/GNOME/gtk/-/issues/3077)
      (a 1px-wide thumbnail made `gdk_pixbuf_scale_simple` return null,
      tripping the same "pixbuf not ready" assertion one layer down). A
      file that fails either check degrades exactly like an unmatched `desktopId` always
      has: `resolveDesktopIcon()` returns `undefined`, and every consumer
      (`shared.ts`, `toolbar.ts`, `indicator.ts`'s panel icon) already
      falls back to the generic icon with no changes needed. `Gio.ThemedIcon`
      results are left unvalidated — deliberately: they aren't a
      `Gio.LoadableIcon`, so validating one would mean reimplementing
      `St.IconTheme`'s own name resolution, and there's no evidence this
      path is involved (the same reason the symbolic-icon catalog never
      reproduced the crash applies here — the risk is specifically files
      third-party packaging pipelines ship, not GNOME's own).
      `internal/desktop-icon.ts`'s `isFileIcon()`/`isDecodableIconFile()`.
      A failed decode is logged once (`desktopId` + path via
      `logIfUnexpected()`), giving the concrete example needed to file
      upstream — folded into validation instead of separate instrumentation.
      Considered and rejected: a dedicated `icons/safe-icon.ts` wrapping
      every `St.Icon` construction site — a `src/`-wide grep found exactly
      one call site that ever fetches a real `.desktop` icon
      (`desktopIconResolver`), so a cross-cutting abstraction would be pure
      indirection with no additional safety. Not yet confirmed against the
      real crash — see the note below.
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
      fork of it) — a broad web search (2026-08-12) found no filed issue
      against this exact assertion in St's own fork specifically, so this
      still looks like a real gap worth filing once the decode-validation
      logging above gives a concrete `Gio.Icon` example to attach. Also worth checking
      whether Fedora's mutter build differs (patch, or just a different
      GPU/driver/session-type combination than the NVIDIA+Wayland box this
      was diagnosed on) — anecdotally Fedora shows a generic icon instead
      of crashing on the same kind of load failure.

**Not closed from green tests alone.** The staggering/capping mitigations
above also looked sufficient until a full day of real use proved otherwise
— this fix isn't considered confirmed until it survives a few real sessions
on the affected (NVIDIA + Wayland) hardware with no repeat of the
`st-icon-theme.c` assertion in `journalctl`.

**The decode-validation fix above still wasn't enough.** Confirmed installed
and active (verified byte-identical against the running session's
`~/.local/share/gnome-shell/extensions/browser-hub@baxyz.dev/internal.js`),
it still let the crash recur 4 times in one boot on 2026-08-13
(22:02:57, 22:03:39, 22:04:06, 22:07:34) — and critically, **no
`[browser-hub] couldn't decode icon file` warning was logged before any of
them**, meaning the crashing icon never went through the validated path at
all. Reading `desktop-icon.ts` end-to-end (not just the changed function)
found the actual gap:

- The package-manager **badge** SVGs (`badgeIconResolver`, feeding
  `Gio.EmblemedIcon`'s emblem) were never validated — the fix only covered
  `resolveDesktopIcon()`'s _base_ `Gio.FileIcon`. The comment justifying
  that exclusion reasoned "ships with the extension, trusted" — true for
  provenance, irrelevant to the actual failure mode: an emblem is rendered
  by St at some fraction of `icon_size` that this module never sees or
  controls, and a source that decodes fine at one target size can still
  round to a degenerate 0×0 pixbuf at a smaller one. The badge is attached
  to _every_ Flatpak/Snap browser's icon — exactly the package types every
  crash observed since 2026-08-09 has involved.
- Separately, the probe itself only ever checked one size (64×64) — well
  above every size this extension renders at (16/24), but nowhere near
  the much smaller size an emblem overlay actually gets rendered at. A
  file passing a 64px probe says nothing about whether it survives
  scaling down to ~5-10px.

Both gaps are the same root mistake: validating at a provenance/size that
doesn't match how St actually renders the icon, instead of validating
against every size and every `Gio.FileIcon` that reaches `St.Icon`.

- [x] Validate the package-manager badge SVGs through the same decode
      probe as a browser's own `.desktop` icon, instead of skipping them —
      `badgeIconResolver` now rejects an undecodable badge file the same
      way `desktopIconResolver` rejects an undecodable app icon: falls
      back to the unbadged base icon (never to no icon at all — a missing
      badge is cosmetic, not worth losing the whole entry over).
- [x] Widened `ICON_DECODE_PROBE_SIZES` from a single 64px check to
      `[2, 14, 16, 24, 64]` — every `icon_size` this extension actually
      renders at (14/16 profile rows, 24 Browsers row), plus a 2px floor
      near the smallest anything could ever be asked to render (catches an
      emblem-scale failure regardless of the exact fraction St picks) and
      the original 64px ceiling (the large-source-thumbnail shape from
      [GNOME/gtk#3077](https://gitlab.gnome.org/GNOME/gtk/-/issues/3077)).
      Stops at the first size that fails — one bad size condemns the whole
      file, no need to keep probing.
- [x] Fixed `clearDesktopIconCache()`: it cleared `desktopIconResolver`
      and the decode-probe cache, but not `badgeIconResolver`'s own
      cache — meaning a badge's pass/fail verdict, once cached, could
      never actually be re-evaluated even after a manual refresh. Latent
      since the badge resolver was added; harmless before badges were
      ever validated, a real bug now that they are.
- [x] Test coverage in `test/desktop-icon.test.ts`: a clean badge still
      badges normally; a badge that throws on decode falls back to the
      unbadged icon; a badge that's degenerate at only the _smallest_
      probed size (the exact shape that slipped past the old 64px-only
      probe) is caught and falls back too; the decode failure is logged
      with the badge's own path; a badge is validated at most once and
      shared across every browser using that package manager; validation
      re-runs after `clearDesktopIconCache()`. Plus a probe-loop
      short-circuit test on the existing base-icon suite.
- [x] Still not confirmed against the real crash — this is now the second
      fix attempt. Watch `journalctl -g st-icon-theme` across real sessions
      on the affected (NVIDIA + Wayland) hardware; don't consider this
      closed just because it's shipped and tests are green (see the note
      above — that's exactly what happened last time). **Confirmed fixed**
      (2026-08-14, reported directly by the user after real-machine
      testing) — no further recurrence.

**Third round: cleanup after the crash was confirmed fixed.** With the
crash itself resolved, three follow-up issues surfaced from real use, plus
two simplifications:

- [x] Firefox and "Firefox (classic)" (and any other family with both an
      XDG and pre-XDG profiles.ini path — see `expandFirefoxVariants`)
      resolve to the _same_ package, so `resolveDesktopIcon()`'s cache
      correctly gave them the same icon verdict — but the "Browsers" row
      still showed both as separate buttons, which read as two of a
      browser's icons being broken when only one identity's icon actually
      was. `resolve-all.ts`'s `dedupeByPkg()` (keyed by
      `internal/pkg.ts`'s new `pkgKey()`, also now shared with
      `donut-browser.ts`'s `samePkg()`) collapses the Browsers row to one
      button per actual installed identity — the detailed per-family
      sections are unaffected, where each profiles.ini variant's own
      profile list can genuinely differ.
- [x] The package-manager badge moved off `Gio.EmblemedIcon` entirely (see
      "Package manager badge" above) — CSS `background-image`, not a
      composited `Gio.Icon`, so it never touches St's icon-theme loader at
      all. Simpler than probing it, and removes an entire class of risk
      instead of trying to validate it correctly.
- [x] `ICON_DECODE_PROBE_SIZES` dropped back to `[16, 24]` — the two real
      sizes a `.desktop` icon is ever rendered at in this codebase. The 2px
      floor and 64px ceiling were only ever justified by the badge/emblem
      risk, which no longer exists now that badges are CSS.
- [x] `resolveDesktopIcon()` now tries a `"<name>-symbolic"` icon from the
      browser's own icon set (validated via the same `St.IconTheme.has_icon()`
      lookup the Firefox-avatar/Zen-workspace icons already use — a name
      check, not a file decode, so none of the risk above applies) before
      falling back to the fully generic icon — including when the real
      `.desktop` icon exists but fails decode validation, not only when
      none is found at all. Many apps ship one alongside their main icon;
      whether this covers most real browsers isn't confirmed yet.
- [x] `indicator.ts` no longer busts the default-browser cache and
      rebuilds the whole menu widget tree on every menu open — only on an
      actual data change (manual refresh, a setting change, setting the
      default browser, a Donut launch finishing). The default browser
      shown can now go stale between an external change
      (gnome-control-center, `xdg-settings`) and the next refresh — an
      accepted tradeoff, refresh is the explicit way to pick that up now.
      Removed the `open-state-changed` signal connection entirely along
      with the `_menuIsOpen` field it existed to maintain.

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
