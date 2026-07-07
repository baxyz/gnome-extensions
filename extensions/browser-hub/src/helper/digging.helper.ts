import {
  CHROMIUM_BROWSERS,
  FALKON_BROWSERS,
  FIREFOX_BROWSERS,
  SIMPLE_BROWSERS,
} from "../constants";
import type { ResolvedBrowserEntry } from "../types";
import type { FirefoxOptions } from "../types";
import { SpaceType } from "../types/space-type.enum";
import {
  resolveChromiumBrowsers,
  resolveFalkonBrowsers,
  resolveFirefoxBrowsers,
  resolveSimpleBrowsers,
} from "./browser";

export type { FirefoxOptions, ProfileGroupsMode } from "../types";

export type BrowserSettings = {
  showFirefoxFamily: boolean;
  showChromeFamily: boolean;
  showSimpleBrowsers: boolean;
} & FirefoxOptions;

const ALL_ON: BrowserSettings = {
  showFirefoxFamily: true,
  showChromeFamily: true,
  showSimpleBrowsers: true,
  enabledSpaces: new Set(Object.values(SpaceType)),
  profileGroupsMode: "profiles",
};

export function getBrowserEntries(
  settings: BrowserSettings = ALL_ON,
): Promise<ResolvedBrowserEntry[]> {
  return Promise.all([
    settings.showFirefoxFamily
      ? resolveFirefoxBrowsers(FIREFOX_BROWSERS, settings)
      : [],
    settings.showChromeFamily ? resolveChromiumBrowsers(CHROMIUM_BROWSERS) : [],
    settings.showChromeFamily ? resolveFalkonBrowsers(FALKON_BROWSERS) : [],
    settings.showSimpleBrowsers ? resolveSimpleBrowsers(SIMPLE_BROWSERS) : [],
  ]).then((results) => results.flat());
}
