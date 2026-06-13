import GLib from "gi://GLib";
import { PackageManager } from "../constants/package-manager.enum";
import type { BrowserPkg } from "../types";

const HOME_DIR = GLib.get_home_dir();

export function isAvailable(pkg: BrowserPkg): boolean {
  switch (pkg.manager) {
    case PackageManager.Native:
      return GLib.find_program_in_path(pkg.binary) !== null;
    case PackageManager.Flatpak:
      return (
        GLib.file_test(`/var/lib/flatpak/app/${pkg.appId}`, GLib.FileTest.IS_DIR) ||
        GLib.file_test(`${HOME_DIR}/.local/share/flatpak/app/${pkg.appId}`, GLib.FileTest.IS_DIR)
      );
    case PackageManager.Snap:
      return GLib.file_test(`/snap/${pkg.name}`, GLib.FileTest.IS_DIR);
  }
}

export function buildBaseCommand(pkg: BrowserPkg): string {
  switch (pkg.manager) {
    case PackageManager.Native:
      return pkg.binary;
    case PackageManager.Flatpak:
      return `flatpak run ${pkg.appId}`;
    case PackageManager.Snap:
      return `snap run ${pkg.name}`;
  }
}
