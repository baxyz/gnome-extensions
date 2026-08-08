import Gio from "gi://Gio";
import { guard } from "@helpers4/promise";
import { PackageManager } from "./taxonomy";
import type { ResolvedBrowserPkg } from "./taxonomy";
import { buildBaseCommand, desktopIdFor, getDesktopAppInfo, type DesktopAppInfo } from "./internal";

export type DefaultBrowserInfo = {
  name: string;
  command: string[];
  pkg: ResolvedBrowserPkg;
};

function desktopField(info: DesktopAppInfo, key: string): string | null {
  return guard(() => info.get_string(key), null);
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

// The OS default-browser association only changes via setDefaultBrowser()
// below or real system config edits (gnome-control-center, xdg-settings) —
// never as a side effect of any BrowserSettings change. Cache it like
// pkg/icon resolution (see internal/pkg.ts, internal/desktop-icon.ts)
// instead of re-running two syscalls on every redraw, including purely
// cosmetic ones.
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
  if (name && desktopId && executable) {
    const pkg = detectPkg(desktopId, executable);
    cachedDefaultBrowser = { name, command: buildBaseCommand(pkg), pkg };
  } else {
    cachedDefaultBrowser = null;
  }
  return cachedDefaultBrowser;
}

// The three content types GNOME/xdg-utils actually consult for "the default
// browser" — matches totoshko88/browser-switcher's approach (Gio.AppInfo
// directly, not shelling out to xdg-settings).
const BROWSER_CONTENT_TYPES = ["x-scheme-handler/http", "x-scheme-handler/https", "text/html"];

/**
 * Sets the system default browser to the given package. Returns false
 * (leaving the previous default untouched) when the package's .desktop file
 * can't be resolved or GIO refuses one of the content-type associations.
 */
export function setDefaultBrowser(pkg: ResolvedBrowserPkg): boolean {
  const info = getDesktopAppInfo(desktopIdFor(pkg));
  if (!info) return false;
  try {
    for (const contentType of BROWSER_CONTENT_TYPES) {
      info.set_as_default_for_type(contentType);
    }
  } catch (e: unknown) {
    logError(e as object, "[browser-hub] failed to set default browser");
    return false;
  }
  clearDefaultBrowserCache();
  return true;
}
