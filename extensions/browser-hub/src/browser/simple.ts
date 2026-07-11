import type { SimpleBrowserConfig, ResolvedBrowserEntry } from "../taxonomy";
import { buildBaseCommand, filterAvailable } from "../internal";

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
