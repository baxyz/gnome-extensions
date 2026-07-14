import type Gio from "gi://Gio";
import { PackageManager } from "../taxonomy";
import type { ResolvedBrowserPkg } from "../taxonomy";
import { getDesktopAppInfo } from "./gio";

function desktopIdFor(pkg: ResolvedBrowserPkg): string {
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
let desktopIconCache = new WeakMap<ResolvedBrowserPkg, Gio.Icon | null>();

/** Clears the desktop icon cache. Called on extension disable and manual refresh. */
export function clearDesktopIconCache(): void {
  desktopIconCache = new WeakMap();
}

/**
 * Resolves a browser's own real icon, as declared in its installed .desktop
 * file, via GNOME's own app database — no guessed icon-theme name involved.
 * `${binary|appId|name}.desktop` is a guess (not guaranteed for Native/Snap,
 * always correct for Flatpak sandboxing), but a wrong guess just means no
 * matching app is found: returns undefined and the menu shows nothing rather
 * than a wrong icon.
 */
export function resolveDesktopIcon(pkg: ResolvedBrowserPkg): Gio.Icon | undefined {
  if (desktopIconCache.has(pkg)) return desktopIconCache.get(pkg) ?? undefined;
  const icon = getDesktopAppInfo(desktopIdFor(pkg))?.get_icon() ?? null;
  desktopIconCache.set(pkg, icon);
  return icon ?? undefined;
}
