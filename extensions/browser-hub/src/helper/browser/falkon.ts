import Gio from "gi://Gio";
import GLib from "gi://GLib";
import type { FalkonBrowserConfig, ResolvedBrowserEntry } from "../../types";
import { buildBaseCommand, filterPresent } from "../internal";

function listProfileDirs(dirPath: string): Promise<string[]> {
  return new Promise((resolve) => {
    const dir = Gio.File.new_for_path(dirPath);
    dir.enumerate_children_async(
      "standard::name,standard::type",
      Gio.FileQueryInfoFlags.NONE,
      GLib.PRIORITY_DEFAULT,
      null,
      (_source, result) => {
        try {
          const enumerator = dir.enumerate_children_finish(result);
          const profiles: string[] = [];
          let info: Gio.FileInfo | null;
          while ((info = enumerator.next_file(null)) !== null) {
            if (info.get_file_type() === Gio.FileType.DIRECTORY) {
              profiles.push(info.get_name());
            }
          }
          enumerator.close(null);
          resolve(profiles);
        } catch {
          resolve([]);
        }
      },
    );
  });
}

export async function resolveFalkonBrowsers(
  browsers: FalkonBrowserConfig[],
): Promise<ResolvedBrowserEntry[]> {
  const entries = await Promise.all(
    filterPresent(browsers, GLib.FileTest.IS_DIR).map(async (b) => ({
      label: b.label,
      items: (await listProfileDirs(b.path)).map((name) => ({
        label: name,
        command: [...buildBaseCommand(b.pkg), "--profile", name],
      })),
    })),
  );
  return entries.filter((e) => e.items.length > 0);
}
