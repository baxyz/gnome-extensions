import Gio from "gi://Gio";
import type * as Main from "resource:///org/gnome/shell/ui/main.js";
import type { ResolvedBrowserPkg } from "../taxonomy";
import { getDesktopAppInfo } from "./gio";
import { resolveDesktopId } from "./desktop-icon";

/**
 * Launches `pkg` through its real .desktop file instead of a hand-built
 * argv — portal/branch/arch-aware for Flatpak and correctly handles
 * DBus-activatable apps and startup notification, neither of which
 * Gio.Subprocess.new() (launchBrowser's fallback below) does. Returns false
 * (never throws) both when `pkg`'s desktop id doesn't actually resolve to a
 * real Gio.DesktopAppInfo and when launch() itself fails — either way,
 * launchBrowser falls straight back to its raw-argv path, so this is never
 * the difference between launching and not.
 */
function launchViaDesktopAppInfo(pkg: ResolvedBrowserPkg): boolean {
  const info = getDesktopAppInfo(resolveDesktopId(pkg));
  if (info === null) return false;
  try {
    return info.launch(null, null);
  } catch {
    return false;
  }
}

/**
 * Returns the launched Gio.Subprocess, or null if launching failed — or if
 * `pkg` was given and launched successfully via its real .desktop file
 * instead (see launchViaDesktopAppInfo): there's no Subprocess handle for
 * that path, but every current caller already discards the return value.
 * `pkg` is optional and should be omitted for profile/space/donut launches —
 * those need extra argv flags (-P, --profile, --zen-workspace,
 * --filesystem=...) that Gio.AppInfo.launch() has no way to carry, so they
 * must stay on the raw-argv path below.
 */
export function launchBrowser({
  command,
  title,
  notify,
  pkg,
}: {
  command: string[];
  title: string;
  notify: typeof Main.notify;
  pkg?: ResolvedBrowserPkg;
}): Gio.Subprocess | null {
  if (pkg && launchViaDesktopAppInfo(pkg)) return null;
  try {
    // argv form — no shell involved, so profile names/paths never need escaping.
    return Gio.Subprocess.new(command, Gio.SubprocessFlags.NONE);
  } catch (e: unknown) {
    logError(e as object, `[${title}] Failed to launch browser.`);
    notify(title, "Failed to launch browser.");
    return null;
  }
}
