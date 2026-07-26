# Ideas for new extensions

Not committed to. Once one of these turns into real work, it gets its own folder
under `extensions/` and its own `ROADMAP.md`.

## Recent files (macOS-style)

A panel indicator listing recently-opened files/folders, à la macOS's Recent Items.

- Recent files/folders come from `~/.local/share/recently-used.xbel`, the standard
  freedesktop "recently used" bookmark file most GTK/Qt apps write to automatically.
  See the kiwi-menu note below for how to actually read it from `extension.js`
  (not via `Gtk.RecentManager` — see why there).
- Looked at [grizzlysmit/files-launcher](https://github.com/grizzlysmit/files-launcher)
  (EGO: [files-launcher](https://extensions.gnome.org/extension/8247/files-launcher/))
  as a reference. License is `SPDX-License-Identifier: GPL-2.0-or-later` per its file
  headers (not GPL-3.0 as initially assumed — no `LICENSE` file in the repo, but every
  source file states it) — compatible, extracting from it would be legally fine.
  Not worth it in practice though: it's a manual "add files/folders to a launcher
  menu" tool, not automatic recent-file tracking, so the hard/interesting part
  doesn't overlap; and its own code style (verbose debug logging via `new Error()`
  stack captures left in, commented-out dead imports, 1000+ line `extension.js`)
  doesn't match this repo's conventions and would need a full rewrite anyway.
  Better to build directly on `Gio.RecentManager` from scratch.
- Also looked at [kem-a/kiwi-menu](https://github.com/kem-a/kiwi-menu)
  (EGO: [kiwi-menu](https://extensions.gnome.org/extension/8697/kiwi-menu/)),
  license `GPL-3.0-or-later` — its `src/recentItemsSubmenu.js` is genuinely
  useful, unlike files-launcher:
  - Correction to the point above: there is no `Gio.RecentManager` — recent-files
    tracking (`GtkRecentManager`) lives in GTK, which `extension.js` can't import
    (Shell-process/GTK separation, same rule prefs.ts follows in the other
    direction). kiwi-menu hand-parses `~/.local/share/recently-used.xbel` (the
    XBEL bookmark file) directly via `Gio.File.load_bytes_async` + a regex over
    `<bookmark href="..." modified="..."><title>...</title>` entries — no Gtk
    needed. That's the real approach to use.
  - For "recent/frequently used apps" specifically, `Shell.AppUsage.get_default().get_most_used()`
    is the real, official Shell API — the same one GNOME Shell's own app-grid
    "Frequent Apps" folder uses. Better than guessing at a private file.
  - Not worth lifting the code itself: most of its ~700 lines is a hover-state
    machine for opening this as a *submenu* nested inside kiwi-menu's own larger
    menu (bridging pointer tolerance between the submenu item and the flyout,
    close-on-leave timeouts, etc.) — complexity that only exists because it's
    nested. A standalone extension would show recent items directly in its own
    top-level popup and wouldn't need any of that.
