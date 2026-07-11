import { BrowserType, PackageManager } from "../types";
import type { ChromiumBrowserConfig } from "../types";
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

export const CHROMIUM_BROWSERS: ChromiumBrowserConfig[] = [
  // === Google Chrome ===
  {
    type: BrowserType.Chromium,
    label: "Google Chrome",
    path: CONFIG_DIR + "/google-chrome/Local State",
    pkg: { manager: PackageManager.Native, binary: ["google-chrome", "google-chrome-stable"] },
    icon: GOOGLE_CHROME_ICON,
  },
  {
    type: BrowserType.Chromium,
    label: "Google Chrome (flatpak)",
    path: HOME_DIR + "/.var/app/com.google.Chrome/config/google-chrome/Local State",
    pkg: { manager: PackageManager.Flatpak, appId: "com.google.Chrome" },
    icon: GOOGLE_CHROME_ICON,
  },

  // === Chromium ===
  {
    type: BrowserType.Chromium,
    label: "Chromium",
    path: CONFIG_DIR + "/chromium/Local State",
    pkg: { manager: PackageManager.Native, binary: ["chromium", "chromium-browser"] },
    icon: CHROMIUM_ICON,
  },
  {
    type: BrowserType.Chromium,
    label: "Chromium (flatpak)",
    path: HOME_DIR + "/.var/app/org.chromium.Chromium/config/chromium/Local State",
    pkg: { manager: PackageManager.Flatpak, appId: "org.chromium.Chromium" },
    icon: CHROMIUM_ICON,
  },

  // === Ungoogled Chromium ===
  // Native binary is 'chromium', sharing ~/.config/chromium/ with stock Chromium — indistinguishable.
  // Only the Flatpak ID reliably differentiates it.
  {
    type: BrowserType.Chromium,
    label: "Ungoogled Chromium (flatpak)",
    path: HOME_DIR + "/.var/app/com.github.Eloston.UngoogledChromium/config/chromium/Local State",
    pkg: { manager: PackageManager.Flatpak, appId: "com.github.Eloston.UngoogledChromium" },
    icon: CHROMIUM_ICON,
  },
  {
    type: BrowserType.Chromium,
    label: "Chromium (snap)",
    path: HOME_DIR + "/snap/chromium/current/.config/chromium/Local State",
    pkg: { manager: PackageManager.Snap, name: "chromium" },
    icon: CHROMIUM_ICON,
  },

  // === Brave ===
  {
    type: BrowserType.Chromium,
    label: "Brave",
    path: CONFIG_DIR + "/BraveSoftware/Brave-Browser/Local State",
    pkg: { manager: PackageManager.Native, binary: "brave-browser" },
    icon: BRAVE_ICON,
  },
  {
    type: BrowserType.Chromium,
    label: "Brave (flatpak)",
    path: HOME_DIR + "/.var/app/com.brave.Browser/config/BraveSoftware/Brave-Browser/Local State",
    pkg: { manager: PackageManager.Flatpak, appId: "com.brave.Browser" },
    icon: BRAVE_ICON,
  },
  {
    type: BrowserType.Chromium,
    label: "Brave (snap)",
    path: HOME_DIR + "/snap/brave/current/.config/BraveSoftware/Brave-Browser/Local State",
    pkg: { manager: PackageManager.Snap, name: "brave" },
    icon: BRAVE_ICON,
  },

  // === Brave Origin ===
  {
    type: BrowserType.Chromium,
    label: "Brave Origin",
    path: CONFIG_DIR + "/BraveSoftware/Brave-Origin/Local State",
    pkg: { manager: PackageManager.Native, binary: "brave-origin" },
    icon: BRAVE_ICON,
  },
  {
    type: BrowserType.Chromium,
    label: "Brave Origin Beta",
    path: CONFIG_DIR + "/BraveSoftware/Brave-Origin-Beta/Local State",
    pkg: { manager: PackageManager.Native, binary: "brave-origin-beta" },
    icon: BRAVE_ICON,
  },

  // === Microsoft Edge ===
  {
    type: BrowserType.Chromium,
    label: "Microsoft Edge",
    path: CONFIG_DIR + "/microsoft-edge/Local State",
    pkg: { manager: PackageManager.Native, binary: "microsoft-edge" },
    icon: MICROSOFT_EDGE_ICON,
  },
  {
    type: BrowserType.Chromium,
    label: "Microsoft Edge (flatpak)",
    path: HOME_DIR + "/.var/app/com.microsoft.Edge/config/microsoft-edge/Local State",
    pkg: { manager: PackageManager.Flatpak, appId: "com.microsoft.Edge" },
    icon: MICROSOFT_EDGE_ICON,
  },

  // === Vivaldi ===
  {
    type: BrowserType.Chromium,
    label: "Vivaldi",
    path: CONFIG_DIR + "/vivaldi/Local State",
    pkg: { manager: PackageManager.Native, binary: "vivaldi" },
    icon: VIVALDI_ICON,
  },
  {
    type: BrowserType.Chromium,
    label: "Vivaldi (flatpak)",
    path: HOME_DIR + "/.var/app/com.vivaldi.Vivaldi/config/vivaldi/Local State",
    pkg: { manager: PackageManager.Flatpak, appId: "com.vivaldi.Vivaldi" },
    icon: VIVALDI_ICON,
  },

  // === Opera ===
  {
    type: BrowserType.Chromium,
    label: "Opera",
    path: CONFIG_DIR + "/opera/Local State",
    pkg: { manager: PackageManager.Native, binary: "opera" },
    icon: OPERA_ICON,
  },
  {
    type: BrowserType.Chromium,
    label: "Opera (flatpak)",
    path: HOME_DIR + "/.var/app/com.opera.Opera/config/opera/Local State",
    pkg: { manager: PackageManager.Flatpak, appId: "com.opera.Opera" },
    icon: OPERA_ICON,
  },
  {
    // Path pattern mirrors "Opera GX (snap)" below (same publisher/packaging) —
    // unverified against a real install, please confirm with the diagnostic
    // commands and correct if it doesn't match.
    type: BrowserType.Chromium,
    label: "Opera (snap)",
    path: HOME_DIR + "/snap/opera/common/.config/opera/Local State",
    pkg: { manager: PackageManager.Snap, name: "opera" },
    icon: OPERA_ICON,
  },

  // === Opera GX ===
  // Linux support added March 2026.
  {
    type: BrowserType.Chromium,
    label: "Opera GX",
    path: CONFIG_DIR + "/opera-gx/Local State",
    pkg: { manager: PackageManager.Native, binary: "opera-gx" },
    icon: OPERA_GX_ICON,
  },
  {
    type: BrowserType.Chromium,
    label: "Opera GX (flatpak)",
    path: HOME_DIR + "/.var/app/com.opera.opera-gx/config/opera-gx/Local State",
    pkg: { manager: PackageManager.Flatpak, appId: "com.opera.opera-gx" },
    icon: OPERA_GX_ICON,
  },
  {
    type: BrowserType.Chromium,
    label: "Opera GX (snap)",
    path: HOME_DIR + "/snap/opera-gx/common/.config/opera-gx/Local State",
    pkg: { manager: PackageManager.Snap, name: "opera-gx" },
    icon: OPERA_GX_ICON,
  },

  // === Iridium Browser ===
  // Distributed via iridiumbrowser.de's own repo; no flatpak.
  {
    type: BrowserType.Chromium,
    label: "Iridium",
    path: CONFIG_DIR + "/iridium/Local State",
    pkg: { manager: PackageManager.Native, binary: "iridium-browser" },
    icon: IRIDIUM_ICON,
  },

  // === SRWare Iron ===
  // Distributed as direct download from srware.net; no flatpak.
  {
    type: BrowserType.Chromium,
    label: "SRWare Iron",
    path: CONFIG_DIR + "/iron/Local State",
    pkg: { manager: PackageManager.Native, binary: "iron" },
    icon: SRWARE_IRON_ICON,
  },

  // === Slimjet ===
  // Distributed as direct download from slimjet.com; no flatpak.
  {
    type: BrowserType.Chromium,
    label: "Slimjet",
    path: CONFIG_DIR + "/slimjet/Local State",
    pkg: { manager: PackageManager.Native, binary: "flashpeak-slimjet" },
    icon: SLIMJET_ICON,
  },

  // === Thorium ===
  {
    type: BrowserType.Chromium,
    label: "Thorium",
    path: CONFIG_DIR + "/thorium/Local State",
    pkg: { manager: PackageManager.Native, binary: "thorium-browser" },
    icon: THORIUM_ICON,
  },
];
