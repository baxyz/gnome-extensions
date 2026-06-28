import { BrowserType, PackageManager } from "../types";
import type { ChromiumBrowserConfig } from "../types";
import { HOME_DIR } from "./paths.constant";

// Chromium-based browsers do not honor $XDG_CONFIG_HOME — they hardcode ~/.config.
const CONFIG_DIR = HOME_DIR + "/.config";

export const CHROMIUM_BROWSERS: ChromiumBrowserConfig[] = [
  // === Google Chrome ===
  {
    type: BrowserType.Chromium,
    label: "Google Chrome",
    path: CONFIG_DIR + "/google-chrome/Local State",
    pkg: { manager: PackageManager.Native, binary: ["google-chrome", "google-chrome-stable"] },
  },
  {
    type: BrowserType.Chromium,
    label: "Google Chrome (flatpak)",
    path: HOME_DIR + "/.var/app/com.google.Chrome/config/google-chrome/Local State",
    pkg: { manager: PackageManager.Flatpak, appId: "com.google.Chrome" },
  },

  // === Chromium ===
  {
    type: BrowserType.Chromium,
    label: "Chromium",
    path: CONFIG_DIR + "/chromium/Local State",
    pkg: { manager: PackageManager.Native, binary: ["chromium", "chromium-browser"] },
  },
  {
    type: BrowserType.Chromium,
    label: "Chromium (flatpak)",
    path: HOME_DIR + "/.var/app/org.chromium.Chromium/config/chromium/Local State",
    pkg: { manager: PackageManager.Flatpak, appId: "org.chromium.Chromium" },
  },

  // === Ungoogled Chromium ===
  // Native binary is 'chromium', sharing ~/.config/chromium/ with stock Chromium — indistinguishable.
  // Only the Flatpak ID reliably differentiates it.
  {
    type: BrowserType.Chromium,
    label: "Ungoogled Chromium (flatpak)",
    path: HOME_DIR + "/.var/app/com.github.Eloston.UngoogledChromium/config/chromium/Local State",
    pkg: { manager: PackageManager.Flatpak, appId: "com.github.Eloston.UngoogledChromium" },
  },

  // === Brave ===
  {
    type: BrowserType.Chromium,
    label: "Brave",
    path: CONFIG_DIR + "/BraveSoftware/Brave-Browser/Local State",
    pkg: { manager: PackageManager.Native, binary: "brave-browser" },
  },
  {
    type: BrowserType.Chromium,
    label: "Brave (flatpak)",
    path: HOME_DIR + "/.var/app/com.brave.Browser/config/BraveSoftware/Brave-Browser/Local State",
    pkg: { manager: PackageManager.Flatpak, appId: "com.brave.Browser" },
  },

  // === Brave Origin ===
  {
    type: BrowserType.Chromium,
    label: "Brave Origin",
    path: CONFIG_DIR + "/BraveSoftware/Brave-Origin/Local State",
    pkg: { manager: PackageManager.Native, binary: "brave-origin" },
  },
  {
    type: BrowserType.Chromium,
    label: "Brave Origin Beta",
    path: CONFIG_DIR + "/BraveSoftware/Brave-Origin-Beta/Local State",
    pkg: { manager: PackageManager.Native, binary: "brave-origin-beta" },
  },

  // === Microsoft Edge ===
  {
    type: BrowserType.Chromium,
    label: "Microsoft Edge",
    path: CONFIG_DIR + "/microsoft-edge/Local State",
    pkg: { manager: PackageManager.Native, binary: "microsoft-edge" },
  },
  {
    type: BrowserType.Chromium,
    label: "Microsoft Edge (flatpak)",
    path: HOME_DIR + "/.var/app/com.microsoft.Edge/config/microsoft-edge/Local State",
    pkg: { manager: PackageManager.Flatpak, appId: "com.microsoft.Edge" },
  },

  // === Vivaldi ===
  {
    type: BrowserType.Chromium,
    label: "Vivaldi",
    path: CONFIG_DIR + "/vivaldi/Local State",
    pkg: { manager: PackageManager.Native, binary: "vivaldi" },
  },
  {
    type: BrowserType.Chromium,
    label: "Vivaldi (flatpak)",
    path: HOME_DIR + "/.var/app/com.vivaldi.Vivaldi/config/vivaldi/Local State",
    pkg: { manager: PackageManager.Flatpak, appId: "com.vivaldi.Vivaldi" },
  },

  // === Opera ===
  {
    type: BrowserType.Chromium,
    label: "Opera",
    path: CONFIG_DIR + "/opera/Local State",
    pkg: { manager: PackageManager.Native, binary: "opera" },
  },
  {
    type: BrowserType.Chromium,
    label: "Opera (flatpak)",
    path: HOME_DIR + "/.var/app/com.opera.Opera/config/opera/Local State",
    pkg: { manager: PackageManager.Flatpak, appId: "com.opera.Opera" },
  },

  // === Opera GX ===
  // Linux support added March 2026.
  {
    type: BrowserType.Chromium,
    label: "Opera GX",
    path: CONFIG_DIR + "/opera-gx/Local State",
    pkg: { manager: PackageManager.Native, binary: "opera-gx" },
  },
  {
    type: BrowserType.Chromium,
    label: "Opera GX (flatpak)",
    path: HOME_DIR + "/.var/app/com.opera.opera-gx/config/opera-gx/Local State",
    pkg: { manager: PackageManager.Flatpak, appId: "com.opera.opera-gx" },
  },
  {
    type: BrowserType.Chromium,
    label: "Opera GX (snap)",
    path: HOME_DIR + "/snap/opera-gx/common/.config/opera-gx/Local State",
    pkg: { manager: PackageManager.Snap, name: "opera-gx" },
  },

  // === Iridium Browser ===
  // Distributed via iridiumbrowser.de's own repo; no flatpak.
  {
    type: BrowserType.Chromium,
    label: "Iridium",
    path: CONFIG_DIR + "/iridium/Local State",
    pkg: { manager: PackageManager.Native, binary: "iridium-browser" },
  },

  // === SRWare Iron ===
  // Distributed as direct download from srware.net; no flatpak.
  {
    type: BrowserType.Chromium,
    label: "SRWare Iron",
    path: CONFIG_DIR + "/iron/Local State",
    pkg: { manager: PackageManager.Native, binary: "iron" },
  },

  // === Slimjet ===
  // Distributed as direct download from slimjet.com; no flatpak.
  {
    type: BrowserType.Chromium,
    label: "Slimjet",
    path: CONFIG_DIR + "/slimjet/Local State",
    pkg: { manager: PackageManager.Native, binary: "flashpeak-slimjet" },
  },

  // === Thorium ===
  {
    type: BrowserType.Chromium,
    label: "Thorium",
    path: CONFIG_DIR + "/thorium/Local State",
    pkg: { manager: PackageManager.Native, binary: "thorium-browser" },
  },
];
