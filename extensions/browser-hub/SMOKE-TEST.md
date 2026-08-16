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
hardening") is confirmed fixed as of 2026-08-14, after two earlier fix
attempts each looked sufficient from a green `pnpm test` run and real-machine
confirmation that the fix was installed/active, and weren't. A third round
moved the package-manager badge off the same validated-`Gio.FileIcon` path
entirely (CSS `background-image` instead), which changes what's actually at
risk again — still worth a `journalctl -g st-icon-theme` check across a few
real sessions after any change in this area, not just trusting green tests.

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
- [ ] Open the menu, close it, open it again: the content appears instantly
      the second time, with no re-staggering/flicker — the menu is only
      rebuilt on an actual data change (refresh, a setting, setting the
      default browser, a Donut launch finishing), not on every open.
- [ ] If you have a browser with both an old (`~/.mozilla/...`) and new
      (`$XDG_CONFIG_HOME/...`) profile location — commonly Firefox itself —
      it appears exactly once in the flat icon row, not twice.

## Toolbar

- [ ] Refresh button re-scans and updates the menu.
- [ ] Settings button opens the preferences window.

## Default browser & Donut rows

- [ ] "Launch default browser" row: the icon matches the actual default
      browser (hover shows its name in the tooltip); clicking anywhere on
      the row (not the trailing button) launches it and closes the menu.
- [ ] Its trailing chevron button opens a page showing every pickable
      browser, with a back button and title at the top — not an inline
      list pushing the rest of the menu down.
- [ ] Picking a browser on that page sets it as default (no error),
      returns to the main menu, and the row's icon/tooltip update to match.
- [ ] "Launch temporary session" row: clicking the row launches Donut with
      the auto-picked browser (spinner while the profile is being
      created), same as the trailing chevron's page does for a manually
      picked one. Hidden entirely if no eligible browser is installed.
- [ ] Its trailing chevron opens a page listing every Donut-eligible
      browser; picking one returns to the main menu and launches Donut
      with _that_ browser, not the auto-pick.
- [ ] With enough installed browsers to exceed the picker page's list
      height (see `.browser-hub-picker-scroll`'s CSS `max-height`), the
      list scrolls instead of growing the popup off-screen.
- [ ] Open a picker page, close the popup (don't click back), reopen it:
      you land on the main menu, not still on the picker page.

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
