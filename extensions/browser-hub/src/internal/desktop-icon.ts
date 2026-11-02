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

// A FileIcon whose file can't be decoded crashes GNOME Shell (St:ERROR in
// st-icon-theme.c), so those files are checked before use.
function isFileIcon(icon: Gio.Icon): icon is Gio.FileIcon {
  return "file" in icon;
}

// The sizes .desktop icons are shown at in the menu.
export const ICON_DECODE_PROBE_SIZES = [16, 24] as const;

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

/** The expected desktop id for `pkg`; it may not exist (see resolveDesktopId). */
export function desktopIdFor(pkg: ResolvedBrowserPkg): string {
  switch (pkg.manager) {
    case PackageManager.Native:
      return pkg.desktopId ?? `${pkg.binary}.desktop`;
    case PackageManager.Flatpak:
      return `${pkg.appId}.desktop`;
    case PackageManager.Snap:
      // snapd installs desktop files as "<snap>_<app>.desktop".
      return `${pkg.name}_${pkg.name}.desktop`;
  }
}

const desktopIdByExecutable = createCachedResolver(findDesktopIdByExecutable);
const desktopIdBySnapInstanceName = createCachedResolver((name: string) =>
  findDesktopIdByDesktopKey("X-SnapInstanceName", name),
);

/** Looks the desktop id up when desktopIdFor() guessed wrong. Flatpak ids are always right. */
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

/** The desktop id of `pkg`, falling back to the guess when nothing matches. */
export function resolveDesktopId(pkg: ResolvedBrowserPkg): string {
  const guess = desktopIdFor(pkg);
  if (getDesktopAppInfo(guess) !== null) return guess;
  return findFallbackDesktopId(pkg) ?? guess;
}

// Keep this the only get_icon() call, so every icon goes through the decode check.
const desktopIconResolver = createCachedResolver((desktopId: string): Gio.Icon | null => {
  const baseIcon = getDesktopAppInfo(desktopId)?.get_icon() ?? null;
  if (baseIcon && isFileIcon(baseIcon)) {
    const path = baseIcon.file.get_path();
    if (path !== null && !isDecodableIconFile.resolve(path)) {
      console.warn(`[browser-hub] dropping undecodable icon for ${desktopId}: ${path}`);
      return null;
    }
  }
  return baseIcon;
});

export function clearDesktopIconCache(): void {
  desktopIconResolver.clear();
  isDecodableIconFile.clear();
  desktopIdByExecutable.clear();
  desktopIdBySnapInstanceName.clear();
  clearAppInfoListCache();
}

// e.g. firefox-symbolic, when the icon theme has it.
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
 * The browser's .desktop icon, else its symbolic icon, else undefined.
 * The fallback search only runs when the guessed app doesn't exist: if it
 * exists without a usable icon, searching could pick another app with the
 * same binary (e.g. a "Private Browsing" launcher).
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
