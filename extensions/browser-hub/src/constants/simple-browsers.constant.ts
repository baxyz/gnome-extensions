import { BrowserType, PackageManager } from "../types";
import type { SimpleBrowserConfig } from "../types";

export const SIMPLE_BROWSERS: SimpleBrowserConfig[] = [
  // === GNOME Web (Epiphany) ===
  {
    type: BrowserType.Simple,
    label: "GNOME Web",
    icon: "org.gnome.Epiphany",
    pkg: { manager: PackageManager.Native, binary: "epiphany" },
  },
  {
    type: BrowserType.Simple,
    label: "GNOME Web (Flatpak)",
    icon: "org.gnome.Epiphany",
    pkg: { manager: PackageManager.Flatpak, appId: "org.gnome.Epiphany" },
  },

  // === qutebrowser ===
  {
    type: BrowserType.Simple,
    label: "qutebrowser",
    icon: "qutebrowser",
    pkg: { manager: PackageManager.Native, binary: "qutebrowser" },
  },

  // === Midori ===
  {
    type: BrowserType.Simple,
    label: "Midori",
    icon: "midori",
    pkg: { manager: PackageManager.Native, binary: "midori" },
  },

  // === Konqueror (KDE) ===
  {
    type: BrowserType.Simple,
    label: "Konqueror",
    icon: "konqueror",
    pkg: { manager: PackageManager.Native, binary: "konqueror" },
  },
];
