import Gio from "gi://Gio";
import GdkPixbuf from "gi://GdkPixbuf";
import { createCachedResolver } from "@helpers4/function";
import { PackageManager } from "../taxonomy";
import type { ResolvedBrowserPkg } from "../taxonomy";
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

// Icon files are tiny (packaged app icons, not user content), so a real
// decode is cheap — unlike a bare existence check, it actually exercises
// the decode failure above. Probed at every size this extension actually
// renders an icon at (see menu/*.ts icon_size usages: 14/16 for profile
// rows, 24 for the Browsers row), plus two defensive bounds: 2 (near the
// smallest anything could ever be asked to render at) and 64 (above every
// real size — the original bound this probe shipped with). A source that
// decodes cleanly at one target size can still round to a degenerate 0×0
// pixbuf at another — confirmed in production: the very first version of
// this probe (a single 64px check) still let a real crash through, because
// the failure only showed up at a size this module never tested (see
// badgeIconResolver below — the actual culprit was the *emblem*, which
// St renders at a fraction of icon_size this module has no visibility
// into). GTK hit the same assertion shape from a 1px-wide thumbnail, when
// gdk_pixbuf_scale_simple returned null for it
// (https://gitlab.gnome.org/GNOME/gtk/-/issues/3077) — every probed size
// here is a variant of that same "scale produces a 0 dimension" failure.
// Exported only for tests, to size their call-count assertions off this
// list instead of a hardcoded, easily-stale duplicate of its length.
export const ICON_DECODE_PROBE_SIZES = [2, 14, 16, 24, 64] as const;

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

// Filenames under the badge assets dir set via setBadgeIconsDir() below (see
// vite.config.ts's staticAssets plugin for how assets/badges/ ends up in
// dist/assets/badges/). Native has no badge — it's the unmarked default.
// These ship with the extension itself — never third-party-controlled — but
// "trusted provenance" turned out not to mean "safe to render": they're
// rendered as a GEmblemedIcon's *emblem*, at whatever fraction of icon_size
// St's own compositor picks internally, a size this module can't observe or
// control. That's exactly the failure mode ICON_DECODE_PROBE_SIZES's 2px
// bound exists to catch, so these go through the same isDecodableIconFile
// check as a browser's own .desktop icon — see badgeIconResolver below.
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
// Returns null (not undefined) for a badge that fails decode validation —
// callers fall back to an unbadged icon exactly like an unmatched desktopId
// already does, rather than crash the shell over a cosmetic package-manager
// marker.
const badgeIconResolver = createCachedResolver((filename: string): Gio.Icon | null => {
  const file = badgeIconsDir!.get_child(filename);
  const path = file.get_path();
  // A null path would mean a non-local Gio.File, essentially never true for
  // a static asset shipped inside the extension's own install directory —
  // pass through unvalidated rather than guess it's bad with no evidence,
  // same convention desktopIconResolver below follows.
  if (path !== null && !isDecodableIconFile.resolve(path)) {
    console.warn(`[browser-hub] dropping undecodable package-manager badge: ${path}`);
    return null;
  }
  return Gio.FileIcon.new(file);
});

function badgeIconFor(manager: PackageManager): Gio.Icon | undefined {
  const filename = BADGE_FILENAMES[manager];
  if (!filename || !badgeIconsDir) return undefined;
  return badgeIconResolver.resolve(filename) ?? undefined;
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

// Package/binary presence rarely changes mid-session, same as pkg.ts's
// cache. Keyed by the desktopId string rather than the pkg object: the
// default browser's pkg is rebuilt fresh on every menu open, so an
// object-identity key would just never hit. Only the GNOME app-info lookup
// (get_icon(), plus the decode validation below) goes through the cache —
// the emblem wrapping further down is cheap enough to redo every time.
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
  badgeIconResolver.clear();
  isDecodableIconFile.clear();
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
  const baseIcon = desktopIconResolver.resolve(desktopIdFor(pkg));
  if (!baseIcon) return undefined;
  const badge = badgeIconFor(pkg.manager);
  return badge ? Gio.EmblemedIcon.new(baseIcon, Gio.Emblem.new(badge)) : baseIcon;
}
