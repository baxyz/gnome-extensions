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
import {
  resolveChromiumBrowsers,
  resolveFalkonBrowsers,
  resolveFirefoxBrowsers,
  resolveSimpleBrowsers,
} from "./browser";

export type { FirefoxOptions, ProfileGroupsMode } from "../taxonomy";

/** Settings that control which browser families and features are enabled. */
export type BrowserSettings = {
  showFirefoxFamily: boolean;
  showChromeFamily: boolean;
  showSimpleBrowsers: boolean;
} & FirefoxOptions;

/** Default settings with all features enabled — used when no settings are provided. */
const ALL_ON: BrowserSettings = {
  showFirefoxFamily: true,
  showChromeFamily: true,
  showSimpleBrowsers: true,
  enabledSpaces: new Set(Object.values(SpaceType)),
  profileGroupsMode: "profiles",
};

/**
 * Resolves all enabled browser entries based on the provided settings.
 * Runs all browser family resolvers concurrently and returns a flat list of
 * all resolved entries. If a resolver fails, its error is logged but other
 * families' entries are still returned.
 */
export async function getBrowserEntries(
  settings: BrowserSettings = ALL_ON,
): Promise<ResolvedBrowserEntry[]> {
  // Use helpers4 settle to run all resolvers concurrently; one family throwing
  // (a bug, not a missing-file case — every resolver already swallows its own
  // I/O errors) shouldn't blank out every other family's entries too.
  const { fulfilled, rejected } = await settle([
    settings.showFirefoxFamily
      ? resolveFirefoxBrowsers(FIREFOX_BROWSERS, settings)
      : Promise.resolve([]),
    settings.showChromeFamily ? resolveChromiumBrowsers(CHROMIUM_BROWSERS) : Promise.resolve([]),
    settings.showChromeFamily ? resolveFalkonBrowsers(FALKON_BROWSERS) : Promise.resolve([]),
    settings.showSimpleBrowsers ? resolveSimpleBrowsers(SIMPLE_BROWSERS) : Promise.resolve([]),
  ]);
  for (const reason of rejected) {
    logError(reason as object, "[browser-hub] a browser family failed to resolve");
  }
  return fulfilled.flat();
}
