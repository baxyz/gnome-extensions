import {
  CHROMIUM_BROWSERS,
  FALKON_BROWSERS,
  FIREFOX_BROWSERS,
  SIMPLE_BROWSERS,
} from "../constants";
import type { ResolvedBrowserEntry } from "../types";
import { SpaceType } from "../types/space-type.enum";
import { resolveChromiumBrowsers } from "./chromium.helper";
import { resolveFalkonBrowsers } from "./falkon.helper";
import { resolveFirefoxBrowsers } from "./firefox.helper";
import { resolveSimpleBrowsers } from "./simple.helper";

export type BrowserSettings = {
  showFirefoxFamily: boolean;
  showChromeFamily: boolean;
  showSimpleBrowsers: boolean;
  enabledSpaces: ReadonlySet<SpaceType>;
};

const ALL_ON: BrowserSettings = {
  showFirefoxFamily: true,
  showChromeFamily: true,
  showSimpleBrowsers: true,
  enabledSpaces: new Set(Object.values(SpaceType)),
};

export function getBrowserEntries(
  settings: BrowserSettings = ALL_ON,
): Promise<ResolvedBrowserEntry[]> {
  return Promise.all([
    settings.showFirefoxFamily
      ? resolveFirefoxBrowsers(FIREFOX_BROWSERS, settings.enabledSpaces)
      : [],
    settings.showChromeFamily ? resolveChromiumBrowsers(CHROMIUM_BROWSERS) : [],
    settings.showChromeFamily ? resolveFalkonBrowsers(FALKON_BROWSERS) : [],
    settings.showSimpleBrowsers ? resolveSimpleBrowsers(SIMPLE_BROWSERS) : [],
  ]).then((results) => results.flat());
}
