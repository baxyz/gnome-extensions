import { BrowserType, PackageManager } from "../taxonomy";
import type { SimpleBrowserConfig } from "../taxonomy";

export const SIMPLE_BROWSERS: SimpleBrowserConfig[] = [
  // === GNOME Web (Epiphany) ===
  {
    type: BrowserType.Simple,
    label: "GNOME Web",
    // Desktop file is "org.gnome.Epiphany.desktop" (GNOME's reverse-DNS app
    // id), not "epiphany.desktop" — the binary name doesn't match here.
    pkg: {
      manager: PackageManager.Native,
      binary: "epiphany",
      desktopId: "org.gnome.Epiphany.desktop",
    },
  },
  {
    type: BrowserType.Simple,
    label: "GNOME Web (Flatpak)",
    pkg: { manager: PackageManager.Flatpak, appId: "org.gnome.Epiphany" },
  },

  // === qutebrowser ===
  {
    type: BrowserType.Simple,
    label: "qutebrowser",
    pkg: { manager: PackageManager.Native, binary: "qutebrowser" },
  },

  // === Luakit ===
  {
    type: BrowserType.Simple,
    label: "Luakit",
    pkg: { manager: PackageManager.Native, binary: "luakit" },
  },

  // === Nyxt ===
  {
    type: BrowserType.Simple,
    label: "Nyxt",
    pkg: { manager: PackageManager.Native, binary: "nyxt" },
  },
  {
    type: BrowserType.Simple,
    label: "Nyxt (flatpak)",
    pkg: { manager: PackageManager.Flatpak, appId: "engineer.atlas.Nyxt" },
  },

  // === Otter Browser ===
  {
    type: BrowserType.Simple,
    label: "Otter Browser",
    pkg: { manager: PackageManager.Native, binary: "otter-browser" },
  },
  {
    type: BrowserType.Simple,
    label: "Otter Browser (flatpak)",
    pkg: { manager: PackageManager.Flatpak, appId: "org.otter_browser.OtterBrowser" },
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

  // === NetSurf ===
  {
    type: BrowserType.Simple,
    label: "NetSurf",
    pkg: { manager: PackageManager.Native, binary: "netsurf-gtk3" },
  },
  {
    type: BrowserType.Simple,
    label: "NetSurf (flatpak)",
    pkg: { manager: PackageManager.Flatpak, appId: "org.netsurf_browser.NetSurf" },
  },

  // === Dillo ===
  {
    type: BrowserType.Simple,
    label: "Dillo",
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
