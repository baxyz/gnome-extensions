import { BrowserType, PackageManager, SpaceType } from "../taxonomy";
import type { FirefoxBrowserConfig } from "../taxonomy";
import { HOME_DIR, XDG_CONFIG_HOME } from "./paths.constant";

// Best-guess "-symbolic" icon name(s) per real browser identity, shared across
// its native/flatpak/snap/classic packaging variants below. Unverified beyond
// FIREFOX_ICON (confirmed via the sibling firefox-profiles extension) — wrong
// guesses are harmless, resolveBrowserIcon() only uses a name the user's
// actual icon theme provides and shows nothing otherwise.
const FIREFOX_ICON = "firefox-symbolic";
const TOR_BROWSER_ICON = "tor-browser-symbolic";
const WATERFOX_ICON = "waterfox-symbolic";
const LIBREWOLF_ICON = "librewolf-symbolic";
const MULLVAD_BROWSER_ICON = "mullvad-browser-symbolic";
const FLOORP_ICON = "floorp-symbolic";
const GHOSTERY_ICON = "ghostery-symbolic";
const ZEN_ICON = ["zen-browser-symbolic", "zen-symbolic"];
const FIREDRAGON_ICON = "firedragon-symbolic";
const ICECAT_ICON = "icecat-symbolic";
const PALEMOON_ICON = "palemoon-symbolic";
const BASILISK_ICON = "basilisk-symbolic";

