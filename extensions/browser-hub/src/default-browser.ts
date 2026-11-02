import Gio from "gi://Gio";
import { guard } from "@helpers4/promise";
import { PackageManager } from "./taxonomy";
import type { ResolvedBrowserPkg } from "./taxonomy";
import { getDesktopAppInfo, resolveDesktopId, type DesktopAppInfo } from "./internal";

export type DefaultBrowserInfo = {
  name: string;
  /** Launched through its own .desktop entry. */
  appInfo: Gio.AppInfo;
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
  // Known desktop id, so the icon lookup doesn't have to guess it.
  return { manager: PackageManager.Native, binary: executable, desktopId };
}

// Cleared by setDefaultBrowser(), on manual refresh and on disable.
let cachedDefaultBrowser: DefaultBrowserInfo | null | undefined;

export function clearDefaultBrowserCache(): void {
  cachedDefaultBrowser = undefined;
}

export function getDefaultBrowser(): DefaultBrowserInfo | null {
  if (cachedDefaultBrowser !== undefined) return cachedDefaultBrowser;
  const appInfo = Gio.AppInfo.get_default_for_uri_scheme("http");
  const name = appInfo?.get_name();
  const desktopId = appInfo?.get_id();
  const executable = appInfo?.get_executable();
  if (appInfo && name && desktopId && executable) {
    cachedDefaultBrowser = { name, appInfo, pkg: detectPkg(desktopId, executable) };
  } else {
    cachedDefaultBrowser = null;
  }
  return cachedDefaultBrowser;
}

// The content types GNOME uses for the default browser.
const BROWSER_CONTENT_TYPES = ["x-scheme-handler/http", "x-scheme-handler/https", "text/html"];

/** Makes `pkg` the default browser. False if its .desktop file or GIO fails. */
export function setDefaultBrowser(pkg: ResolvedBrowserPkg): boolean {
  const info = getDesktopAppInfo(resolveDesktopId(pkg));
  if (!info) return false;
  let ok = true;
  try {
    for (const contentType of BROWSER_CONTENT_TYPES) {
      info.set_as_default_for_type(contentType);
    }
  } catch (e: unknown) {
    logError(e as object, "[browser-hub] failed to set default browser");
    ok = false;
  }
  // Clear in any case: a failure may come after some types were changed.
  clearDefaultBrowserCache();
  return ok;
}
