import {
  CHROMIUM_BROWSERS,
  FALKON_BROWSERS,
  FIREFOX_BROWSERS,
  SIMPLE_BROWSERS,
} from "../constants";
import type { ResolvedBrowserEntry } from "../types";
import { resolveChromiumBrowsers } from "./chromium.helper";
import { resolveFalkonBrowsers } from "./falkon.helper";
import { resolveFirefoxBrowsers } from "./firefox.helper";
import { resolveSimpleBrowsers } from "./simple.helper";

export function getBrowserEntries(): Promise<ResolvedBrowserEntry[]> {
  return Promise.all([
    resolveFirefoxBrowsers(FIREFOX_BROWSERS),
    resolveChromiumBrowsers(CHROMIUM_BROWSERS),
    resolveFalkonBrowsers(FALKON_BROWSERS),
    resolveSimpleBrowsers(SIMPLE_BROWSERS),
  ]).then((results) => results.flat());
}
