import type Gio from "gi://Gio";
import GdkPixbuf from "gi://GdkPixbuf";
import { createCachedResolver } from "@helpers4/function";
import { PackageManager } from "../taxonomy";
import type { ResolvedBrowserPkg } from "../taxonomy";
import { iconExists } from "../icons";
import {
  clearAppInfoListCache,
  findDesktopIdByDesktopKey,
  findDesktopIdByExecutable,
  getDesktopAppInfo,
  logIfUnexpected,
} from "./gio";

// A Gio.FileIcon whose file fails to decode aborts GNOME Shell itself:
// St:ERROR in st-icon-theme.c, assertion on icon_info_get_pixbuf_ready,
// signal 6 — journalctl always shows "Could not load a pixbuf from icon
// theme." right before it. Duck-typed rather than `instanceof`: modern GJS
// exposes FileIcon.file as a plain property with no get_file() method
// (confirmed against this project's pinned @girs/gio-2.0 types), and
// duck-typing also works against this file's own test/CLI-script fakes.
function isFileIcon(icon: Gio.Icon): icon is Gio.FileIcon {
  return "file" in icon;
}

// Every real icon_size this extension ever renders a .desktop icon at: 24
// for the Browsers row (menu/browser-rows.ts), 16 for the default-browser
// and burner-session rows (menu/toolbar.ts) and for a picker page's rows
// (menu/shared.ts's buildPickerRow). Package-manager badges are no longer
// Gio.Icon compositing (see menu/shared.ts) — nothing else needs probing at
// a size this module doesn't already know is real.
export const ICON_DECODE_PROBE_SIZES = [16, 24] as const;

// Cached per path — a bad file is decoded at most once per session (across
// every probed size), same as every other lookup in this module.
// logIfUnexpected keeps the existing silent-on-not-found/warn-on-everything
// -else split (see internal/gio.ts) instead of treating a stale,
// uninstalled-app icon path as noteworthy. Stops at the first size that
// fails a decode — one bad size is enough to condemn the whole file, no
// need to keep probing once that's established.
const isDecodableIconFile = createCachedResolver((path: string): boolean => {
  for (const size of ICON_DECODE_PROBE_SIZES) {
    try {
      const pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_size(path, size, size);
      if (pixbuf.get_width() <= 0 || pixbuf.get_height() <= 0) return false;
    } catch (e) {
      logIfUnexpected(e, `[browser-hub] couldn't decode icon file ${path} at ${size}px`);
      return false;
    }
  }
  return true;
});

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

// Package/binary presence rarely changes mid-session, same as this module's
// other caches. Two separate resolvers, not one shared by key string: Native
// and Snap search by genuinely different signals below (executable vs. a
// desktop-file key), so nothing here should even be able to conflate a
// binary name with a snap instance name that happens to look the same.
const desktopIdByExecutable = createCachedResolver(findDesktopIdByExecutable);
const desktopIdBySnapInstanceName = createCachedResolver((name: string) =>
  findDesktopIdByDesktopKey("X-SnapInstanceName", name),
);

/**
 * The real, resolvable desktop ID for `pkg` when desktopIdFor()'s guess
 * doesn't resolve — Native falls back to a by-executable search (no
 * freedesktop-standard "which package provides this .desktop" field
 * exists), Snap to an exact match on the "X-SnapInstanceName" key snapd
 * itself injects (the same authoritative field default-browser.ts's
 * detectPkg() already trusts, just in the opposite direction), and Flatpak
 * never needs this at all — its guess is guaranteed correct by the
 * packaging spec (see desktopIdFor). Shared by resolveDesktopId() and
 * resolveDesktopIcon() below so the two can't drift on which managers get a
 * fallback or what they match by.
 */
function findFallbackDesktopId(pkg: ResolvedBrowserPkg): string | null {
  switch (pkg.manager) {
    case PackageManager.Native:
      return desktopIdByExecutable.resolve(pkg.binary);
    case PackageManager.Snap:
      return desktopIdBySnapInstanceName.resolve(pkg.name);
    case PackageManager.Flatpak:
      return null;
  }
}

/**
 * The real, resolvable desktop ID for `pkg` — desktopIdFor()'s guess when it
 * actually resolves, else findFallbackDesktopId() above, else the guess
 * anyway: every caller already treats "resolves to nothing" as the expected
 * failure mode. Used by toolbar.ts/default-browser.ts, which only need to
 * know whether some ID resolves, not the Gio.Icon behind it —
 * resolveDesktopIcon() below does its own, differently-shaped fallback
 * instead of calling this, so a successfully-guessed ID is never looked up
 * twice over there.
 */
