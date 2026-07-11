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

export function getDefaultBrowser(): DefaultBrowserInfo | null {
  const appInfo = Gio.AppInfo.get_default_for_uri_scheme("http");
  if (!appInfo) return null;
  const name = appInfo.get_name();
  const desktopId = appInfo.get_id();
  const executable = appInfo.get_executable();
  if (!name || !desktopId || !executable) return null;
  const command = buildBaseCommand(detectPkg(desktopId, executable));
  return { name, command };
}
