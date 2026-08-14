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
import {
  buildBaseCommand,
  errorMessage,
  filterAvailable,
  pkgKey,
  resolveDesktopIcon,
} from "../internal";
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
 * One entry per family with profiles (Firefox/Chromium/Falkon): its toggle,
 * its raw configs (reused by resolveBrowsersRow below so a new family only
 * needs to be registered here once), and its detailed-section resolver.
 */
type ProfiledFamily = {
  enabled: (settings: BrowserSettings) => boolean;
  configs: readonly { label: string; path: string; pkg: BrowserPkg }[];
  /** `errors` collects a short message per failed browser — for a menu banner, not just the log. */
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

/**
 * Whether to collapse single-profile browsers in their detailed section.
 * When true, single-profile browsers are hidden from their detailed section
 * and only appear in the Browsers row (if showProfiledBrowsers is enabled).
 */
function shouldCollapseSingleProfileBrowsers(settings: BrowserSettings): boolean {
  return settings.collapseSingleProfileBrowsers;
}

/**
 * A family entry with exactly one profile and no active spaces/workspaces
 * under it — collapseSingleProfileBrowsers hides these from their detailed
 * section since the "Browsers" row already covers them with a single icon.
 */
function isSingleProfileEntry(entry: ResolvedBrowserEntry): boolean {
  return entry.items.length === 1 && (entry.items[0].spaces?.length ?? 0) === 0;
}

/**
 * A family with multiple profiles.ini path variants (e.g. Firefox's XDG vs
 * pre-XDG "classic" layout — see expandFirefoxVariants) resolves to the same
 * underlying pkg from more than one config, each with its own label
 * ("Firefox", "Firefox (classic)") — real for the detailed section below,
 * where each variant's profile list can genuinely differ, but not for this
 * flat row: it's one identity, so it gets one icon. Keeps the first config
 * seen for a given pkg (array order already puts the plain, unsuffixed
 * variant before "(classic)" — see expandFirefoxVariants).
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

/**
 * Builds the "Browsers" quick-launch row: one icon per installed browser
 * identity, regardless of family or whether it has profiles — always its
 * base command (no profile arg, no profile-groups/spaces handling), sorted
 * alphabetically. Every family still gets its own detailed section too (see
 * getBrowserEntries) — this row is a flat, uniform "just launch it" list
 * alongside those, gated by the same family toggles plus showProfiledBrowsers.
 */
function resolveBrowsersRow(settings: BrowserSettings, errors: string[]): ResolvedBrowserEntry[] {
  const withProfilesConfigs = settings.showProfiledBrowsers
    ? PROFILED_FAMILIES.filter((f) => f.enabled(settings)).flatMap((f) => f.configs)
    : [];
  // filterPresent also requires profiles.ini/Local State to exist, which a
  // never-launched browser hasn't created yet — this row only needs the
  // package itself.
  const available = dedupeByPkg([
    ...filterAvailable(withProfilesConfigs),
    ...(settings.showSimpleBrowsers ? filterAvailable(SIMPLE_BROWSERS) : []),
  ]);
  if (isEmpty(available)) return [];

  // flatMap + try/catch per browser, not a plain .map(): one bad icon lookup
  // shouldn't cost every other browser its spot in this row.
  const items = available
    .flatMap((b) => {
      try {
        return [
          {
            label: b.label,
            command: buildBaseCommand(b.pkg),
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
 * Resolves all enabled browser entries based on the provided settings: each
 * family's detailed section (profiles, colors, spaces) plus the flat
 * "Browsers" quick-launch row. A family resolver failing outright (rather
 * than isolating its own per-browser failures, which it already does) or
 * the Browsers row itself failing are both logged and reflected in `errors`
 * — everything else still resolves and renders normally.
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

  // resolveBrowsersRow is synchronous, so it can't go through settle() above
  // with the family promises — but it must still be isolated the same way:
  // a throw here (e.g. a future browser config with a malformed pkg) must
  // not discard the family sections already resolved just above.
  let browsersRow: ResolvedBrowserEntry[] = [];
  try {
    browsersRow = resolveBrowsersRow(settings, errors);
  } catch (e: unknown) {
    errors.push("the Browsers row");
    logError(e as object, "[browser-hub] the Browsers row failed to resolve");
  }

  return { entries: [...detailedEntries, ...browsersRow], errors };
}
