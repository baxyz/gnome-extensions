import { BrowserType } from "./browser-type.enum";
import type { BrowserPkg } from "./browser-package.types";

export type FirefoxBrowserConfig = {
  type: BrowserType.Firefox;
  label: string;
  /** Absolute path to profiles.ini */
  path: string;
  pkg: BrowserPkg;
};

export type ChromiumBrowserConfig = {
  type: BrowserType.Chromium;
  label: string;
  /** Absolute path to the "Local State" JSON file */
  path: string;
  pkg: BrowserPkg;
};

export type FalkonBrowserConfig = {
  type: BrowserType.Falkon;
  label: string;
  /** Absolute path to the profiles directory */
  path: string;
  pkg: BrowserPkg;
};

export type SimpleBrowserConfig = {
  type: BrowserType.Simple;
  label: string;
  pkg: BrowserPkg;
};
