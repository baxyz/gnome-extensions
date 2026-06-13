import { BrowserType, PackageManager } from "../types";
import type { SimpleBrowserConfig } from "../types";

export const SIMPLE_BROWSERS: SimpleBrowserConfig[] = [
  // === GNOME Web (Epiphany) ===
  {
    type: BrowserType.Simple,
    label: "GNOME Web",
    pkg: { manager: PackageManager.Native, binary: "epiphany" },
  },
  {
    type: BrowserType.Simple,
    label: "GNOME Web (flatpak)",
    pkg: { manager: PackageManager.Flatpak, appId: "org.gnome.Epiphany" },
  },

  // === qutebrowser ===
  {
    type: BrowserType.Simple,
    label: "qutebrowser",
    pkg: { manager: PackageManager.Native, binary: "qutebrowser" },
  },

  // === Midori ===
  {
    type: BrowserType.Simple,
    label: "Midori",
    pkg: { manager: PackageManager.Native, binary: "midori" },
  },

  // === Konqueror (KDE) ===
  {
    type: BrowserType.Simple,
    label: "Konqueror",
    pkg: { manager: PackageManager.Native, binary: "konqueror" },
  },
];
