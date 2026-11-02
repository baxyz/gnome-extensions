import { BrowserType, PackageManager } from "../taxonomy";
import type { SimpleBrowserConfig } from "../taxonomy";

export const SIMPLE_BROWSERS: SimpleBrowserConfig[] = [
  // === GNOME Web (Epiphany) ===
  {
    type: BrowserType.Simple,
    label: "GNOME Web",
    // The desktop file doesn't follow the binary name.
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
  {
    type: BrowserType.Simple,
    label: "GNOME Web (snap)",
    pkg: { manager: PackageManager.Snap, name: "epiphany" },
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
  // Last published 2019.
  {
    type: BrowserType.Simple,
    label: "Midori (snap)",
    pkg: { manager: PackageManager.Snap, name: "midori" },
  },

  // === Konqueror (KDE) ===
  {
    type: BrowserType.Simple,
    label: "Konqueror",
    pkg: { manager: PackageManager.Native, binary: "konqueror" },
  },
  {
    type: BrowserType.Simple,
    label: "Konqueror (snap)",
    pkg: { manager: PackageManager.Snap, name: "konqueror" },
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

  // === Angelfish (KDE mobile browser, QtWebEngine) ===
  {
    type: BrowserType.Simple,
    label: "Angelfish",
    pkg: {
      manager: PackageManager.Native,
      binary: "angelfish",
      desktopId: "org.kde.angelfish.desktop",
    },
  },
  {
    type: BrowserType.Simple,
    label: "Angelfish (flatpak)",
    pkg: { manager: PackageManager.Flatpak, appId: "org.kde.angelfish" },
  },
  {
    type: BrowserType.Simple,
    label: "Angelfish (snap)",
    pkg: { manager: PackageManager.Snap, name: "angelfish" },
  },

  // === Vieb (Vim-Inspired Electron Browser) ===
  // One profile in ~/.config/Vieb, not Chromium's Local State.
  {
    type: BrowserType.Simple,
    label: "Vieb",
    pkg: { manager: PackageManager.Native, binary: "vieb" },
  },
  {
    type: BrowserType.Simple,
    label: "Vieb (flatpak)",
    pkg: { manager: PackageManager.Flatpak, appId: "dev.vieb.Vieb" },
  },

  // === Flow Browser (Electron + Chromium, Arc/Zen-inspired) ===
  // Same as Vieb.
  {
    type: BrowserType.Simple,
    label: "Flow Browser",
    pkg: { manager: PackageManager.Flatpak, appId: "com.flow_browser.flow" },
  },

  // === Viper Browser (Qt5/QtWebEngine) ===
  {
    type: BrowserType.Simple,
    label: "Viper Browser",
    pkg: { manager: PackageManager.Snap, name: "viper-browser" },
  },

  // === Colibri ("browser without tabs", Chromium-based, proprietary) ===
  {
    type: BrowserType.Simple,
    label: "Colibri",
    pkg: { manager: PackageManager.Snap, name: "colibri" },
  },

  // === Geryon Browser (QtWebEngine, privacy-focused) ===
  {
    type: BrowserType.Simple,
    label: "Geryon Browser",
    pkg: { manager: PackageManager.Snap, name: "geryon-browser" },
  },

  // === Skye (by Innatical) ===
  {
    type: BrowserType.Simple,
    label: "Skye",
    pkg: { manager: PackageManager.Snap, name: "skye" },
  },

  // === NCSA Mosaic (historical revival) ===
  {
    type: BrowserType.Simple,
    label: "NCSA Mosaic",
    pkg: { manager: PackageManager.Snap, name: "mosaic" },
  },

  // === Chameleon (Zac Browser) ===
  // ZAC Browser shut down 2026-04-02.
  {
    type: BrowserType.Simple,
    label: "Chameleon (Zac Browser)",
    pkg: { manager: PackageManager.Snap, name: "chameleon" },
  },

  // === Pocket Browser (Chromium-based, privacy-focused) ===
  {
    type: BrowserType.Simple,
    label: "Pocket Browser",
    pkg: { manager: PackageManager.Snap, name: "pocket-browser" },
  },

  // === Beaker Browser (P2P/Dat protocol) ===
  // Discontinued 2022.
  {
    type: BrowserType.Simple,
    label: "Beaker Browser",
    pkg: { manager: PackageManager.Snap, name: "beaker-browser" },
  },

  // === Links (Twibright Labs) ===
  // Not Links2 nor ELinks.
  {
    type: BrowserType.Simple,
    label: "Links (snap)",
    pkg: { manager: PackageManager.Snap, name: "links" },
  },

  // === Orion Browser (Kagi, WebKit) ===
  // From Kagi's own flatpak remote, which ships both app ids. No profiles
  // on Linux yet.
  {
    type: BrowserType.Simple,
    label: "Orion Browser",
    pkg: { manager: PackageManager.Flatpak, appId: "com.kagi.Orion" },
  },
  {
    type: BrowserType.Simple,
    label: "Orion Browser (GTK)",
    pkg: { manager: PackageManager.Flatpak, appId: "com.kagi.OrionGtk" },
  },

  // === Tor Browser ===
  // torbrowser-launcher takes no profile argument.
  {
    type: BrowserType.Simple,
    label: "Tor Browser",
    pkg: { manager: PackageManager.Native, binary: "torbrowser-launcher" },
  },
  {
    type: BrowserType.Simple,
    label: "Tor Browser (flatpak)",
    pkg: { manager: PackageManager.Flatpak, appId: "org.torproject.torbrowser-launcher" },
  },
];
