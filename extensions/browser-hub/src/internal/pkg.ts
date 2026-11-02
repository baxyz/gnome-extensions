import Gio from "gi://Gio";
import GLib from "gi://GLib";
import { createCachedResolver } from "@helpers4/function";
import { PackageManager } from "../taxonomy";
import type { BrowserPkg, ResolvedBrowserPkg } from "../taxonomy";
import { HOME_DIR } from "../constants/paths.constant";

// Enough to see a shebang and the snap path.
const SHIM_SNIFF_BYTES = 512;

/**
 * True when `path` only redirects to a snap: /snap/bin/<name> symlinks to
 * /usr/bin/snap, and Ubuntu's firefox apt package is a shell script that
 * execs the snap. Counting them as native would list the browser twice.
 */
function isSnapLauncherShim(path: string): boolean {
  try {
    const target = GLib.file_read_link(path);
    if (GLib.path_get_basename(target) === "snap") return true;
  } catch {
    // Not a symlink.
  }
  try {
    const stream = Gio.File.new_for_path(path).read(null);
    const data = stream.read_bytes(SHIM_SNIFF_BYTES, null).get_data();
    stream.close(null);
    if (data === null) return false;
    const head = new TextDecoder().decode(data);
    return head.startsWith("#!") && /\/snap\/bin\//.test(head);
  } catch {
    return false;
  }
}

function resolvePkgUncached(pkg: BrowserPkg): ResolvedBrowserPkg | null {
  switch (pkg.manager) {
    case PackageManager.Native: {
      const binary = [pkg.binary].flat().find((b) => {
        const path = GLib.find_program_in_path(b);
        return path !== null && !isSnapLauncherShim(path);
      });
      return binary !== undefined
        ? { manager: PackageManager.Native, binary, desktopId: pkg.desktopId }
        : null;
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

// Cleared on manual refresh and on disable.
export const { resolve: resolvePkg, clear: clearPkgResolutionCache } = createCachedResolver(
  resolvePkgUncached,
  () => new WeakMap(),
);

/** Keeps the browsers whose package is installed. */
export function filterAvailable<T extends { pkg: BrowserPkg }>(
  browsers: T[],
): (Omit<T, "pkg"> & { pkg: ResolvedBrowserPkg })[] {
  return browsers.flatMap((b) => {
    const pkg = resolvePkg(b.pkg);
    return pkg !== null ? [{ ...b, pkg }] : [];
  });
}

// One cache per GLib.FileTest value, each keyed by path.
const pathPresenceByTest = createCachedResolver((test: number) =>
  createCachedResolver((path: string): boolean => GLib.file_test(path, test)),
);

export const clearPathPresenceCache = pathPresenceByTest.clear;

/** Cached GLib.file_test(). */
export function pathIsPresent(path: string, test: number): boolean {
  return pathPresenceByTest.resolve(test).resolve(path);
}

/** Keeps the browsers whose package is installed and whose `path` exists. */
export function filterPresent<T extends { pkg: BrowserPkg; path: string }>(
  browsers: T[],
  test: number = GLib.FileTest.EXISTS,
): (Omit<T, "pkg"> & { pkg: ResolvedBrowserPkg })[] {
  return filterAvailable(browsers).filter((b) => pathIsPresent(b.path, test));
}

/**
 * Same key for two entries that point at the same install. Native compares
 * the binary's basename, since it may be a full path or a bare command.
 */
export function pkgKey(pkg: ResolvedBrowserPkg): string {
  switch (pkg.manager) {
    case PackageManager.Native:
      return `native:${GLib.path_get_basename(pkg.binary)}`;
    case PackageManager.Flatpak:
      return `flatpak:${pkg.appId}`;
    case PackageManager.Snap:
      return `snap:${pkg.name}`;
  }
}
