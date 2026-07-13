import { settle } from "@helpers4/promise";
import {
  CHROMIUM_BROWSERS,
  FALKON_BROWSERS,
  FIREFOX_BROWSERS,
  SIMPLE_BROWSERS,
} from "../constants";
import type { ResolvedBrowserEntry } from "../taxonomy";
import type { FirefoxOptions } from "../taxonomy";
import { SpaceType } from "../taxonomy/space-type.enum";
import { buildBaseCommand, filterAvailable, filterPresent, resolveDesktopIcon } from "../internal";
import { resolveChromiumBrowsers } from "./chromium";
import { resolveFalkonBrowsers } from "./falkon";
import { resolveFirefoxBrowsers } from "./firefox";

export type { FirefoxOptions, ProfileGroupsMode } from "../taxonomy";

/** Settings that control which browser families and features are enabled. */
export type BrowserSettings = {
  showFirefoxFamily: boolean;
  showChromeFamily: boolean;
  showSimpleBrowsers: boolean;
  showProfiledBrowsers: boolean;
  collapseSingleProfileBrowsers: boolean;
} & FirefoxOptions;

/** Default settings with all features enabled — used when no settings are provided. */
const ALL_ON: BrowserSettings = {
  showFirefoxFamily: true,
  showChromeFamily: true,
  showSimpleBrowsers: true,
  showProfiledBrowsers: true,
  collapseSingleProfileBrowsers: true,
  enabledSpaces: new Set(Object.values(SpaceType)),
  profileGroupsMode: "profiles",
};

/**
 * A family entry with exactly one profile and no active spaces/workspaces
 * under it — collapseSingleProfileBrowsers hides these from their detailed
 * section since the "Browsers" row already covers them with a single icon.
 */
function isSingleProfileEntry(entry: ResolvedBrowserEntry): boolean {
  return entry.items.length === 1 && (entry.items[0].spaces?.length ?? 0) <= 1;
}

/**
 * Builds the "Browsers" quick-launch row: one icon per installed browser
 * identity, regardless of family or whether it has profiles — always its
 * base command (no profile arg, no profile-groups/spaces handling), sorted
 * alphabetically. Every family still gets its own detailed section too (see
 * getBrowserEntries) — this row is a flat, uniform "just launch it" list
 * alongside those, gated by the same family toggles plus showProfiledBrowsers.
 */
function resolveBrowsersRow(settings: BrowserSettings): ResolvedBrowserEntry[] {
  const withProfilesConfigs = settings.showProfiledBrowsers
    ? [
        ...(settings.showFirefoxFamily ? FIREFOX_BROWSERS : []),
        ...(settings.showChromeFamily ? [...CHROMIUM_BROWSERS, ...FALKON_BROWSERS] : []),
      ]
    : [];
  const available = [
    ...filterPresent(withProfilesConfigs),
    ...(settings.showSimpleBrowsers ? filterAvailable(SIMPLE_BROWSERS) : []),
  ];
  if (available.length === 0) return [];

  const items = available
    .map((b) => ({
      label: b.label,
      command: buildBaseCommand(b.pkg),
      icon: resolveDesktopIcon(b.pkg),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
  return [{ label: "Browsers", group: "simple", items }];
}

/**
 * Resolves all enabled browser entries based on the provided settings: each
 * family's detailed section (profiles, colors, spaces) plus the flat
 * "Browsers" quick-launch row. If a family resolver fails, its error is
 * logged but other families' entries are still returned.
 *
 * collapseSingleProfileBrowsers is a sub-setting of showProfiledBrowsers (it
 * only takes effect when that's also on) — otherwise a single-profile
 * browser hidden from its detailed section wouldn't appear anywhere.
 */
export async function getBrowserEntries(
  settings: BrowserSettings = ALL_ON,
): Promise<ResolvedBrowserEntry[]> {
  const { fulfilled, rejected } = await settle([
    settings.showFirefoxFamily
      ? resolveFirefoxBrowsers(FIREFOX_BROWSERS, settings)
      : Promise.resolve([]),
    settings.showChromeFamily ? resolveChromiumBrowsers(CHROMIUM_BROWSERS) : Promise.resolve([]),
    settings.showChromeFamily ? resolveFalkonBrowsers(FALKON_BROWSERS) : Promise.resolve([]),
  ]);
  for (const reason of rejected) {
    logError(reason as object, "[browser-hub] a browser family failed to resolve");
  }

  const collapsing = settings.showProfiledBrowsers && settings.collapseSingleProfileBrowsers;
  const detailedEntries = fulfilled
    .flat()
    .filter((entry) => !collapsing || !isSingleProfileEntry(entry));

  return [...detailedEntries, ...resolveBrowsersRow(settings)];
}
