import GLib from "gi://GLib";
import { BrowserType } from "./browser-type.enum";
import type { FirefoxBrowserConfig } from "../types";

const HOME_DIR = GLib.get_home_dir();
const XDG_CONFIG_HOME = GLib.getenv("XDG_CONFIG_HOME") || HOME_DIR + "/.config";

export const FIREFOX_BROWSERS: FirefoxBrowserConfig[] = [
  // === Firefox ===
  // XDG support since Firefox 147.
  {
    type: BrowserType.Firefox,
    label: "Firefox",
    path: XDG_CONFIG_HOME + "/mozilla/firefox/profiles.ini",
    command: "firefox",
  },
  {
    type: BrowserType.Firefox,
    label: "Firefox (classic)",
    path: HOME_DIR + "/.mozilla/firefox/profiles.ini",
    command: "firefox",
  },
  {
    type: BrowserType.Firefox,
    label: "Firefox (flatpak)",
    path: HOME_DIR + "/.var/app/org.mozilla.firefox/.mozilla/firefox/profiles.ini",
    command: "flatpak run org.mozilla.firefox",
  },
  {
    type: BrowserType.Firefox,
    label: "Firefox (snap)",
    path: HOME_DIR + "/snap/firefox/common/.mozilla/firefox/profiles.ini",
    command: "snap run firefox",
  },

  // === Waterfox ===
  {
    type: BrowserType.Firefox,
    label: "Waterfox",
    path: XDG_CONFIG_HOME + "/waterfox/profiles.ini",
    command: "waterfox",
  },
  {
    type: BrowserType.Firefox,
    label: "Waterfox (classic)",
    path: HOME_DIR + "/.waterfox/profiles.ini",
    command: "waterfox",
  },
  {
    type: BrowserType.Firefox,
    label: "Waterfox (flatpak)",
    path: HOME_DIR + "/.var/app/net.waterfox.waterfox/.waterfox/profiles.ini",
    command: "flatpak run net.waterfox.waterfox",
  },

  // === LibreWolf ===
  {
    type: BrowserType.Firefox,
    label: "LibreWolf",
    path: XDG_CONFIG_HOME + "/librewolf/profiles.ini",
    command: "librewolf",
  },
  {
    type: BrowserType.Firefox,
    label: "LibreWolf (classic)",
    path: HOME_DIR + "/.librewolf/profiles.ini",
    command: "librewolf",
  },
  {
    type: BrowserType.Firefox,
    label: "LibreWolf (flatpak)",
    path: HOME_DIR + "/.var/app/io.gitlab.librewolf-community/.librewolf/profiles.ini",
    command: "flatpak run io.gitlab.librewolf-community",
  },

  // === Mullvad Browser ===
  // No XDG support: issue #224 is Icebox (not planned).
  {
    type: BrowserType.Firefox,
    label: "Mullvad Browser",
    path: HOME_DIR + "/.mullvad-browser/profiles.ini",
    command: "mullvad-browser",
  },
  {
    type: BrowserType.Firefox,
    label: "Mullvad Browser (flatpak)",
    path: HOME_DIR + "/.var/app/net.mullvad.MullvadBrowser/.mullvad-browser/profiles.ini",
    command: "flatpak run net.mullvad.MullvadBrowser",
  },

  // === Floorp ===
  {
    type: BrowserType.Firefox,
    label: "Floorp",
    path: XDG_CONFIG_HOME + "/floorp/profiles.ini",
    command: "floorp",
  },
  {
    type: BrowserType.Firefox,
    label: "Floorp (classic)",
    path: HOME_DIR + "/.floorp/profiles.ini",
    command: "floorp",
  },
  {
    type: BrowserType.Firefox,
    label: "Floorp (flatpak)",
    path: HOME_DIR + "/.var/app/one.ablaze.floorp/.floorp/profiles.ini",
    command: "flatpak run one.ablaze.floorp",
  },

  // === Zen Browser ===
  {
    type: BrowserType.Firefox,
    label: "Zen",
    path: XDG_CONFIG_HOME + "/zen/profiles.ini",
    command: "zen-browser",
  },
  {
    type: BrowserType.Firefox,
    label: "Zen (classic)",
    path: HOME_DIR + "/.zen/profiles.ini",
    command: "zen-browser",
  },
  {
    type: BrowserType.Firefox,
    label: "Zen (flatpak)",
    path: HOME_DIR + "/.var/app/app.zen_browser.zen/.zen/profiles.ini",
    command: "flatpak run app.zen_browser.zen",
  },

  // === Firedragon (Garuda Linux) ===
  {
    type: BrowserType.Firefox,
    label: "Firedragon",
    path: XDG_CONFIG_HOME + "/firedragon/profiles.ini",
    command: "firedragon",
  },
  {
    type: BrowserType.Firefox,
    label: "Firedragon (classic)",
    path: HOME_DIR + "/.firedragon/profiles.ini",
    command: "firedragon",
  },

  // === IceCat (GNU) ===
  // Based on Firefox ESR 115; XDG landed upstream in Firefox 147, not yet inherited.
  {
    type: BrowserType.Firefox,
    label: "IceCat (classic)",
    path: HOME_DIR + "/.icecat/profiles.ini",
    command: "icecat",
  },

  // === Pale Moon (Moonchild Productions, Goanna engine) ===
  {
    type: BrowserType.Firefox,
    label: "Palemoon",
    path: HOME_DIR + "/.moonchild productions/pale moon/profiles.ini",
    command: "palemoon",
  },

  // === Basilisk (Moonchild Productions, Goanna engine) ===
  // No XDG support planned; uses non-standard .basilisk-dev directory.
  {
    type: BrowserType.Firefox,
    label: "Basilisk",
    path: HOME_DIR + "/.basilisk-dev/profiles.ini",
    command: "basilisk",
  },
];
