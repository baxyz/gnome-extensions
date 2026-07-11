import { BrowserType, PackageManager } from "../taxonomy";
import type { SimpleBrowserConfig } from "../taxonomy";

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

  // === Luakit ===
  {
    type: BrowserType.Simple,
    label: "Luakit",
    icon: "luakit",
    pkg: { manager: PackageManager.Native, binary: "luakit" },
  },

  // === Nyxt ===
  {
    type: BrowserType.Simple,
    label: "Nyxt",
    icon: "engineer.atlas.Nyxt",
    pkg: { manager: PackageManager.Native, binary: "nyxt" },
  },
  {
    type: BrowserType.Simple,
    label: "Nyxt (flatpak)",
    icon: "engineer.atlas.Nyxt",
    pkg: { manager: PackageManager.Flatpak, appId: "engineer.atlas.Nyxt" },
  },

  // === Otter Browser ===
  {
    type: BrowserType.Simple,
    label: "Otter Browser",
    icon: "org.otter_browser.OtterBrowser",
    pkg: { manager: PackageManager.Native, binary: "otter-browser" },
  },
  {
    type: BrowserType.Simple,
    label: "Otter Browser (flatpak)",
    icon: "org.otter_browser.OtterBrowser",
    pkg: { manager: PackageManager.Flatpak, appId: "org.otter_browser.OtterBrowser" },
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

  // === NetSurf ===
  {
    type: BrowserType.Simple,
    label: "NetSurf",
    icon: "org.netsurf_browser.NetSurf",
    pkg: { manager: PackageManager.Native, binary: "netsurf-gtk3" },
  },
  {
    type: BrowserType.Simple,
    label: "NetSurf (flatpak)",
    icon: "org.netsurf_browser.NetSurf",
    pkg: { manager: PackageManager.Flatpak, appId: "org.netsurf_browser.NetSurf" },
  },

  // === Dillo ===
  {
    type: BrowserType.Simple,
    label: "Dillo",
    icon: "dillo",
    pkg: { manager: PackageManager.Native, binary: "dillo" },
  },

  // === Links2 ===
  {
    type: BrowserType.Simple,
    label: "Links2",
    pkg: { manager: PackageManager.Native, binary: "links2" },
  },

  // === ELinks ===
  {
    type: BrowserType.Simple,
    label: "ELinks",
    pkg: { manager: PackageManager.Native, binary: "elinks" },
  },

  // === w3m ===
  {
    type: BrowserType.Simple,
    label: "w3m",
    pkg: { manager: PackageManager.Native, binary: "w3m" },
  },
];
