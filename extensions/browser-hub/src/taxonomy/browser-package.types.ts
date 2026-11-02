import { PackageManager } from "./package-manager.enum";

export type NativePkg = {
  manager: PackageManager.Native;
  binary: string | string[];
  /** Desktop id, when it isn't `${binary}.desktop` (e.g. "org.gnome.Epiphany.desktop"). */
  desktopId?: string;
};
export type FlatpakPkg = { manager: PackageManager.Flatpak; appId: string };
export type SnapPkg = { manager: PackageManager.Snap; name: string };

export type BrowserPkg = NativePkg | FlatpakPkg | SnapPkg;

/** NativePkg with a single binary picked. */
export type ResolvedNativePkg = {
  manager: PackageManager.Native;
  binary: string;
  desktopId?: string;
};
export type ResolvedBrowserPkg = ResolvedNativePkg | FlatpakPkg | SnapPkg;
