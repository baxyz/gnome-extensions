import Gio from "gi://Gio";
import GLib from "gi://GLib";
import type { FalkonBrowserConfig, ResolvedBrowserEntry } from "../types";
import { buildBaseCommand, isAvailable } from "./pkg.helper";

function listProfileDirs(dirPath: string): string[] {
  try {
    const dir = Gio.File.new_for_path(dirPath);
    const enumerator = dir.enumerate_children(
      "standard::name,standard::type",
      Gio.FileQueryInfoFlags.NONE,
      null,
    );
    const profiles: string[] = [];
    let info: Gio.FileInfo | null;
    while ((info = enumerator.next_file(null)) !== null) {
      if (info.get_file_type() === Gio.FileType.DIRECTORY) {
        profiles.push(info.get_name());
      }
    }
    enumerator.close(null);
    return profiles;
  } catch {
    return [];
  }
}

function buildCommand(config: FalkonBrowserConfig, profileName: string): string {
  return `${buildBaseCommand(config.pkg)} --profile "${profileName}"`;
}

export function resolveFalkonBrowsers(
  browsers: FalkonBrowserConfig[],
): ResolvedBrowserEntry[] {
  return browsers
    .filter((b) => isAvailable(b.pkg))
    .filter((b) => GLib.file_test(b.path, GLib.FileTest.IS_DIR))
    .map((b) => ({
      label: b.label,
      items: listProfileDirs(b.path).map((name) => ({
        label: name,
        command: buildCommand(b, name),
      })),
    }))
    .filter((e) => e.items.length > 0);
}
