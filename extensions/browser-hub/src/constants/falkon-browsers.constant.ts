import { BrowserType, PackageManager } from "../types";
import type { FalkonBrowserConfig } from "../types";
import { HOME_DIR, XDG_CONFIG_HOME } from "./paths.constant";

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
    path: HOME_DIR + "/.var/app/org.kde.falkon/config/falkon/profiles/",
    pkg: { manager: PackageManager.Flatpak, appId: "org.kde.falkon" },
  },
];
