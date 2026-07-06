import Gio from "gi://Gio";
import GLib from "gi://GLib";
import { readTable } from "sqlite-reader";

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

function readFileAsync(path: string): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const file = Gio.File.new_for_path(path);
    file.load_contents_async(null, (_source, result) => {
      try {
        const [, contents] = file.load_contents_finish(result);
        resolve(contents);
      } catch (e) {
        reject(e);
      }
    });
  });
}

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

  await Promise.all(
    dbFiles.map(async (dbPath) => {
      try {
        const data = await readFileAsync(dbPath);
        const rows = readTable(data, "Profiles");

        if (rows.length <= 1) return;

        // Match any row's path basename against known toolkit folder basenames
        const matchedBasename = toolkitBasenames.find((tb) =>
          rows.some((row) => typeof row.path === "string" && GLib.path_get_basename(row.path) === tb),
        );
        if (!matchedBasename) return;

        result.set(
          matchedBasename,
          rows
            .filter((row) => typeof row.path === "string" && typeof row.name === "string")
            .map((row) => ({
              name: row.name as string,
              dir: `${firefoxRoot}/${row.path}`,
              avatar: typeof row.avatar === "string" ? row.avatar : undefined,
              themeFg: typeof row.themeFg === "string" ? row.themeFg : undefined,
              themeBg: typeof row.themeBg === "string" ? row.themeBg : undefined,
            })),
        );
      } catch {
        // Unreadable or malformed database — skip silently
      }
    }),
  );

  return result;
}
