import GLib from "gi://GLib";
import { BrowserType, PackageManager } from "../types";
import type { FalkonBrowserConfig } from "../types";

const HOME_DIR = GLib.get_home_dir();
const XDG_CONFIG_HOME = GLib.getenv("XDG_CONFIG_HOME") || HOME_DIR + "/.config";

export const FALKON_BROWSERS: FalkonBrowserConfig[] = [
  {
    type: BrowserType.Falkon,
    label: "Falkon",
    path: XDG_CONFIG_HOME + "/falkon/profiles/",
    pkg: { manager: PackageManager.Native, binary: "falkon" },
  },
  {
    type: BrowserType.Falkon,
    label: "Falkon (flatpak)",
    path: HOME_DIR + "/.var/app/org.kde.falkon/.config/falkon/profiles/",
    pkg: { manager: PackageManager.Flatpak, appId: "org.kde.falkon" },
  },
];
