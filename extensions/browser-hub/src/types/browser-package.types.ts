import { PackageManager } from "./package-manager.enum";

export type NativePkg = { manager: PackageManager.Native; binary: string | string[] };
export type FlatpakPkg = { manager: PackageManager.Flatpak; appId: string };
export type SnapPkg = { manager: PackageManager.Snap; name: string };

export type BrowserPkg = NativePkg | FlatpakPkg | SnapPkg;

/** NativePkg after resolution: a single binary has been selected. */
export type ResolvedNativePkg = { manager: PackageManager.Native; binary: string };
export type ResolvedBrowserPkg = ResolvedNativePkg | FlatpakPkg | SnapPkg;
