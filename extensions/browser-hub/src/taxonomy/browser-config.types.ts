import { BrowserType } from "./browser-type.enum";
import type { SpaceType } from "./space-type.enum";
import type { BrowserPkg } from "./browser-package.types";

export type FirefoxBrowserConfig = {
  type: BrowserType.Firefox;
  label: string;
  /** Absolute path to profiles.ini */
  path: string;
  pkg: BrowserPkg;
  /** Set when the browser supports in-profile spaces (e.g. Zen) */
  spaceType?: SpaceType;
  /**
   * This browser's own "-symbolic" GNOME icon name candidate(s), tried in
   * order as a profile's fallback icon when it has no other mappable one.
   * Unverified guesses are fine — resolveBrowserIcon() checks presence
   * against the real icon theme and shows nothing if none of them exist.
   */
  icon?: string | string[];
};

export type ChromiumBrowserConfig = {
  type: BrowserType.Chromium;
  label: string;
  /** Absolute path to the "Local State" JSON file */
  path: string;
  pkg: BrowserPkg;
  /** This browser's own "-symbolic" GNOME icon name candidate(s) — see FirefoxBrowserConfig.icon. */
  icon?: string | string[];
};

export type FalkonBrowserConfig = {
  type: BrowserType.Falkon;
  label: string;
  /** Absolute path to the profiles directory */
  path: string;
  pkg: BrowserPkg;
  /** This browser's own "-symbolic" GNOME icon name candidate(s) — see FirefoxBrowserConfig.icon. */
  icon?: string | string[];
};

export type SimpleBrowserConfig = {
  type: BrowserType.Simple;
  label: string;
  pkg: BrowserPkg;
  /** Desktop icon name (e.g. "org.gnome.Epiphany") */
  icon?: string;
};
