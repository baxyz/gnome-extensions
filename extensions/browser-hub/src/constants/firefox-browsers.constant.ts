import { BrowserType, PackageManager, SpaceType } from "../taxonomy";
import type { FirefoxBrowserConfig } from "../taxonomy";
import { HOME_DIR, XDG_CONFIG_HOME, snapCommonDir, snapDataDir } from "./paths.constant";

/**
 * The usual Firefox-family paths: XDG, classic (~/.<name>), Flatpak and
 * Snap. "(classic)" is only added when there is also an XDG entry.
 */
function expandFirefoxVariants(v: {
  label: string;
  spaceType?: SpaceType;
  binary?: string | string[];
  /** Relative to XDG_CONFIG_HOME. */
  xdg?: string;
  /** Relative to HOME_DIR, and to the Flatpak's home. */
  classic?: string;
  flatpakId?: string;
  /** Relative to the Flatpak's config dir (~/.var/app/<id>/config). */
  flatpakConfig?: string;
  /**
   * Relative to the snap's data dir. `commonDir` uses ~/snap/<name>/common,
   * which doesn't change between revisions (Firefox keeps its profile there).
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
  if (v.flatpakId && v.flatpakConfig) {
    configs.push({
      ...common,
      label: `${v.label} (flatpak)`,
      path: `${HOME_DIR}/.var/app/${v.flatpakId}/config/${v.flatpakConfig}`,
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

  // No XDG support. Same profile dir as Firefox, different binary.
  ...expandFirefoxVariants({
    label: "Firefox ESR",
    classic: ".mozilla/firefox/profiles.ini",
    binary: "firefox-esr",
  }),

  ...expandFirefoxVariants({
    label: "Waterfox",
    xdg: "waterfox/profiles.ini",
    classic: ".waterfox/profiles.ini",
    flatpakId: "net.waterfox.waterfox",
    binary: "waterfox",
  }),

  ...expandFirefoxVariants({
    label: "LibreWolf",
    // Nested librewolf/librewolf, unlike Firefox's mozilla/firefox.
    xdg: "librewolf/librewolf/profiles.ini",
    classic: ".librewolf/profiles.ini",
    flatpakId: "io.gitlab.librewolf-community",
    flatpakConfig: "librewolf/librewolf/profiles.ini",
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
    // Community snap, named "zen-browser-snap".
    snap: { name: "zen-browser-snap", relativePath: ".zen/profiles.ini" },
  }),

  // Garuda Linux. XDG support added in v13, classic path covers pre-v13.
  ...expandFirefoxVariants({
    label: "Firedragon",
    xdg: "firedragon/profiles.ini",
    classic: ".firedragon/profiles.ini",
    binary: "firedragon",
    flatpakId: "org.garudalinux.firedragon",
  }),

  // Based on Firefox ESR, no XDG support yet.
  {
    type: BrowserType.Firefox,
    label: "IceCat (classic)",
    path: HOME_DIR + "/.icecat/profiles.ini",
    pkg: { manager: PackageManager.Native, binary: "icecat" },
  },
  // From Fedora's flatpak remote. Its profile is in the real ~/.mozilla/icecat.
  {
    type: BrowserType.Firefox,
    label: "IceCat (flatpak)",
    path: HOME_DIR + "/.mozilla/icecat/profiles.ini",
    pkg: { manager: PackageManager.Flatpak, appId: "org.gnu.icecat" },
  },

  // Moonchild Productions, Goanna engine.
  {
    type: BrowserType.Firefox,
    label: "Palemoon",
    path: HOME_DIR + "/.moonchild productions/pale moon/profiles.ini",
    pkg: { manager: PackageManager.Native, binary: "palemoon" },
  },

  // Moonchild Productions, Goanna engine. Uses ~/.basilisk-dev.
  {
    type: BrowserType.Firefox,
    label: "Basilisk",
    path: HOME_DIR + "/.basilisk-dev/profiles.ini",
    pkg: { manager: PackageManager.Native, binary: "basilisk" },
  },
];
