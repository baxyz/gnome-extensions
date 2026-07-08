import Gio from "gi://Gio";
import GLib from "gi://GLib";
import { readTable } from "sqlite-reader";
import { logIfUnexpected, readFileAsync } from "../internal";

export interface FirefoxSelectableProfile {
  name: string;
  dir: string;
  /** Profile avatar identifier (e.g. "book", "briefcase") */
  avatar?: string;
  /** CSS foreground color from the profile theme (e.g. "#ffffff") */
  themeFg?: string;
  /** CSS background color from the profile theme (e.g. "#20123a") */
  themeBg?: string;
}

const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);

function listSqliteFiles(dirPath: string): Promise<string[]> {
  return new Promise((resolve) => {
    if (!GLib.file_test(dirPath, GLib.FileTest.IS_DIR)) return resolve([]);
    const dir = Gio.File.new_for_path(dirPath);
    dir.enumerate_children_async(
      "standard::name",
      Gio.FileQueryInfoFlags.NONE,
      GLib.PRIORITY_DEFAULT,
      null,
      (_source, result) => {
        try {
          const enumerator = dir.enumerate_children_finish(result);
          const files: string[] = [];
          let info: Gio.FileInfo | null;
          while ((info = enumerator.next_file(null)) !== null) {
            const name = info.get_name();
            if (name.endsWith(".sqlite")) files.push(`${dirPath}/${name}`);
          }
          enumerator.close(null);
          resolve(files);
        } catch {
          resolve([]);
        }
      },
    );
  });
}

/**
 * For each Profile Groups SQLite that contains >1 selectable profile, find which
 * toolkit profile folder it belongs to (by matching one of its paths) and return
 * the full list of selectable profiles keyed by that folder basename.
 *
 * @param firefoxRoot  e.g. ~/.mozilla/firefox
 * @param toolkitBasenames  folder basenames from profiles.ini, e.g. ["abc1.default-release"]
 */
export async function readFirefoxSelectableProfiles(
  firefoxRoot: string,
  toolkitBasenames: string[],
): Promise<Map<string, FirefoxSelectableProfile[]>> {
  const profileGroupsDir = `${firefoxRoot}/Profile Groups`;
  const dbFiles = await listSqliteFiles(profileGroupsDir);
  const result = new Map<string, FirefoxSelectableProfile[]>();
  const toolkitSet = new Set(toolkitBasenames);

  await Promise.all(
    dbFiles.map(async (dbPath) => {
      try {
        const data = await readFileAsync(dbPath);
        const rows = readTable(data, "Profiles");

        if (rows.length <= 1) return;

        let matchedBasename: string | undefined;
        for (const row of rows) {
          if (typeof row.path !== "string") continue;
          const rb = GLib.path_get_basename(row.path);
          if (toolkitSet.has(rb)) {
            matchedBasename = rb;
            break;
          }
        }
        if (!matchedBasename) return;

        result.set(
          matchedBasename,
          rows
            .filter((row) => typeof row.path === "string" && typeof row.name === "string")
            .map((row) => ({
              name: row.name as string,
              dir: `${firefoxRoot}/${row.path}`,
              avatar: str(row.avatar),
              themeFg: str(row.themeFg),
              themeBg: str(row.themeBg),
            })),
        );
      } catch (e: unknown) {
        logIfUnexpected(e, `[browser-hub] failed to read Profile Groups database at ${dbPath}`);
      }
    }),
  );

  return result;
}
