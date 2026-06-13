import type { SimpleBrowserConfig, ResolvedBrowserEntry } from "../types";
import { buildBaseCommand, isAvailable } from "./pkg.helper";

export function resolveSimpleBrowsers(
  browsers: SimpleBrowserConfig[],
): ResolvedBrowserEntry[] {
  return browsers
    .filter((b) => isAvailable(b.pkg))
    .map((b) => ({
      label: b.label,
      items: [{ label: b.label, command: buildBaseCommand(b.pkg) }],
    }));
}
