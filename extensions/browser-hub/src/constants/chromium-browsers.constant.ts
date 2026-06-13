import GLib from "gi://GLib";
import { BrowserType } from "./browser-type.enum";
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
    command: "google-chrome",
  },
  {
    type: BrowserType.Chromium,
    label: "Google Chrome (flatpak)",
    path: HOME_DIR + "/.var/app/com.google.Chrome/.config/google-chrome/Local State",
    command: "flatpak run com.google.Chrome",
  },

  // === Chromium ===
  {
    type: BrowserType.Chromium,
    label: "Chromium",
    path: CONFIG_DIR + "/chromium/Local State",
    command: "chromium",
  },
  {
    type: BrowserType.Chromium,
    label: "Chromium (flatpak)",
    path: HOME_DIR + "/.var/app/org.chromium.Chromium/.config/chromium/Local State",
    command: "flatpak run org.chromium.Chromium",
  },

  // === Brave ===
  {
    type: BrowserType.Chromium,
    label: "Brave",
    path: CONFIG_DIR + "/BraveSoftware/Brave-Browser/Local State",
    command: "brave-browser",
  },
  {
    type: BrowserType.Chromium,
    label: "Brave (flatpak)",
    path: HOME_DIR + "/.var/app/com.brave.Browser/.config/BraveSoftware/Brave-Browser/Local State",
    command: "flatpak run com.brave.Browser",
  },

  // === Microsoft Edge ===
  {
    type: BrowserType.Chromium,
    label: "Microsoft Edge",
    path: CONFIG_DIR + "/microsoft-edge/Local State",
    command: "microsoft-edge",
  },
  {
    type: BrowserType.Chromium,
    label: "Microsoft Edge (flatpak)",
    path: HOME_DIR + "/.var/app/com.microsoft.Edge/.config/microsoft-edge/Local State",
    command: "flatpak run com.microsoft.Edge",
  },

  // === Vivaldi ===
  {
    type: BrowserType.Chromium,
    label: "Vivaldi",
    path: CONFIG_DIR + "/vivaldi/Local State",
    command: "vivaldi",
  },
  {
    type: BrowserType.Chromium,
    label: "Vivaldi (flatpak)",
    path: HOME_DIR + "/.var/app/com.vivaldi.Vivaldi/.config/vivaldi/Local State",
    command: "flatpak run com.vivaldi.Vivaldi",
  },

  // === Opera ===
  {
    type: BrowserType.Chromium,
    label: "Opera",
    path: CONFIG_DIR + "/opera/Local State",
    command: "opera",
  },
  {
    type: BrowserType.Chromium,
    label: "Opera (flatpak)",
    path: HOME_DIR + "/.var/app/com.opera.Opera/.config/opera/Local State",
    command: "flatpak run com.opera.Opera",
  },

  // === Thorium ===
  {
    type: BrowserType.Chromium,
    label: "Thorium",
    path: CONFIG_DIR + "/thorium/Local State",
    command: "thorium-browser",
  },
];
