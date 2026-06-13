import GLib from "gi://GLib";
import type { SimpleBrowserConfig } from "../types";
import type { ResolvedBrowserEntry } from "../types";

function isAvailable(browser: SimpleBrowserConfig): boolean {
  if (browser.checkPath !== undefined) {
    return GLib.file_test(browser.checkPath, GLib.FileTest.EXISTS);
  }
  const binary = browser.command.split(" ")[0];
  return GLib.find_program_in_path(binary) !== null;
}

export function resolveSimpleBrowsers(
  browsers: SimpleBrowserConfig[],
): ResolvedBrowserEntry[] {
  return browsers
    .filter(isAvailable)
    .map((b) => ({
      label: b.label,
      items: [{ label: b.label, command: b.command }],
    }));
}
