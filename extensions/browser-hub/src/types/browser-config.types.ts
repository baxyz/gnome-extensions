import { BrowserType } from "../constants/browser-type.enum";

export type FirefoxBrowserConfig = {
  type: BrowserType.Firefox;
  label: string;
  /** Absolute path to profiles.ini */
  path: string;
  command: string;
};

export type ChromiumBrowserConfig = {
  type: BrowserType.Chromium;
  label: string;
  /** Absolute path to the "Local State" JSON file */
  path: string;
  command: string;
};

export type FalkonBrowserConfig = {
  type: BrowserType.Falkon;
  label: string;
  /** Absolute path to the profiles directory */
  path: string;
  command: string;
};

export type SimpleBrowserConfig = {
  type: BrowserType.Simple;
  label: string;
  command: string;
  /**
   * For flatpak apps: path to the app data directory used to check installation.
   * If omitted, the command's binary is looked up in PATH instead.
   */
  checkPath?: string;
};
