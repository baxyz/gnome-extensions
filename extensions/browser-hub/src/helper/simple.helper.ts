import type { SimpleBrowserConfig, ResolvedBrowserEntry } from "../types";
import { buildBaseCommand, filterAvailable } from "./pkg.helper";

export async function resolveSimpleBrowsers(
  browsers: SimpleBrowserConfig[],
): Promise<ResolvedBrowserEntry[]> {
  return filterAvailable(browsers).map((b) => ({
    label: b.label,
    items: [{ label: b.label, command: buildBaseCommand(b.pkg) }],
  }));
}
