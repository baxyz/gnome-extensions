import type { SimpleBrowserConfig, ResolvedBrowserEntry } from "../types";
import { buildBaseCommand, filterAvailable } from "./pkg.helper";

export async function resolveSimpleBrowsers(
  browsers: SimpleBrowserConfig[],
): Promise<ResolvedBrowserEntry[]> {
  const available = filterAvailable(browsers);
  if (available.length === 0) return [];
  return [
    {
      label: "Others",
      group: "simple",
      items: available.map((b) => ({
        label: b.label,
        command: buildBaseCommand(b.pkg),
        icon: b.icon,
      })),
    },
  ];
}
