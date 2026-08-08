import Gio from "gi://Gio";
import { PackageManager } from "../taxonomy";
import type { ResolvedBrowserPkg } from "../taxonomy";
import { getDesktopAppInfo } from "./gio";

// Filenames under the badge assets dir set via setBadgeIconsDir() below (see
// vite.config.ts's staticAssets plugin for how assets/badges/ ends up in
// dist/assets/badges/). Native has no badge — it's the unmarked default.
const BADGE_FILENAMES: Partial<Record<PackageManager, string>> = {
  [PackageManager.Flatpak]: "flatpak-badge.svg",
  [PackageManager.Snap]: "snap-badge.svg",
};

// Set once from extension.ts's enable() (this.dir.get_child("assets").get_child("badges")),
// which is the only place with access to the extension's own install
// directory — internal/ modules are otherwise plain functions with no `this`.
// Left null in tests and anywhere else that never calls the setter, which
// makes badge lookup (and therefore emblem-wrapping below) a deliberate no-op
// rather than a crash.
let badgeIconsDir: Gio.File | null = null;

/** Sets the directory badge SVGs are loaded from. Call once, from enable(). */
export function setBadgeIconsDir(dir: Gio.File): void {
  badgeIconsDir = dir;
}

// Only 2 possible icons ever exist — cached by filename, never invalidated
// (the files ship with the extension and can't change while it's running).
const badgeIconCache = new Map<string, Gio.Icon>();

function badgeIconFor(manager: PackageManager): Gio.Icon | undefined {
  const filename = BADGE_FILENAMES[manager];
  if (!filename || !badgeIconsDir) return undefined;
  let icon = badgeIconCache.get(filename);
  if (!icon) {
    icon = Gio.FileIcon.new(badgeIconsDir.get_child(filename));
    badgeIconCache.set(filename, icon);
  }
  return icon;
}

/** Also used by default-browser.ts's setDefaultBrowser() to resolve a Gio.DesktopAppInfo. */
export function desktopIdFor(pkg: ResolvedBrowserPkg): string {
  switch (pkg.manager) {
    case PackageManager.Native:
      return pkg.desktopId ?? `${pkg.binary}.desktop`;
    case PackageManager.Flatpak:
      return `${pkg.appId}.desktop`;
    case PackageManager.Snap:
      // snapd registers desktop files as "<snap>_<snap>.desktop" under
      // /var/lib/snapd/desktop/applications (confirmed for Brave: snapd
      // renamed "brave.desktop" from inside the snap to "brave_brave.desktop"
      // — see snapcrafters/brave#4) — plain "<snap>.desktop" never matches.
      return `${pkg.name}_${pkg.name}.desktop`;
  }
}

// Package/binary presence rarely changes mid-session — see pkg.ts's cache for
// the same rationale. Cleared alongside it (clearDesktopIconCache below).
//
// Keyed by desktopIdFor(pkg) (a string), not the pkg object itself: the
// default browser's own pkg is rebuilt fresh on every menu open (see
// default-browser.ts's clearDefaultBrowserCache(), called from the same
// open-state-changed handler that redraws the toolbar) — an object-identity
// key would never hit for it, defeating the cache on the one call site that
// runs on every single menu open.
let desktopIconCache = new Map<string, Gio.Icon | null>();

/** Clears the desktop icon cache. Called on extension disable and manual refresh. */
export function clearDesktopIconCache(): void {
  desktopIconCache = new Map();
}

/**
 * Resolves a browser's own real icon, as declared in its installed .desktop
 * file, via GNOME's own app database — no guessed icon-theme name involved.
 * `${binary|appId|name}.desktop` is a guess (not guaranteed for Native/Snap,
 * always correct for Flatpak sandboxing), but a wrong guess just means no
 * matching app is found: returns undefined and the menu shows nothing rather
 * than a wrong icon.
 *
 * Flatpak/Snap results are wrapped in a Gio.EmblemedIcon carrying a small
 * package-manager badge — St's texture cache renders GEmblemedIcon natively
 * (composites and positions the emblem itself), so this needs no rendering
 * code of its own anywhere icons are drawn.
 */
export function resolveDesktopIcon(pkg: ResolvedBrowserPkg): Gio.Icon | undefined {
  const desktopId = desktopIdFor(pkg);
  if (desktopIconCache.has(desktopId)) return desktopIconCache.get(desktopId) ?? undefined;
  const baseIcon = getDesktopAppInfo(desktopId)?.get_icon() ?? null;
  let icon: Gio.Icon | null = baseIcon;
  if (baseIcon) {
    const badge = badgeIconFor(pkg.manager);
    if (badge) icon = Gio.EmblemedIcon.new(baseIcon, Gio.Emblem.new(badge));
  }
  desktopIconCache.set(desktopId, icon);
  return icon ?? undefined;
}
