import Gio from "gi://Gio";
import GLib from "gi://GLib";
import { PackageManager } from "../types";
import type { ResolvedBrowserPkg } from "../types";
import { buildBaseCommand } from "./pkg.helper";
import { HOME_DIR } from "../constants/paths.constant";

export type DefaultBrowserInfo = {
  name: string;
  command: string;
};

const DESKTOP_DIRS = [
  HOME_DIR + "/.local/share/applications",
  HOME_DIR + "/.local/share/flatpak/exports/share/applications",
  "/var/lib/flatpak/exports/share/applications",
  "/usr/share/applications",
  "/usr/local/share/applications",
];

function desktopField(kf: GLib.KeyFile, key: string): string | null {
  try {
    return kf.get_string("Desktop Entry", key);
  } catch {
    return null;
  }
}

async function detectPkg(desktopId: string, executable: string): Promise<ResolvedBrowserPkg> {
  const path = DESKTOP_DIRS.map((d) => `${d}/${desktopId}`).find((p) =>
    GLib.file_test(p, GLib.FileTest.EXISTS),
  );
  if (path) {
    try {
      const file = Gio.File.new_for_path(path);
      const data = await new Promise<Uint8Array>((resolve, reject) => {
        file.load_contents_async(null, (_source, result) => {
          try {
            const [, contents] = file.load_contents_finish(result);
            resolve(contents);
          } catch (e) {
            reject(e);
          }
        });
      });
      const kf = new GLib.KeyFile();
      const text = new TextDecoder().decode(data);
      kf.load_from_data(text, data.length, GLib.KeyFileFlags.NONE);
      const flatpakId = desktopField(kf, "X-Flatpak");
      if (flatpakId) return { manager: PackageManager.Flatpak, appId: flatpakId };
      const snapName = desktopField(kf, "X-SnapInstanceName");
      if (snapName) return { manager: PackageManager.Snap, name: snapName };
    } catch {
      // unreadable desktop file — fallback to native
    }
  }
  return { manager: PackageManager.Native, binary: executable };
}

export async function getDefaultBrowser(): Promise<DefaultBrowserInfo | null> {
  const appInfo = Gio.AppInfo.get_default_for_uri_scheme("http");
  if (!appInfo) return null;
  const name = appInfo.get_name();
  const desktopId = appInfo.get_id();
  const executable = appInfo.get_executable();
  if (!name || !desktopId || !executable) return null;
  const command = buildBaseCommand(await detectPkg(desktopId, executable));
  return { name, command };
}
