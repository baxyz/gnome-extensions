import GLib from "gi://GLib";
import { BrowserType, PackageManager } from "../types";
import type { ChromiumBrowserConfig } from "../types";

const HOME_DIR = GLib.get_home_dir();

// Chromium-based browsers do not honor $XDG_CONFIG_HOME — they hardcode ~/.config.
const CONFIG_DIR = HOME_DIR + "/.config";

export const CHROMIUM_BROWSERS: ChromiumBrowserConfig[] = [
  // === Google Chrome ===
  {
    type: BrowserType.Chromium,
    label: "Google Chrome",
    path: CONFIG_DIR + "/google-chrome/Local State",
    pkg: { manager: PackageManager.Native, binary: "google-chrome" },
  },
  {
    type: BrowserType.Chromium,
    label: "Google Chrome (flatpak)",
    path: HOME_DIR + "/.var/app/com.google.Chrome/.config/google-chrome/Local State",
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
    path: HOME_DIR + "/.var/app/org.chromium.Chromium/.config/chromium/Local State",
    pkg: { manager: PackageManager.Flatpak, appId: "org.chromium.Chromium" },
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
    path: HOME_DIR + "/.var/app/com.brave.Browser/.config/BraveSoftware/Brave-Browser/Local State",
    pkg: { manager: PackageManager.Flatpak, appId: "com.brave.Browser" },
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
    path: HOME_DIR + "/.var/app/com.microsoft.Edge/.config/microsoft-edge/Local State",
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
    path: HOME_DIR + "/.var/app/com.vivaldi.Vivaldi/.config/vivaldi/Local State",
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
    path: HOME_DIR + "/.var/app/com.opera.Opera/.config/opera/Local State",
    pkg: { manager: PackageManager.Flatpak, appId: "com.opera.Opera" },
  },

  // === Thorium ===
  {
    type: BrowserType.Chromium,
    label: "Thorium",
    path: CONFIG_DIR + "/thorium/Local State",
    pkg: { manager: PackageManager.Native, binary: "thorium-browser" },
  },
];
