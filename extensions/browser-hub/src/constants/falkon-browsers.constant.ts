import { BrowserType, PackageManager } from "../taxonomy";
import type { FalkonBrowserConfig } from "../taxonomy";
import { HOME_DIR, XDG_CONFIG_HOME } from "./paths.constant";

// Best-guess "-symbolic" icon name — unverified, see FIREFOX_BROWSERS for rationale.
const FALKON_ICON = "falkon-symbolic";

export const FALKON_BROWSERS: FalkonBrowserConfig[] = [
  {
    type: BrowserType.Falkon,
    label: "Falkon",
    path: XDG_CONFIG_HOME + "/falkon/profiles/",
    pkg: { manager: PackageManager.Native, binary: "falkon" },
    icon: FALKON_ICON,
  },
  {
    type: BrowserType.Falkon,
    label: "Falkon (flatpak)",
    path: HOME_DIR + "/.var/app/org.kde.falkon/config/falkon/profiles/",
    pkg: { manager: PackageManager.Flatpak, appId: "org.kde.falkon" },
    icon: FALKON_ICON,
  },
];
