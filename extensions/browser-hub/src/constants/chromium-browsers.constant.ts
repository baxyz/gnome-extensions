import { BrowserType, PackageManager } from "../taxonomy";
import type { ChromiumBrowserConfig } from "../taxonomy";
import { HOME_DIR } from "./paths.constant";

// Chromium-based browsers do not honor $XDG_CONFIG_HOME — they hardcode ~/.config.
const CONFIG_DIR = HOME_DIR + "/.config";

// Best-guess "-symbolic" icon name(s) per real browser identity, shared across
// its native/flatpak/snap packaging variants below. Unverified — wrong guesses
// are harmless, resolveBrowserIcon() only uses a name the user's actual icon
// theme provides and shows nothing otherwise.
const GOOGLE_CHROME_ICON = "google-chrome-symbolic";
const CHROMIUM_ICON = "chromium-symbolic";
const BRAVE_ICON = "brave-browser-symbolic";
const MICROSOFT_EDGE_ICON = "microsoft-edge-symbolic";
const VIVALDI_ICON = "vivaldi-symbolic";
const OPERA_ICON = "opera-symbolic";
const OPERA_GX_ICON = ["opera-gx-symbolic", OPERA_ICON];
const IRIDIUM_ICON = "iridium-symbolic";
const SRWARE_IRON_ICON = "iron-symbolic";
const SLIMJET_ICON = "slimjet-symbolic";
const THORIUM_ICON = "thorium-symbolic";

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
  icon?: string | string[];
  /** Config dir name, e.g. "chromium" or "BraveSoftware/Brave-Browser". */
  dirName: string;
  /** Native binary name(s). Omit when this identity has no distinct native binary (e.g. Ungoogled Chromium). */
  binary?: string | string[];
  flatpakId?: string;
  snap?: { name: string; subdir: "current" | "common" };
}): ChromiumBrowserConfig[] {
  const configs: ChromiumBrowserConfig[] = [];
  const common = { type: BrowserType.Chromium as const, ...(v.icon != null && { icon: v.icon }) };
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
      path: `${HOME_DIR}/snap/${v.snap.name}/${v.snap.subdir}/.config/${v.dirName}/Local State`,
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
    icon: GOOGLE_CHROME_ICON,
  }),
  ...expandChromiumVariants({
    label: "Chromium",
    dirName: "chromium",
    binary: ["chromium", "chromium-browser"],
    flatpakId: "org.chromium.Chromium",
    snap: { name: "chromium", subdir: "current" },
    icon: CHROMIUM_ICON,
  }),
  // Native binary is 'chromium', sharing ~/.config/chromium/ with stock Chromium — indistinguishable.
  // Only the Flatpak ID reliably differentiates it.
  ...expandChromiumVariants({
    label: "Ungoogled Chromium",
    dirName: "chromium",
    flatpakId: "com.github.Eloston.UngoogledChromium",
    icon: CHROMIUM_ICON,
  }),
  ...expandChromiumVariants({
    label: "Brave",
    dirName: "BraveSoftware/Brave-Browser",
    binary: "brave-browser",
    flatpakId: "com.brave.Browser",
    snap: { name: "brave", subdir: "current" },
    icon: BRAVE_ICON,
  }),
  ...expandChromiumVariants({
    label: "Brave Origin",
    dirName: "BraveSoftware/Brave-Origin",
    binary: "brave-origin",
    icon: BRAVE_ICON,
  }),
  ...expandChromiumVariants({
    label: "Brave Origin Beta",
    dirName: "BraveSoftware/Brave-Origin-Beta",
    binary: "brave-origin-beta",
    icon: BRAVE_ICON,
  }),
  ...expandChromiumVariants({
    label: "Microsoft Edge",
    dirName: "microsoft-edge",
    binary: "microsoft-edge",
    flatpakId: "com.microsoft.Edge",
    icon: MICROSOFT_EDGE_ICON,
  }),
  ...expandChromiumVariants({
    label: "Vivaldi",
    dirName: "vivaldi",
    binary: "vivaldi",
    flatpakId: "com.vivaldi.Vivaldi",
    icon: VIVALDI_ICON,
  }),
  ...expandChromiumVariants({
    label: "Opera",
    dirName: "opera",
    binary: "opera",
    flatpakId: "com.opera.Opera",
    // Path pattern unverified against a real install — please confirm with
    // the diagnostic commands and correct if it doesn't match.
    snap: { name: "opera", subdir: "common" },
    icon: OPERA_ICON,
  }),
  // Linux support added March 2026.
  ...expandChromiumVariants({
    label: "Opera GX",
    dirName: "opera-gx",
    binary: "opera-gx",
    flatpakId: "com.opera.opera-gx",
    snap: { name: "opera-gx", subdir: "common" },
    icon: OPERA_GX_ICON,
  }),
  // Distributed via iridiumbrowser.de's own repo; no flatpak.
  ...expandChromiumVariants({
    label: "Iridium",
    dirName: "iridium",
    binary: "iridium-browser",
    icon: IRIDIUM_ICON,
  }),
  // Distributed as direct download from srware.net; no flatpak.
  ...expandChromiumVariants({
    label: "SRWare Iron",
    dirName: "iron",
    binary: "iron",
    icon: SRWARE_IRON_ICON,
  }),
  // Distributed as direct download from slimjet.com; no flatpak.
  ...expandChromiumVariants({
    label: "Slimjet",
    dirName: "slimjet",
    binary: "flashpeak-slimjet",
    icon: SLIMJET_ICON,
  }),
  ...expandChromiumVariants({
    label: "Thorium",
    dirName: "thorium",
    binary: "thorium-browser",
    icon: THORIUM_ICON,
  }),
];
