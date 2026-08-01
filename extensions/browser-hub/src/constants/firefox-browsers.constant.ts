import { BrowserType, PackageManager, SpaceType } from "../taxonomy";
import type { FirefoxBrowserConfig } from "../taxonomy";
import { HOME_DIR, XDG_CONFIG_HOME, snapCommonDir, snapDataDir } from "./paths.constant";

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
  spaceType?: SpaceType;
  binary?: string | string[];
  /** Relative to XDG_CONFIG_HOME, e.g. "librewolf/profiles.ini". */
  xdg?: string;
  /** Relative to HOME_DIR, e.g. ".librewolf/profiles.ini". Also used for the Flatpak path. */
  classic?: string;
  flatpakId?: string;
  /**
   * relativePath is relative to the snap's own per-user data dir. Set
   * `commonDir` when the snap persists its profile under $SNAP_USER_COMMON
   * (a fixed, unversioned dir — see snapCommonDir()) instead of the default
   * per-revision dir (see snapDataDir()) — confirmed necessary for Firefox,
   * whose profiles.ini lives under ~/snap/firefox/common/, not
   * ~/snap/firefox/<revision>/, so the latter goes stale after any update.
   */
  snap?: { name: string; relativePath: string; commonDir?: boolean };
}): FirefoxBrowserConfig[] {
  const configs: FirefoxBrowserConfig[] = [];
  const binary = v.binary ?? v.label.toLowerCase();
  const common = {
    type: BrowserType.Firefox as const,
    ...(v.spaceType != null && { spaceType: v.spaceType }),
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
    const dataDir = v.snap.commonDir ? snapCommonDir(v.snap.name) : snapDataDir(v.snap.name);
    configs.push({
      ...common,
      label: `${v.label} (snap)`,
      path: `${dataDir}/${v.snap.relativePath}`,
      pkg: { manager: PackageManager.Snap, name: v.snap.name },
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
    snap: { name: "firefox", relativePath: ".mozilla/firefox/profiles.ini", commonDir: true },
    binary: "firefox",
  }),

  // Firefox ESR: no XDG support (ESR lags stable). Profile dir is shared with regular Firefox
  // on Debian/Ubuntu (both use ~/.mozilla/firefox/), but the binary differs: firefox-esr vs firefox.
  ...expandFirefoxVariants({
    label: "Firefox ESR",
    classic: ".mozilla/firefox/profiles.ini",
    binary: "firefox-esr",
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
  },
  {
    type: BrowserType.Firefox,
    label: "Tor Browser (flatpak)",
    path:
      HOME_DIR +
      "/.var/app/org.torproject.torbrowser-launcher/data/torbrowser/tbb/x86_64/tor-browser/Browser/TorBrowser/Data/Browser/profiles.ini",
    pkg: { manager: PackageManager.Flatpak, appId: "org.torproject.torbrowser-launcher" },
  },

  ...expandFirefoxVariants({
    label: "Waterfox",
    xdg: "waterfox/profiles.ini",
    classic: ".waterfox/profiles.ini",
    flatpakId: "net.waterfox.waterfox",
    binary: "waterfox",
  }),

  ...expandFirefoxVariants({
    label: "LibreWolf",
    xdg: "librewolf/profiles.ini",
    classic: ".librewolf/profiles.ini",
    flatpakId: "io.gitlab.librewolf-community",
    binary: "librewolf",
  }),

  // No XDG support: issue #224 is Icebox (not planned).
  ...expandFirefoxVariants({
    label: "Mullvad Browser",
    classic: ".mullvad-browser/profiles.ini",
    flatpakId: "net.mullvad.MullvadBrowser",
    binary: "mullvad-browser",
  }),

  ...expandFirefoxVariants({
    label: "Floorp",
    xdg: "floorp/profiles.ini",
    classic: ".floorp/profiles.ini",
    flatpakId: "one.ablaze.floorp",
    binary: "floorp",
  }),

  // Discontinued 2024. Profile dir name contains a space.
  ...expandFirefoxVariants({
    label: "Ghostery Dawn",
    classic: ".ghostery browser/profiles.ini",
    binary: "ghostery",
  }),

  ...expandFirefoxVariants({
    label: "Zen",
    xdg: "zen/profiles.ini",
    classic: ".zen/profiles.ini",
    flatpakId: "app.zen_browser.zen",
    binary: "zen-browser",
    spaceType: SpaceType.ZenWorkspaces,
    // Community-maintained (Zen itself only publishes Flathub/native); snap
    // name is "zen-browser-snap", not "zen-browser".
    snap: { name: "zen-browser-snap", relativePath: ".zen/profiles.ini" },
  }),

  // Garuda Linux. XDG support added in v13, classic path covers pre-v13.
  ...expandFirefoxVariants({
    label: "Firedragon",
    xdg: "firedragon/profiles.ini",
    classic: ".firedragon/profiles.ini",
    binary: "firedragon",
  }),

  // GNU IceCat, based on Firefox ESR 115; XDG landed upstream in Firefox 147, not yet inherited —
  // hand-written since the "(classic)" label anticipates a future XDG sibling that doesn't exist yet.
  {
    type: BrowserType.Firefox,
    label: "IceCat (classic)",
    path: HOME_DIR + "/.icecat/profiles.ini",
    pkg: { manager: PackageManager.Native, binary: "icecat" },
  },

  // Moonchild Productions, Goanna engine.
  {
    type: BrowserType.Firefox,
    label: "Palemoon",
    path: HOME_DIR + "/.moonchild productions/pale moon/profiles.ini",
    pkg: { manager: PackageManager.Native, binary: "palemoon" },
  },

  // Moonchild Productions, Goanna engine. No XDG support planned; uses non-standard .basilisk-dev directory.
  {
    type: BrowserType.Firefox,
    label: "Basilisk",
    path: HOME_DIR + "/.basilisk-dev/profiles.ini",
    pkg: { manager: PackageManager.Native, binary: "basilisk" },
  },
];
