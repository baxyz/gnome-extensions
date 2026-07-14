import { PackageManager } from "./package-manager.enum";

export type NativePkg = {
  manager: PackageManager.Native;
  binary: string | string[];
  /**
   * Overrides the guessed `${binary}.desktop` id used to fetch the browser's
   * real icon (see internal/desktop-icon.ts) — needed for apps whose desktop
   * file doesn't follow the binary name (e.g. GNOME apps using their
   * reverse-DNS app id, like "org.gnome.Epiphany.desktop" for "epiphany").
   */
  desktopId?: string;
};
export type FlatpakPkg = { manager: PackageManager.Flatpak; appId: string };
export type SnapPkg = { manager: PackageManager.Snap; name: string };

export type BrowserPkg = NativePkg | FlatpakPkg | SnapPkg;

/** NativePkg after resolution: a single binary has been selected. */
export type ResolvedNativePkg = {
  manager: PackageManager.Native;
  binary: string;
  desktopId?: string;
};
export type ResolvedBrowserPkg = ResolvedNativePkg | FlatpakPkg | SnapPkg;
