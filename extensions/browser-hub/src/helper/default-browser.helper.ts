import Gio from "gi://Gio";
import { PackageManager } from "../types";
import type { ResolvedBrowserPkg } from "../types";
import { buildBaseCommand } from "./internal";

export type DefaultBrowserInfo = {
  name: string;
  command: string;
};

// Gio.DesktopAppInfo is Linux-specific (gio-unix-2.0) — present in GJS but absent from @girs types
type _DesktopInfo = { get_string(key: string): string | null };
const _DesktopAppInfo = (Gio as unknown as {
  DesktopAppInfo: { new: (id: string) => _DesktopInfo | null };
}).DesktopAppInfo;

function desktopField(info: _DesktopInfo, key: string): string | null {
  try {
    return info.get_string(key);
  } catch {
    return null;
  }
}

function detectPkg(desktopId: string, executable: string): ResolvedBrowserPkg {
  const info = _DesktopAppInfo.new(desktopId);
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
