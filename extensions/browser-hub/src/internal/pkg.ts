import Gio from "gi://Gio";
import GLib from "gi://GLib";
import { createCachedResolver } from "@helpers4/function";
import { PackageManager } from "../taxonomy";
import type { BrowserPkg, ResolvedBrowserPkg } from "../taxonomy";
import { HOME_DIR } from "../constants/paths.constant";

// A real browser's own binary is never a shell script — a shim check only
// ever needs to look at a handful of bytes, so cap the read instead of
// risking a synchronous read of a multi-hundred-MB real binary on GNOME
// Shell's single UI thread just to confirm it isn't one.
const SHIM_SNIFF_BYTES = 512;

/**
 * True when `path` (a `find_program_in_path()` hit) isn't a real native
 * install at all, just a second pointer at the exact same install
 * PackageManager.Snap's own `/snap/<name>` check (below) already covers —
 * confirmed on a real system with Ubuntu's `apt install firefox`, which
 * doesn't ship Firefox at all, only a redirect to the snap:
 *   - Every snap's own launcher shim, `/snap/bin/<name>` (put on $PATH by
 *     snapd), is a symlink to `/usr/bin/snap` regardless of which snap
 *     (confirmed: `readlink /snap/bin/opera` -> `/usr/bin/snap` — snapd
 *     dispatches on argv[0], there's no real per-app binary there at all).
 *   - Ubuntu's own "firefox"/"thunderbird" apt packages install a small
 *     shell wrapper at `/usr/bin/<name>` whose only job is to `exec` the
 *     snap binary — a real file, not a symlink, so the check above misses
 *     it. Caught by its shebang plus a reference to the snap launcher,
 *     confirmed on the real Ubuntu firefox wrapper — read within
 *     SHIM_SNIFF_BYTES, well short of the file's actual full size.
 * Without this, both shapes pass `find_program_in_path()` and produce a
 * second, redundant Native identity next to the real Snap one — with no
 * `.desktop` file of its own (`opera.desktop`/`firefox.desktop` don't
 * exist; only the Snap-specific `opera_opera.desktop` etc. do — see
 * desktop-icon.ts's desktopIdFor), it falls back to a generic icon instead
 * of the browser's real one: a duplicate, icon-less entry next to the
 * correct one.
 */
function isSnapLauncherShim(path: string): boolean {
  try {
    const target = GLib.file_read_link(path);
    if (GLib.path_get_basename(target) === "snap") return true;
  } catch {
    // Not a symlink at all — fall through to the wrapper-script check.
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

/**
 * Resolves a package to a concrete binary/path without using the cache.
 * For Native packages, finds the first available binary in PATH.
 * For Flatpak, checks system and user flatpak directories.
 * For Snap, checks system snap directory.
 */
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

// Package/binary presence rarely changes mid-session, but `resolvePkgUncached` runs
// several synchronous `find_program_in_path`/`file_test` syscalls per browser, on
// GNOME Shell's main thread, on *every* settings-triggered refresh (~50 browsers).
// Cache it for the extension's lifetime; the Refresh button (see extension.ts)
// explicitly busts this cache so newly-installed browsers are still picked up.
// WeakMap-backed: each BrowserPkg config object lives as long as the settings
// that produced it, so entries can be collected once those are gone.
// resolve/clear work standalone (neither reads `this`), so they're exported
// directly under these names instead of through wrapper functions.
export const { resolve: resolvePkg, clear: clearPkgResolutionCache } = createCachedResolver(
  resolvePkgUncached,
  () => new WeakMap(),
);

/** Filters browsers to only those whose packages are available (installed/present). */
export function filterAvailable<T extends { pkg: BrowserPkg }>(
  browsers: T[],
): (Omit<T, "pkg"> & { pkg: ResolvedBrowserPkg })[] {
  return browsers.flatMap((b) => {
    const pkg = resolvePkg(b.pkg);
    return pkg !== null ? [{ ...b, pkg }] : [];
  });
}

// getBrowserEntries resolves each profiled family and the combined "Browsers"
// row from the same underlying configs in one tick, so without this cache
// the same path gets file_test'd twice per refresh. The same path can be
// checked under different tests (Falkon uses IS_DIR, the Browsers row uses
// EXISTS), hence one cache per test value, each keyed by path within it.
// Clearing the outer resolver throws away all of them together.
const pathPresenceByTest = createCachedResolver((test: number) =>
  createCachedResolver((path: string): boolean => GLib.file_test(path, test)),
);

/** Clears the path-presence cache. Called on extension disable and manual refresh. */
export const clearPathPresenceCache = pathPresenceByTest.clear;

/** Cached GLib.file_test — use this instead of calling GLib.file_test directly for any presence check. */
export function pathIsPresent(path: string, test: number): boolean {
  return pathPresenceByTest.resolve(test).resolve(path);
}

/**
 * Filters browsers to only those whose packages are available AND whose
 * additional path (e.g., profiles.ini, Local State) exists.
 */
export function filterPresent<T extends { pkg: BrowserPkg; path: string }>(
  browsers: T[],
  test: number = GLib.FileTest.EXISTS,
): (Omit<T, "pkg"> & { pkg: ResolvedBrowserPkg })[] {
  return filterAvailable(browsers).filter((b) => pathIsPresent(b.path, test));
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

/**
 * A string identity for a resolved package — equal for two ResolvedBrowserPkg
 * values that name the same actual install (e.g. "Firefox" and "Firefox
 * (classic)" both resolve to the same native firefox binary, just found via
 * two different profiles.ini path variants). Native compares by basename,
 * not the raw string: it can come from GLib.find_program_in_path() (typically
 * a full resolved path) in one place and Gio.AppInfo.get_executable() (often
 * just the bare command from a .desktop file's Exec= line) in another.
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
