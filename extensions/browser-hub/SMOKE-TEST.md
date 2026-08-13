# Manual smoke test

Automated tests (`pnpm test`) cover logic, not the real GNOME Shell
environment — icon loading, native crashes, and menu-open UX only show up on
a real (or nested) session. Run this checklist on real hardware before
tagging a release. It exists because at least two regressions in this
extension's history (the submenu that could never open, the icon-loading
crash) only surfaced this way, after the automated suite was already green.

Ideally test with several profiled browsers installed (Firefox and/or
Chromium with 3+ profiles each) plus several simple browsers, to exercise
the icon-heavy code paths — a machine with only one or two browsers won't
trigger the icon-loading crash class or the 50-icon cap.

The icon-loading crash specifically (see ROADMAP.md's "Icon-loading crash
hardening") has now looked fixed twice and wasn't, either time — a green
`pnpm test` run does not close that item, and neither does confirming the
fix is actually installed/active (both were true the second time and it
still crashed 4 times in one boot). Watch `journalctl -g st-icon-theme` for
a repeat of the `st-icon-theme.c` assertion across a few real sessions on
the affected (NVIDIA + Wayland) hardware before considering it confirmed.
If it recurs again, don't assume the same fix shape (decode-validate a
specific `Gio.FileIcon`) is even the right layer — check first whether
`journalctl --user -g browser-hub` around the crash timestamp shows a
"dropping undecodable..." warning; its absence means the crashing icon
isn't going through either validated path (base icon or badge) at all.

## Setup

- [ ] `pnpm --filter @baxyz/browser-hub install:local` — builds and copies
      `dist/` into `~/.local/share/gnome-shell/extensions/`. First run on a
      given machine needs a GNOME Shell restart to discover the extension
      (log out/in on Wayland, `Alt`+`F2` → `r` on X11), then
      `gnome-extensions enable browser-hub@baxyz.dev`. Re-running
      `install:local` afterwards disables/re-enables it automatically to
      pick up the new build — no restart needed for later iterations.

## Menu

- [ ] Click the panel icon: the menu opens with no delay and no crash.
- [ ] Every browser you have installed appears, with its own icon (not the
      generic fallback, unless that browser genuinely has no `.desktop`
      icon).
- [ ] Flatpak/Snap browsers show their package-manager badge; native ones
      don't.
- [ ] Firefox/Chromium profiles: the default profile's name is bold.
- [ ] Clicking a profile/browser name launches it.
- [ ] Clicking a Zen workspace launches Zen (workspace switching itself
      depends on an unreleased Zen flag — see ROADMAP.md — so landing on
      the right workspace isn't expected yet).
- [ ] Close the menu mid-load (open it, close it immediately) a few times —
      no crash, no stuck "Loading…" row on the next open.

## Toolbar

- [ ] Donut button: spinner while the profile is created, then launches;
      hidden if no eligible browser is installed.
- [ ] Refresh button re-scans and updates the menu.
- [ ] Settings button opens the preferences window.
- [ ] Default-browser row: shows the current default; expanding it lists
      every browser; picking one sets it as default with no error, and the
      panel/menu reflect the change on next open.

## Settings — each toggle, on and off

- [ ] `show-firefox-family`
- [ ] `show-chrome-family`
- [ ] `show-simple-browsers`
- [ ] `show-profiled-browsers`
- [ ] `show-single-profile-detail`
- [ ] `firefox-profile-groups-mode`
- [ ] `show-zen-workspaces`
- [ ] `show-toolbar` (also hides its two sub-settings' rows when off)
- [ ] `show-default-browser-edit` (sub-setting of `show-toolbar`)
- [ ] `show-default-browser-panel-icon`
- [ ] `show-donut-browser` (sub-setting of `show-toolbar`)
- [ ] Turning every toggle off: menu shows "Nothing to show", not empty or
      broken.

## Failure paths

- [ ] Rename/remove a profile's `.desktop` file (or point `HOME` at a
      throwaway directory with a malformed `profiles.ini`) and confirm the
      menu still opens, with an error banner naming the affected browser
      instead of losing the whole row.
