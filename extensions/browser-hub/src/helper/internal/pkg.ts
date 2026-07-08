import GLib from "gi://GLib";
import { PackageManager } from "../../types";
import type { BrowserPkg, ResolvedBrowserPkg } from "../../types";
import { HOME_DIR } from "../../constants/paths.constant";

export const compareByDefault = <T extends { isDefault?: boolean; label: string }>(
  a: T,
  b: T,
): number => Number(b.isDefault) - Number(a.isDefault) || a.label.localeCompare(b.label);

function resolvePkgUncached(pkg: BrowserPkg): ResolvedBrowserPkg | null {
  switch (pkg.manager) {
    case PackageManager.Native: {
      const binary = [pkg.binary].flat().find((b) => GLib.find_program_in_path(b) !== null);
      return binary !== undefined ? { manager: PackageManager.Native, binary } : null;
    }
    case PackageManager.Flatpak:
      return GLib.file_test(`/var/lib/flatpak/app/${pkg.appId}`, GLib.FileTest.IS_DIR) ||
        GLib.file_test(`${HOME_DIR}/.local/share/flatpak/app/${pkg.appId}`, GLib.FileTest.IS_DIR)
        ? pkg
        : null;
    case PackageManager.Snap:
      return GLib.file_test(`/snap/${pkg.name}`, GLib.FileTest.IS_DIR) ? pkg : null;
  }
}

// Package/binary presence rarely changes mid-session, but `resolvePkgUncached` runs
// several synchronous `find_program_in_path`/`file_test` syscalls per browser, on
// GNOME Shell's main thread, on *every* settings-triggered refresh (~50 browsers).
// Cache it for the extension's lifetime; the Refresh button (see extension.ts)
// explicitly busts this cache so newly-installed browsers are still picked up.
let pkgResolutionCache = new WeakMap<BrowserPkg, ResolvedBrowserPkg | null>();

export function clearPkgResolutionCache(): void {
  pkgResolutionCache = new WeakMap();
}

export function resolvePkg(pkg: BrowserPkg): ResolvedBrowserPkg | null {
  if (pkgResolutionCache.has(pkg)) {
    return pkgResolutionCache.get(pkg) ?? null;
  }
  const resolved = resolvePkgUncached(pkg);
  pkgResolutionCache.set(pkg, resolved);
  return resolved;
}

export function filterAvailable<T extends { pkg: BrowserPkg }>(
  browsers: T[],
): (Omit<T, "pkg"> & { pkg: ResolvedBrowserPkg })[] {
  return browsers.flatMap((b) => {
    const pkg = resolvePkg(b.pkg);
    return pkg !== null ? [{ ...b, pkg }] : [];
  });
}

export function filterPresent<T extends { pkg: BrowserPkg; path: string }>(
  browsers: T[],
  test: number = GLib.FileTest.EXISTS,
): (Omit<T, "pkg"> & { pkg: ResolvedBrowserPkg })[] {
  return filterAvailable(browsers).filter((b) => GLib.file_test(b.path, test));
}

/** Returns the base argv for launching this package — append extra args, never string-concatenate. */
export function buildBaseCommand(pkg: ResolvedBrowserPkg): string[] {
  switch (pkg.manager) {
    case PackageManager.Native:
      return [pkg.binary];
    case PackageManager.Flatpak:
      return ["flatpak", "run", pkg.appId];
    case PackageManager.Snap:
      return ["snap", "run", pkg.name];
  }
}