export const FIREFOX_BROWSERS: FirefoxBrowserConfig[] = [
  // === Firefox ===
  // XDG support since Firefox 147.
  {
    type: BrowserType.Firefox,
    label: "Firefox",
    path: XDG_CONFIG_HOME + "/mozilla/firefox/profiles.ini",
    pkg: { manager: PackageManager.Native, binary: "firefox" },
    icon: FIREFOX_ICON,
  },
  {
    type: BrowserType.Firefox,
    label: "Firefox (classic)",
    path: HOME_DIR + "/.mozilla/firefox/profiles.ini",
    pkg: { manager: PackageManager.Native, binary: "firefox" },
    icon: FIREFOX_ICON,
  },
  {
    type: BrowserType.Firefox,
    label: "Firefox (flatpak)",
    path: HOME_DIR + "/.var/app/org.mozilla.firefox/.mozilla/firefox/profiles.ini",
    pkg: { manager: PackageManager.Flatpak, appId: "org.mozilla.firefox" },
    icon: FIREFOX_ICON,
  },
  {
    type: BrowserType.Firefox,
    label: "Firefox (snap)",
    path: HOME_DIR + "/snap/firefox/common/.mozilla/firefox/profiles.ini",
    pkg: { manager: PackageManager.Snap, name: "firefox" },
    icon: FIREFOX_ICON,
  },

  // === Firefox ESR ===
  // No XDG support (ESR lags stable). Profile dir is shared with regular Firefox on Debian/Ubuntu
  // (both use ~/.mozilla/firefox/), but the binary differs: firefox-esr vs firefox.
  {
    type: BrowserType.Firefox,
    label: "Firefox ESR",
    path: HOME_DIR + "/.mozilla/firefox/profiles.ini",
    pkg: { manager: PackageManager.Native, binary: "firefox-esr" },
    icon: FIREFOX_ICON,
  },

  // === Tor Browser ===
  // Installed via torbrowser-launcher. profiles.ini is buried inside the downloaded bundle,
  // not in ~/.mozilla/ like standard Firefox.
  {
    type: BrowserType.Firefox,
    label: "Tor Browser",
    path:
      HOME_DIR +
      "/.local/share/torbrowser/tbb/x86_64/tor-browser/Browser/TorBrowser/Data/Browser/profiles.ini",
    pkg: { manager: PackageManager.Native, binary: "torbrowser-launcher" },
    icon: TOR_BROWSER_ICON,
  },
  {
    type: BrowserType.Firefox,
    label: "Tor Browser (flatpak)",
    path:
      HOME_DIR +
      "/.var/app/org.torproject.torbrowser-launcher/data/torbrowser/tbb/x86_64/tor-browser/Browser/TorBrowser/Data/Browser/profiles.ini",
    pkg: { manager: PackageManager.Flatpak, appId: "org.torproject.torbrowser-launcher" },
    icon: TOR_BROWSER_ICON,
  },

  // === Waterfox ===
  {
    type: BrowserType.Firefox,
    label: "Waterfox",
    path: XDG_CONFIG_HOME + "/waterfox/profiles.ini",
    pkg: { manager: PackageManager.Native, binary: "waterfox" },
    icon: WATERFOX_ICON,
  },
  {
    type: BrowserType.Firefox,
    label: "Waterfox (classic)",
    path: HOME_DIR + "/.waterfox/profiles.ini",
    pkg: { manager: PackageManager.Native, binary: "waterfox" },
    icon: WATERFOX_ICON,
  },
  {
    type: BrowserType.Firefox,
    label: "Waterfox (flatpak)",
    path: HOME_DIR + "/.var/app/net.waterfox.waterfox/.waterfox/profiles.ini",
    pkg: { manager: PackageManager.Flatpak, appId: "net.waterfox.waterfox" },
    icon: WATERFOX_ICON,
  },

  // === LibreWolf ===
  {
    type: BrowserType.Firefox,
    label: "LibreWolf",
    path: XDG_CONFIG_HOME + "/librewolf/profiles.ini",
    pkg: { manager: PackageManager.Native, binary: "librewolf" },
    icon: LIBREWOLF_ICON,
  },
  {
    type: BrowserType.Firefox,
    label: "LibreWolf (classic)",
    path: HOME_DIR + "/.librewolf/profiles.ini",
    pkg: { manager: PackageManager.Native, binary: "librewolf" },
    icon: LIBREWOLF_ICON,
  },
  {
    type: BrowserType.Firefox,
    label: "LibreWolf (flatpak)",
    path: HOME_DIR + "/.var/app/io.gitlab.librewolf-community/.librewolf/profiles.ini",
    pkg: { manager: PackageManager.Flatpak, appId: "io.gitlab.librewolf-community" },
    icon: LIBREWOLF_ICON,
  },

  // === Mullvad Browser ===
  // No XDG support: issue #224 is Icebox (not planned).
  {
    type: BrowserType.Firefox,
    label: "Mullvad Browser",
    path: HOME_DIR + "/.mullvad-browser/profiles.ini",
    pkg: { manager: PackageManager.Native, binary: "mullvad-browser" },
    icon: MULLVAD_BROWSER_ICON,
  },
  {
    type: BrowserType.Firefox,
    label: "Mullvad Browser (flatpak)",
    path: HOME_DIR + "/.var/app/net.mullvad.MullvadBrowser/.mullvad-browser/profiles.ini",
    pkg: { manager: PackageManager.Flatpak, appId: "net.mullvad.MullvadBrowser" },
    icon: MULLVAD_BROWSER_ICON,
  },

  // === Floorp ===
  {
    type: BrowserType.Firefox,
    label: "Floorp",
    path: XDG_CONFIG_HOME + "/floorp/profiles.ini",
    pkg: { manager: PackageManager.Native, binary: "floorp" },
    icon: FLOORP_ICON,
  },
  {
    type: BrowserType.Firefox,
    label: "Floorp (classic)",
    path: HOME_DIR + "/.floorp/profiles.ini",
    pkg: { manager: PackageManager.Native, binary: "floorp" },
    icon: FLOORP_ICON,
  },
  {
    type: BrowserType.Firefox,
    label: "Floorp (flatpak)",
    path: HOME_DIR + "/.var/app/one.ablaze.floorp/.floorp/profiles.ini",
    pkg: { manager: PackageManager.Flatpak, appId: "one.ablaze.floorp" },
    icon: FLOORP_ICON,
  },

  // === Ghostery Dawn (discontinued 2024) ===
  // Profile dir name contains a space.
  {
    type: BrowserType.Firefox,
    label: "Ghostery Dawn",
    path: HOME_DIR + "/.ghostery browser/profiles.ini",
    pkg: { manager: PackageManager.Native, binary: "ghostery" },
    icon: GHOSTERY_ICON,
  },

  // === Zen Browser ===
  {
    type: BrowserType.Firefox,
    label: "Zen",
    path: XDG_CONFIG_HOME + "/zen/profiles.ini",
    pkg: { manager: PackageManager.Native, binary: "zen-browser" },
    spaceType: SpaceType.ZenWorkspaces,
    icon: ZEN_ICON,
  },
  {
    type: BrowserType.Firefox,
    label: "Zen (classic)",
    path: HOME_DIR + "/.zen/profiles.ini",
    pkg: { manager: PackageManager.Native, binary: "zen-browser" },
    spaceType: SpaceType.ZenWorkspaces,
    icon: ZEN_ICON,
  },
  {
    type: BrowserType.Firefox,
    label: "Zen (flatpak)",
    path: HOME_DIR + "/.var/app/app.zen_browser.zen/.zen/profiles.ini",
    pkg: { manager: PackageManager.Flatpak, appId: "app.zen_browser.zen" },
    spaceType: SpaceType.ZenWorkspaces,
    icon: ZEN_ICON,
  },

  // === Firedragon (Garuda Linux) ===
  // XDG support added in v13. Classic path covers pre-v13.
  {
    type: BrowserType.Firefox,
    label: "Firedragon",
    path: XDG_CONFIG_HOME + "/firedragon/profiles.ini",
    pkg: { manager: PackageManager.Native, binary: "firedragon" },
    icon: FIREDRAGON_ICON,
  },
  {
    type: BrowserType.Firefox,
    label: "Firedragon (classic)",
    path: HOME_DIR + "/.firedragon/profiles.ini",
    pkg: { manager: PackageManager.Native, binary: "firedragon" },
    icon: FIREDRAGON_ICON,
  },

  // === IceCat (GNU) ===
  // Based on Firefox ESR 115; XDG landed upstream in Firefox 147, not yet inherited.
  {
    type: BrowserType.Firefox,
    label: "IceCat (classic)",
    path: HOME_DIR + "/.icecat/profiles.ini",
    pkg: { manager: PackageManager.Native, binary: "icecat" },
    icon: ICECAT_ICON,
  },

  // === Pale Moon (Moonchild Productions, Goanna engine) ===
  {
    type: BrowserType.Firefox,
    label: "Palemoon",
    path: HOME_DIR + "/.moonchild productions/pale moon/profiles.ini",
    pkg: { manager: PackageManager.Native, binary: "palemoon" },
    icon: PALEMOON_ICON,
  },

  // === Basilisk (Moonchild Productions, Goanna engine) ===
  // No XDG support planned; uses non-standard .basilisk-dev directory.
  {
    type: BrowserType.Firefox,
    label: "Basilisk",
    path: HOME_DIR + "/.basilisk-dev/profiles.ini",
    pkg: { manager: PackageManager.Native, binary: "basilisk" },
    icon: BASILISK_ICON,
  },
];
