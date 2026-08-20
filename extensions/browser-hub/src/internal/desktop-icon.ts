import type Gio from "gi://Gio";
import GdkPixbuf from "gi://GdkPixbuf";
import { createCachedResolver } from "@helpers4/function";
import { PackageManager } from "../taxonomy";
import type { ResolvedBrowserPkg } from "../taxonomy";
import { iconExists } from "../icons";
import { getDesktopAppInfo, logIfUnexpected } from "./gio";

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
// for the Browsers row (menu/browser-rows.ts), 20 for the default-browser
// and burner-session rows (menu/toolbar.ts), 16 for a picker page's rows
// (menu/shared.ts's buildPickerRow). Package-manager badges are no longer
// Gio.Icon compositing (see menu/shared.ts) — nothing else needs probing at
// a size this module doesn't already know is real.
export const ICON_DECODE_PROBE_SIZES = [16, 20, 24] as const;

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
 * Carries no package-manager badge — that's a CSS overlay applied at render
 * time (see menu/shared.ts), not part of the resolved icon itself.
 */
export function resolveDesktopIcon(pkg: ResolvedBrowserPkg): string | Gio.Icon | undefined {
  const baseIcon = desktopIconResolver.resolve(desktopIdFor(pkg));
  if (baseIcon) return baseIcon;
  return symbolicIconCandidates(pkg).find(iconExists);
}
