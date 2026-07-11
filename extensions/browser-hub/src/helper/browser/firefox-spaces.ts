import GLib from "gi://GLib";
import { readTable } from "sqlite-reader";
import { listDirEntries, logIfUnexpected, readFileAsync } from "../internal";

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

async function listSqliteFiles(dirPath: string): Promise<string[]> {
  const entries = await listDirEntries(
    dirPath,
    `[browser-hub] failed to list Profile Groups directory ${dirPath}`,
  );
  return entries.filter((e) => e.name.endsWith(".sqlite")).map((e) => `${dirPath}/${e.name}`);
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
