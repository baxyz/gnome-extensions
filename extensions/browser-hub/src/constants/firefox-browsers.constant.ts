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

/**
 * Most Firefox-family browsers follow the same packaging shapes: an XDG path
 * (`$XDG_CONFIG_HOME/<name>/profiles.ini`), a pre-XDG "classic" path
 * (`~/.<name>/profiles.ini`), a Flatpak path (the classic path mirrored under
 * the sandbox's own home), and sometimes a snap path. `classic` is the
 * relative suffix under HOME_DIR shared by the classic AND Flatpak forms
 * (they're usually identical, e.g. ".librewolf/profiles.ini" — Firefox itself
 * is the one exception, using ".mozilla/firefox/profiles.ini" instead of
 * ".firefox/profiles.ini").
 *
 * The "(classic)" label suffix is only added when an XDG variant is ALSO
 * generated (otherwise it's just the plain label) — browsers with only one
 * native path don't need to disambiguate. A few real oddities don't fit this
 * shape at all (Tor Browser's deeply nested path, IceCat's "(classic)" label
 * despite having no XDG sibling yet) and are written out by hand below
 * instead of forced through this generator.
 */
function expandFirefoxVariants(v: {
  label: string;
  icon?: string | string[];
  spaceType?: SpaceType;
  binary?: string | string[];
  /** Relative to XDG_CONFIG_HOME, e.g. "librewolf/profiles.ini". */
  xdg?: string;
  /** Relative to HOME_DIR, e.g. ".librewolf/profiles.ini". Also used for the Flatpak path. */
  classic?: string;
  flatpakId?: string;
  /** Relative to HOME_DIR, e.g. "snap/firefox/common/.mozilla/firefox/profiles.ini". */
  snap?: string;
  snapName?: string;
}): FirefoxBrowserConfig[] {
  const configs: FirefoxBrowserConfig[] = [];
  const binary = v.binary ?? v.label.toLowerCase();
  const common = {
    type: BrowserType.Firefox as const,
    ...(v.spaceType != null && { spaceType: v.spaceType }),
    ...(v.icon != null && { icon: v.icon }),
  };

  if (v.xdg) {
    configs.push({
      ...common,
      label: v.label,
      path: `${XDG_CONFIG_HOME}/${v.xdg}`,
      pkg: { manager: PackageManager.Native, binary },
    });
  }
  if (v.classic) {
    configs.push({
      ...common,
      label: v.xdg ? `${v.label} (classic)` : v.label,
      path: `${HOME_DIR}/${v.classic}`,
      pkg: { manager: PackageManager.Native, binary },
    });
  }
  if (v.flatpakId && v.classic) {
    configs.push({
      ...common,
      label: `${v.label} (flatpak)`,
      path: `${HOME_DIR}/.var/app/${v.flatpakId}/${v.classic}`,
      pkg: { manager: PackageManager.Flatpak, appId: v.flatpakId },
    });
  }
  if (v.snap) {
    configs.push({
      ...common,
      label: `${v.label} (snap)`,
      path: `${HOME_DIR}/${v.snap}`,
      // SnapPkg.name is a single string, unlike NativePkg.binary — fall back
      // to the first binary name on the rare chance binary is an array.
      pkg: {
        manager: PackageManager.Snap,
        name: v.snapName ?? (Array.isArray(binary) ? binary[0] : binary),
      },
    });
  }
  return configs;
}

