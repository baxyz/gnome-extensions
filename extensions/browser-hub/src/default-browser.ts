import Gio from "gi://Gio";
import { PackageManager } from "./taxonomy";
import type { ResolvedBrowserPkg } from "./taxonomy";
import { buildBaseCommand, getDesktopAppInfo, type DesktopAppInfo } from "./internal";

export type DefaultBrowserInfo = {
  name: string;
  command: string[];
};

function desktopField(info: DesktopAppInfo, key: string): string | null {
  try {
    return info.get_string(key);
  } catch {
    return null;
  }
}

function detectPkg(desktopId: string, executable: string): ResolvedBrowserPkg {
  const info = getDesktopAppInfo(desktopId);
  if (info) {
    const flatpakId = desktopField(info, "X-Flatpak");
    if (flatpakId) return { manager: PackageManager.Flatpak, appId: flatpakId };
    const snapName = desktopField(info, "X-SnapInstanceName");
    if (snapName) return { manager: PackageManager.Snap, name: snapName };
  }
  return { manager: PackageManager.Native, binary: executable };
}

// The OS default-browser association only changes via the "Change default
// browser" button (opens gnome-control-center, external to this process) or
// real system config edits — never as a side effect of any BrowserSettings
// change. Cache it like pkg/icon resolution (see internal/pkg.ts,
// internal/desktop-icon.ts) instead of re-running two syscalls on every
// redraw, including purely cosmetic ones.
let cachedDefaultBrowser: DefaultBrowserInfo | null | undefined;

/** Clears the default browser cache. Called on extension disable and manual refresh. */
export function clearDefaultBrowserCache(): void {
  cachedDefaultBrowser = undefined;
}

export function getDefaultBrowser(): DefaultBrowserInfo | null {
  if (cachedDefaultBrowser !== undefined) return cachedDefaultBrowser;
  const appInfo = Gio.AppInfo.get_default_for_uri_scheme("http");
  const name = appInfo?.get_name();
  const desktopId = appInfo?.get_id();
  const executable = appInfo?.get_executable();
  cachedDefaultBrowser =
    name && desktopId && executable
      ? { name, command: buildBaseCommand(detectPkg(desktopId, executable)) }
      : null;
  return cachedDefaultBrowser;
}
