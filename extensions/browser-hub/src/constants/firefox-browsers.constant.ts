import GLib from "gi://GLib";
import { BrowserType, PackageManager } from "../types";
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
    pkg: { manager: PackageManager.Native, binary: "firefox" },
  },
  {
    type: BrowserType.Firefox,
    label: "Firefox (classic)",
    path: HOME_DIR + "/.mozilla/firefox/profiles.ini",
    pkg: { manager: PackageManager.Native, binary: "firefox" },
  },
  {
    type: BrowserType.Firefox,
    label: "Firefox (flatpak)",
    path: HOME_DIR + "/.var/app/org.mozilla.firefox/.mozilla/firefox/profiles.ini",
    pkg: { manager: PackageManager.Flatpak, appId: "org.mozilla.firefox" },
  },
  {
    type: BrowserType.Firefox,
    label: "Firefox (snap)",
    path: HOME_DIR + "/snap/firefox/common/.mozilla/firefox/profiles.ini",
    pkg: { manager: PackageManager.Snap, name: "firefox" },
  },

  // === Waterfox ===
  {
    type: BrowserType.Firefox,
    label: "Waterfox",
    path: XDG_CONFIG_HOME + "/waterfox/profiles.ini",
    pkg: { manager: PackageManager.Native, binary: "waterfox" },
  },
  {
    type: BrowserType.Firefox,
    label: "Waterfox (classic)",
    path: HOME_DIR + "/.waterfox/profiles.ini",
    pkg: { manager: PackageManager.Native, binary: "waterfox" },
  },
  {
    type: BrowserType.Firefox,
    label: "Waterfox (flatpak)",
    path: HOME_DIR + "/.var/app/net.waterfox.waterfox/.waterfox/profiles.ini",
    pkg: { manager: PackageManager.Flatpak, appId: "net.waterfox.waterfox" },
  },

  // === LibreWolf ===
  {
    type: BrowserType.Firefox,
    label: "LibreWolf",
    path: XDG_CONFIG_HOME + "/librewolf/profiles.ini",
    pkg: { manager: PackageManager.Native, binary: "librewolf" },
  },
  {
    type: BrowserType.Firefox,
    label: "LibreWolf (classic)",
    path: HOME_DIR + "/.librewolf/profiles.ini",
    pkg: { manager: PackageManager.Native, binary: "librewolf" },
  },
  {
    type: BrowserType.Firefox,
    label: "LibreWolf (flatpak)",
    path: HOME_DIR + "/.var/app/io.gitlab.librewolf-community/.librewolf/profiles.ini",
    pkg: { manager: PackageManager.Flatpak, appId: "io.gitlab.librewolf-community" },
  },

  // === Mullvad Browser ===
  // No XDG support: issue #224 is Icebox (not planned).
  {
    type: BrowserType.Firefox,
    label: "Mullvad Browser",
    path: HOME_DIR + "/.mullvad-browser/profiles.ini",
    pkg: { manager: PackageManager.Native, binary: "mullvad-browser" },
  },
  {
    type: BrowserType.Firefox,
    label: "Mullvad Browser (flatpak)",
    path: HOME_DIR + "/.var/app/net.mullvad.MullvadBrowser/.mullvad-browser/profiles.ini",
    pkg: { manager: PackageManager.Flatpak, appId: "net.mullvad.MullvadBrowser" },
  },

  // === Floorp ===
  {
    type: BrowserType.Firefox,
    label: "Floorp",
    path: XDG_CONFIG_HOME + "/floorp/profiles.ini",
    pkg: { manager: PackageManager.Native, binary: "floorp" },
  },
  {
    type: BrowserType.Firefox,
    label: "Floorp (classic)",
    path: HOME_DIR + "/.floorp/profiles.ini",
    pkg: { manager: PackageManager.Native, binary: "floorp" },
  },
  {
    type: BrowserType.Firefox,
    label: "Floorp (flatpak)",
    path: HOME_DIR + "/.var/app/one.ablaze.floorp/.floorp/profiles.ini",
    pkg: { manager: PackageManager.Flatpak, appId: "one.ablaze.floorp" },
  },

  // === Zen Browser ===
  {
    type: BrowserType.Firefox,
    label: "Zen",
    path: XDG_CONFIG_HOME + "/zen/profiles.ini",
    pkg: { manager: PackageManager.Native, binary: "zen-browser" },
  },
  {
    type: BrowserType.Firefox,
    label: "Zen (classic)",
    path: HOME_DIR + "/.zen/profiles.ini",
    pkg: { manager: PackageManager.Native, binary: "zen-browser" },
  },
  {
    type: BrowserType.Firefox,
    label: "Zen (flatpak)",
    path: HOME_DIR + "/.var/app/app.zen_browser.zen/.zen/profiles.ini",
    pkg: { manager: PackageManager.Flatpak, appId: "app.zen_browser.zen" },
  },

  // === Firedragon (Garuda Linux) ===
  // XDG support added in v13. Classic path covers pre-v13.
  {
    type: BrowserType.Firefox,
    label: "Firedragon",
    path: XDG_CONFIG_HOME + "/firedragon/profiles.ini",
    pkg: { manager: PackageManager.Native, binary: "firedragon" },
  },
  {
    type: BrowserType.Firefox,
    label: "Firedragon (classic)",
    path: HOME_DIR + "/.firedragon/profiles.ini",
    pkg: { manager: PackageManager.Native, binary: "firedragon" },
  },

  // === IceCat (GNU) ===
  // Based on Firefox ESR 115; XDG landed upstream in Firefox 147, not yet inherited.
  {
    type: BrowserType.Firefox,
    label: "IceCat (classic)",
    path: HOME_DIR + "/.icecat/profiles.ini",
    pkg: { manager: PackageManager.Native, binary: "icecat" },
  },

  // === Pale Moon (Moonchild Productions, Goanna engine) ===
  {
    type: BrowserType.Firefox,
    label: "Palemoon",
    path: HOME_DIR + "/.moonchild productions/pale moon/profiles.ini",
    pkg: { manager: PackageManager.Native, binary: "palemoon" },
  },

  // === Basilisk (Moonchild Productions, Goanna engine) ===
  // No XDG support planned; uses non-standard .basilisk-dev directory.
  {
    type: BrowserType.Firefox,
    label: "Basilisk",
    path: HOME_DIR + "/.basilisk-dev/profiles.ini",
    pkg: { manager: PackageManager.Native, binary: "basilisk" },
  },
];
