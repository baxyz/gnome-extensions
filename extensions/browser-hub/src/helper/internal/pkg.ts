import GLib from "gi://GLib";
import { PackageManager } from "../../types";
import type { BrowserPkg, ResolvedBrowserPkg } from "../../types";
import { HOME_DIR } from "../../constants/paths.constant";

export const compareByDefault = <T extends { isDefault?: boolean; label: string }>(
  a: T,
  b: T,
): number => Number(b.isDefault) - Number(a.isDefault) || a.label.localeCompare(b.label);

export function resolvePkg(pkg: BrowserPkg): ResolvedBrowserPkg | null {
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
): (Omit<T, "pkg"> & { pkg: ResolvedBrowserPkg })[] {
  return filterAvailable(browsers).filter((b) => GLib.file_test(b.path, GLib.FileTest.EXISTS));
}

export function buildBaseCommand(pkg: ResolvedBrowserPkg): string {
  switch (pkg.manager) {
    case PackageManager.Native:
      return pkg.binary;
    case PackageManager.Flatpak:
      return `flatpak run ${pkg.appId}`;
    case PackageManager.Snap:
      return `snap run ${pkg.name}`;
  }
}
