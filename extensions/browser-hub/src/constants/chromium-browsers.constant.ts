import { BrowserType, PackageManager } from "../taxonomy";
import type { ChromiumBrowserConfig } from "../taxonomy";
import { HOME_DIR, snapDataDir } from "./paths.constant";

// Chromium-based browsers do not honor $XDG_CONFIG_HOME — they hardcode ~/.config.
const CONFIG_DIR = HOME_DIR + "/.config";

/**
 * Every Chromium-family browser follows the same three packaging shapes —
 * only the config dir name (under CONFIG_DIR / the Flatpak sandbox's mirrored
 * home / the snap's own home), binary, Flatpak app id, and snap name differ.
 * Native is always unsuffixed; flatpak/snap are always suffixed, whether or
 * not a native variant is also generated (see "Ungoogled Chromium", which has
 * no native entry of its own — its binary is indistinguishable from stock
 * Chromium's — but its flatpak entry still reads "(flatpak)").
 */
function expandChromiumVariants(v: {
  label: string;
  /** Config dir name, e.g. "chromium" or "BraveSoftware/Brave-Browser". */
  dirName: string;
  /** Native binary name(s). Omit when this identity has no distinct native binary (e.g. Ungoogled Chromium). */
  binary?: string | string[];
  flatpakId?: string;
  snap?: { name: string };
}): ChromiumBrowserConfig[] {
  const configs: ChromiumBrowserConfig[] = [];
  const common = { type: BrowserType.Chromium as const };
  if (v.binary) {
    configs.push({
      ...common,
      label: v.label,
      path: `${CONFIG_DIR}/${v.dirName}/Local State`,
      pkg: { manager: PackageManager.Native, binary: v.binary },
    });
  }
  if (v.flatpakId) {
    configs.push({
      ...common,
      label: `${v.label} (flatpak)`,
      path: `${HOME_DIR}/.var/app/${v.flatpakId}/config/${v.dirName}/Local State`,
      pkg: { manager: PackageManager.Flatpak, appId: v.flatpakId },
    });
  }
  if (v.snap) {
    configs.push({
      ...common,
      label: `${v.label} (snap)`,
      path: `${snapDataDir(v.snap.name)}/.config/${v.dirName}/Local State`,
      pkg: { manager: PackageManager.Snap, name: v.snap.name },
    });
  }
  return configs;
}

export const CHROMIUM_BROWSERS: ChromiumBrowserConfig[] = [
  ...expandChromiumVariants({
    label: "Google Chrome",
    dirName: "google-chrome",
    binary: ["google-chrome", "google-chrome-stable"],
    flatpakId: "com.google.Chrome",
  }),
  ...expandChromiumVariants({
    label: "Chromium",
    dirName: "chromium",
    binary: ["chromium", "chromium-browser"],
    flatpakId: "org.chromium.Chromium",
    snap: { name: "chromium" },
  }),
  // Native binary is 'chromium', sharing ~/.config/chromium/ with stock Chromium — indistinguishable.
  // Only the Flatpak ID reliably differentiates it.
  ...expandChromiumVariants({
    label: "Ungoogled Chromium",
    dirName: "chromium",
    flatpakId: "com.github.Eloston.UngoogledChromium",
  }),
  ...expandChromiumVariants({
    label: "Brave",
    dirName: "BraveSoftware/Brave-Browser",
    binary: "brave-browser",
    flatpakId: "com.brave.Browser",
    snap: { name: "brave" },
  }),
  ...expandChromiumVariants({
    label: "Brave Origin",
    dirName: "BraveSoftware/Brave-Origin",
    binary: "brave-origin",
  }),
  ...expandChromiumVariants({
    label: "Brave Origin Beta",
    dirName: "BraveSoftware/Brave-Origin-Beta",
    binary: "brave-origin-beta",
  }),
  ...expandChromiumVariants({
    label: "Microsoft Edge",
    dirName: "microsoft-edge",
    binary: "microsoft-edge",
    flatpakId: "com.microsoft.Edge",
  }),
  ...expandChromiumVariants({
    label: "Vivaldi",
    dirName: "vivaldi",
    binary: "vivaldi",
    flatpakId: "com.vivaldi.Vivaldi",
  }),
  ...expandChromiumVariants({
    label: "Opera",
    dirName: "opera",
    binary: "opera",
    flatpakId: "com.opera.Opera",
    snap: { name: "opera" },
  }),
  // Linux support added March 2026.
  ...expandChromiumVariants({
    label: "Opera GX",
    dirName: "opera-gx",
    binary: "opera-gx",
    flatpakId: "com.opera.opera-gx",
    snap: { name: "opera-gx" },
  }),
  // Distributed via iridiumbrowser.de's own repo; no flatpak.
  ...expandChromiumVariants({ label: "Iridium", dirName: "iridium", binary: "iridium-browser" }),
  // Distributed as direct download from srware.net; no flatpak.
  ...expandChromiumVariants({ label: "SRWare Iron", dirName: "iron", binary: "iron" }),
  // Distributed as direct download from slimjet.com; no flatpak.
  ...expandChromiumVariants({
    label: "Slimjet",
    dirName: "slimjet",
    binary: "flashpeak-slimjet",
  }),
  ...expandChromiumVariants({
    label: "Thorium",
    dirName: "thorium",
    binary: "thorium-browser",
  }),
];