export function resolveDesktopId(pkg: ResolvedBrowserPkg): string {
  const guess = desktopIdFor(pkg);
  if (getDesktopAppInfo(guess) !== null) return guess;
  return findFallbackDesktopId(pkg) ?? guess;
}

// Package/binary presence rarely changes mid-session, same as pkg.ts's
// cache. Keyed by the desktopId string rather than the pkg object: a manual
// refresh rebuilds the default browser's pkg as a fresh object, so an
// object-identity key would just never hit.
//
// This is the only place in the codebase allowed to call .get_icon() — any
// new call site would bypass the decode validation below and reintroduce
// the crash this module exists to prevent.
const desktopIconResolver = createCachedResolver((desktopId: string): Gio.Icon | null => {
  const baseIcon = getDesktopAppInfo(desktopId)?.get_icon() ?? null;
  if (baseIcon && isFileIcon(baseIcon)) {
    const path = baseIcon.file.get_path();
    // A null path means a non-local URI, essentially never true for a
    // static .desktop Icon= value — pass through unvalidated rather than
    // guess it's bad with no actual evidence.
    if (path !== null && !isDecodableIconFile.resolve(path)) {
      console.warn(`[browser-hub] dropping undecodable icon for ${desktopId}: ${path}`);
      return null;
    }
  }
  return baseIcon;
});

/** Clears the desktop icon cache. Called on extension disable and manual refresh. */
export function clearDesktopIconCache(): void {
  desktopIconResolver.clear();
  isDecodableIconFile.clear();
  desktopIdByExecutable.clear();
  desktopIdBySnapInstanceName.clear();
  clearAppInfoListCache();
}

// Plausible "<name>-symbolic" candidates for a package's own icon set — many
// apps ship one alongside their main icon (e.g. Firefox's own
// firefox-symbolic), checked via the same St.IconTheme.has_icon() lookup the
// Firefox-avatar/Zen-workspace icons already use (see icons/resolve-icon.ts)
// — a name lookup, not a file decode, so it carries none of the risk
// resolveDesktopIcon() above exists to guard against. Purely a guess at
// naming convention: absent candidates just mean iconExists() finds nothing
// and the caller falls through to the fully generic icon, same as today.
function symbolicIconCandidates(pkg: ResolvedBrowserPkg): string[] {
  switch (pkg.manager) {
    case PackageManager.Native: {
      const fromDesktopId = pkg.desktopId?.replace(/\.desktop$/, "");
      return [...new Set([fromDesktopId, pkg.binary].filter((n) => n !== undefined))].map(
        (n) => `${n}-symbolic`,
      );
    }
    case PackageManager.Flatpak:
      return [`${pkg.appId}-symbolic`];
    case PackageManager.Snap:
      return [`${pkg.name}-symbolic`];
  }
}

/**
 * Resolves a browser's own icon: its real .desktop icon when one decodes
 * safely, else a same-named "-symbolic" icon from its own icon set when the
 * current theme actually has one, else undefined (every caller already
 * falls back to a fully generic icon for that case).
 *
 * `${binary|appId|name}.desktop` is a guess (not guaranteed for Native/Snap,
 * always correct for Flatpak sandboxing), but a wrong guess just means no
 * matching app is found — same graceful degradation as a validation failure.
 *
 * Carries no package-manager indicator — that's a border class applied to
 * the button at render time (see menu/shared.ts), not part of the resolved
 * icon itself.
 *
 * Falls back through findFallbackDesktopId() when the guess resolves to
 * nothing, same as resolveDesktopId() above — done directly against
 * desktopIconResolver rather than by calling resolveDesktopId() itself, so
 * the common case (the guess is right, and has an icon) costs exactly the
 * one cached lookup it always has, not a second one to re-verify what
 * desktopIconResolver is about to look up anyway. The fallback only
 * triggers when the guessed ID doesn't resolve to an app at all (a second,
 * explicit getDesktopAppInfo check) rather than whenever desktopIconResolver
 * comes back empty — that also happens when the guess IS the right app but
 * it just has no usable icon (no Icon= key, or one that fails decode
 * validation), and searching further in that case risks picking up a
 * different, unrelated app that happens to share the same binary (e.g. a
 * "Private Browsing" launcher).
 */
export function resolveDesktopIcon(pkg: ResolvedBrowserPkg): string | Gio.Icon | undefined {
  const guessId = desktopIdFor(pkg);
  let baseIcon = desktopIconResolver.resolve(guessId);
  if (baseIcon === null && getDesktopAppInfo(guessId) === null) {
    const foundId = findFallbackDesktopId(pkg);
    if (foundId) baseIcon = desktopIconResolver.resolve(foundId);
  }
  if (baseIcon) return baseIcon;
  return symbolicIconCandidates(pkg).find(iconExists);
}