export const FIREFOX_BROWSERS: FirefoxBrowserConfig[] = [
  // XDG support since Firefox 147.
  ...expandFirefoxVariants({
    label: "Firefox",
    xdg: "mozilla/firefox/profiles.ini",
    classic: ".mozilla/firefox/profiles.ini",
    flatpakId: "org.mozilla.firefox",
    snap: "snap/firefox/common/.mozilla/firefox/profiles.ini",
    binary: "firefox",
    icon: FIREFOX_ICON,
  }),

  // Firefox ESR: no XDG support (ESR lags stable). Profile dir is shared with regular Firefox
  // on Debian/Ubuntu (both use ~/.mozilla/firefox/), but the binary differs: firefox-esr vs firefox.
  ...expandFirefoxVariants({
    label: "Firefox ESR",
    classic: ".mozilla/firefox/profiles.ini",
    binary: "firefox-esr",
    icon: FIREFOX_ICON,
  }),

  // Tor Browser: installed via torbrowser-launcher. profiles.ini is buried inside the downloaded
  // bundle, not in ~/.mozilla/ like standard Firefox — doesn't fit expandFirefoxVariants' shape.
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

  ...expandFirefoxVariants({
    label: "Waterfox",
    xdg: "waterfox/profiles.ini",
    classic: ".waterfox/profiles.ini",
    flatpakId: "net.waterfox.waterfox",
    binary: "waterfox",
    icon: WATERFOX_ICON,
  }),

  ...expandFirefoxVariants({
    label: "LibreWolf",
    xdg: "librewolf/profiles.ini",
    classic: ".librewolf/profiles.ini",
    flatpakId: "io.gitlab.librewolf-community",
    binary: "librewolf",
    icon: LIBREWOLF_ICON,
  }),

  // No XDG support: issue #224 is Icebox (not planned).
  ...expandFirefoxVariants({
    label: "Mullvad Browser",
    classic: ".mullvad-browser/profiles.ini",
    flatpakId: "net.mullvad.MullvadBrowser",
    binary: "mullvad-browser",
    icon: MULLVAD_BROWSER_ICON,
  }),

  ...expandFirefoxVariants({
    label: "Floorp",
    xdg: "floorp/profiles.ini",
    classic: ".floorp/profiles.ini",
    flatpakId: "one.ablaze.floorp",
    binary: "floorp",
    icon: FLOORP_ICON,
  }),

  // Discontinued 2024. Profile dir name contains a space.
  ...expandFirefoxVariants({
    label: "Ghostery Dawn",
    classic: ".ghostery browser/profiles.ini",
    binary: "ghostery",
    icon: GHOSTERY_ICON,
  }),

  ...expandFirefoxVariants({
    label: "Zen",
    xdg: "zen/profiles.ini",
    classic: ".zen/profiles.ini",
    flatpakId: "app.zen_browser.zen",
    binary: "zen-browser",
    spaceType: SpaceType.ZenWorkspaces,
    icon: ZEN_ICON,
  }),

  // Garuda Linux. XDG support added in v13, classic path covers pre-v13.
  ...expandFirefoxVariants({
    label: "Firedragon",
    xdg: "firedragon/profiles.ini",
    classic: ".firedragon/profiles.ini",
    binary: "firedragon",
    icon: FIREDRAGON_ICON,
  }),

  // GNU IceCat, based on Firefox ESR 115; XDG landed upstream in Firefox 147, not yet inherited —
  // hand-written since the "(classic)" label anticipates a future XDG sibling that doesn't exist yet.
  {
    type: BrowserType.Firefox,
    label: "IceCat (classic)",
    path: HOME_DIR + "/.icecat/profiles.ini",
    pkg: { manager: PackageManager.Native, binary: "icecat" },
    icon: ICECAT_ICON,
  },

  // Moonchild Productions, Goanna engine.
  {
    type: BrowserType.Firefox,
    label: "Palemoon",
    path: HOME_DIR + "/.moonchild productions/pale moon/profiles.ini",
    pkg: { manager: PackageManager.Native, binary: "palemoon" },
    icon: PALEMOON_ICON,
  },

  // Moonchild Productions, Goanna engine. No XDG support planned; uses non-standard .basilisk-dev directory.
  {
    type: BrowserType.Firefox,
    label: "Basilisk",
    path: HOME_DIR + "/.basilisk-dev/profiles.ini",
    pkg: { manager: PackageManager.Native, binary: "basilisk" },
    icon: BASILISK_ICON,
  },
];
