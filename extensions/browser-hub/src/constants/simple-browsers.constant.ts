import GLib from "gi://GLib";
import { BrowserType } from "./browser-type.enum";
import type { SimpleBrowserConfig } from "../types";

const HOME_DIR = GLib.get_home_dir();

export const SIMPLE_BROWSERS: SimpleBrowserConfig[] = [
  // === GNOME Web (Epiphany) ===
  {
    type: BrowserType.Simple,
    label: "GNOME Web",
    command: "epiphany",
  },
  {
    type: BrowserType.Simple,
    label: "GNOME Web (flatpak)",
    command: "flatpak run org.gnome.Epiphany",
    checkPath: HOME_DIR + "/.var/app/org.gnome.Epiphany",
  },

  // === qutebrowser ===
  {
    type: BrowserType.Simple,
    label: "qutebrowser",
    command: "qutebrowser",
  },

  // === Midori ===
  {
    type: BrowserType.Simple,
    label: "Midori",
    command: "midori",
  },

  // === Konqueror (KDE) ===
  {
    type: BrowserType.Simple,
    label: "Konqueror",
    command: "konqueror",
  },
];
