import { createSortByStringFn, isEmpty } from "@helpers4/array";
import { settle } from "@helpers4/promise";
import {
  CHROMIUM_BROWSERS,
  FALKON_BROWSERS,
  FIREFOX_BROWSERS,
  SIMPLE_BROWSERS,
} from "../constants";
import type { BrowserPkg, ResolvedBrowserEntry, ResolvedBrowserPkg } from "../taxonomy";
import type { FirefoxOptions } from "../taxonomy";
import { SpaceType } from "../taxonomy/space-type.enum";
import { errorMessage, filterAvailable, pkgKey, resolveDesktopIcon } from "../internal";
import { resolveChromiumBrowsers } from "./chromium";
import { resolveFalkonBrowsers } from "./falkon";
import { resolveFirefoxBrowsers } from "./firefox";

export type { FirefoxOptions, ProfileGroupsMode } from "../taxonomy";

export type BrowserSettings = {
  showFirefoxFamily: boolean;
  showChromeFamily: boolean;
  showSimpleBrowsers: boolean;
  showProfiledBrowsers: boolean;
  collapseSingleProfileBrowsers: boolean;
} & FirefoxOptions;

const ALL_ON: BrowserSettings = {
  showFirefoxFamily: true,
  showChromeFamily: true,
  showSimpleBrowsers: true,
  showProfiledBrowsers: true,
  collapseSingleProfileBrowsers: true,
  enabledSpaces: new Set(Object.values(SpaceType)),
  profileGroupsMode: "profiles",
};

/** Families with profiles: their toggle, configs and resolver. */
type ProfiledFamily = {
  enabled: (settings: BrowserSettings) => boolean;
  configs: readonly { label: string; path: string; pkg: BrowserPkg }[];
  /** `errors` gets one message per browser that failed. */
  resolve: (settings: BrowserSettings, errors: string[]) => Promise<ResolvedBrowserEntry[]>;
};

const PROFILED_FAMILIES: readonly ProfiledFamily[] = [
  {
    enabled: (s) => s.showFirefoxFamily,
    configs: FIREFOX_BROWSERS,
    resolve: (s, errors) => resolveFirefoxBrowsers(FIREFOX_BROWSERS, s, errors),
  },
  {
    enabled: (s) => s.showChromeFamily,
    configs: CHROMIUM_BROWSERS,
    resolve: (_s, errors) => resolveChromiumBrowsers(CHROMIUM_BROWSERS, errors),
  },
  {
    enabled: (s) => s.showChromeFamily,
    configs: FALKON_BROWSERS,
    resolve: (_s, errors) => resolveFalkonBrowsers(FALKON_BROWSERS, errors),
  },
];

function shouldCollapseSingleProfileBrowsers(settings: BrowserSettings): boolean {
  return settings.collapseSingleProfileBrowsers;
}

/** One profile and no spaces: the Browsers row already covers it. */
function isSingleProfileEntry(entry: ResolvedBrowserEntry): boolean {
  return entry.items.length === 1 && (entry.items[0].spaces?.length ?? 0) === 0;
}

/**
 * Keeps one config per install: "Firefox" and "Firefox (classic)" are the
 * same browser in the Browsers row. The first one wins.
 */
function dedupeByPkg<T extends { pkg: ResolvedBrowserPkg }>(configs: readonly T[]): T[] {
  const seen = new Set<string>();
  return configs.filter((c) => {
    const key = pkgKey(c.pkg);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** The Browsers row: one icon per installed browser, sorted by name. */
function resolveBrowsersRow(settings: BrowserSettings, errors: string[]): ResolvedBrowserEntry[] {
  const withProfilesConfigs = settings.showProfiledBrowsers
    ? PROFILED_FAMILIES.filter((f) => f.enabled(settings)).flatMap((f) => f.configs)
    : [];
  // Only the package is needed: a browser never launched has no profile files yet.
  const available = dedupeByPkg([
    ...filterAvailable(withProfilesConfigs),
    ...(settings.showSimpleBrowsers ? filterAvailable(SIMPLE_BROWSERS) : []),
  ]);
  if (isEmpty(available)) return [];

  // One failing browser shouldn't drop the others.
  const items = available
    .flatMap((b) => {
      try {
        return [
          {
            label: b.label,
            launch: { kind: "browser", pkg: b.pkg } as const,
            icon: resolveDesktopIcon(b.pkg),
            pkg: b.pkg,
          },
        ];
      } catch (e) {
        errors.push(`${b.label}: ${errorMessage(e)}`);
        logError(e as object, `[browser-hub] ${b.label} failed to resolve for the Browsers row`);
        return [];
      }
    })
    .sort(createSortByStringFn("label"));
  return isEmpty(items) ? [] : [{ label: "Browsers", group: "simple", items }];
}

/**
 * Every enabled family plus the Browsers row. A failure is logged and
 * added to `errors`; the rest still shows.
 */
export async function getBrowserEntries(
  settings: BrowserSettings = ALL_ON,
): Promise<{ entries: ResolvedBrowserEntry[]; errors: string[] }> {
  const errors: string[] = [];
  const { fulfilled, rejected } = await settle(
    PROFILED_FAMILIES.map((f) =>
      f.enabled(settings) ? f.resolve(settings, errors) : Promise.resolve([]),
    ),
  );
  for (const reason of rejected) {
    errors.push(errorMessage(reason));
    logError(reason as object, "[browser-hub] a browser family failed to resolve");
  }

  const collapsing = shouldCollapseSingleProfileBrowsers(settings);
  const detailedEntries = fulfilled
    .flat()
    .filter((entry) => !collapsing || !isSingleProfileEntry(entry));

  // Synchronous, so outside settle(), but a throw must not lose the families above.
  let browsersRow: ResolvedBrowserEntry[] = [];
  try {
    browsersRow = resolveBrowsersRow(settings, errors);
  } catch (e: unknown) {
    errors.push("the Browsers row");
    logError(e as object, "[browser-hub] the Browsers row failed to resolve");
  }

  return { entries: [...detailedEntries, ...browsersRow], errors };
}
