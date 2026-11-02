import GLib from "gi://GLib";
import { readTable } from "sqlite-reader";
import { createSortByStringFn, isEmpty } from "@helpers4/array";
import { listDirEntries, logIfUnexpected, readFileAsync } from "../internal";

export interface FirefoxSelectableProfile {
  name: string;
  dir: string;
  /** Avatar name, e.g. "book" */
  avatar?: string;
  /** e.g. "#ffffff" */
  themeFg?: string;
  /** e.g. "#20123a" */
  themeBg?: string;
}

const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);

// Old databases can pile up; read at most this many, in sorted order.
const MAX_SQLITE_FILES = 50;

async function listSqliteFiles(dirPath: string): Promise<string[]> {
  const entries = await listDirEntries(
    dirPath,
    `[browser-hub] failed to list Profile Groups directory ${dirPath}`,
  );
  const files = entries
    .filter((e) => e.name.endsWith(".sqlite"))
    .map((e) => `${dirPath}/${e.name}`)
    .sort();
  if (files.length > MAX_SQLITE_FILES) {
    console.log(
      `[browser-hub] ${dirPath} has ${files.length} .sqlite files, only reading the first ${MAX_SQLITE_FILES}`,
    );
  }
  return files.slice(0, MAX_SQLITE_FILES);
}

type MatchedGroup = {
  dbPath: string;
  matchedBasenames: string[];
  selectable: FirefoxSelectableProfile[];
};

/**
 * Maps each toolkit profile folder (basename) to the selectable profiles
 * of the Profile Group it belongs to. Groups with one profile are skipped.
 */
export async function readFirefoxSelectableProfiles(
  firefoxRoot: string,
  toolkitBasenames: string[],
): Promise<Map<string, FirefoxSelectableProfile[]>> {
  const profileGroupsDir = `${firefoxRoot}/Profile Groups`;
  const dbFiles = await listSqliteFiles(profileGroupsDir);
  const toolkitSet = new Set(toolkitBasenames);

  // Merged in path order, so the result doesn't depend on read timing.
  const perFile = await Promise.all(
    dbFiles.map(async (dbPath): Promise<MatchedGroup> => {
      const empty: MatchedGroup = { dbPath, matchedBasenames: [], selectable: [] };
      try {
        const data = await readFileAsync(dbPath);
        const rows = readTable(data, "Profiles");
        if (rows.length <= 1) return empty;

        // Several toolkit profiles can belong to the same group.
        const matchedBasenames = rows.flatMap((row) => {
          if (typeof row.path !== "string") return [];
          const rb = GLib.path_get_basename(row.path);
          return toolkitSet.has(rb) ? [rb] : [];
        });
        if (isEmpty(matchedBasenames)) return empty;

        const selectable = rows
          .filter((row) => typeof row.path === "string" && typeof row.name === "string")
          .map((row) => ({
            name: row.name as string,
            dir: `${firefoxRoot}/${row.path}`,
            avatar: str(row.avatar),
            themeFg: str(row.themeFg),
            themeBg: str(row.themeBg),
          }));
        return { dbPath, matchedBasenames, selectable };
      } catch (e: unknown) {
        logIfUnexpected(e, `[browser-hub] failed to read Profile Groups database at ${dbPath}`);
        return empty;
      }
    }),
  );

  const result = new Map<string, FirefoxSelectableProfile[]>();
  for (const { dbPath, matchedBasenames, selectable } of perFile.sort(
    createSortByStringFn("dbPath"),
  )) {
    for (const basename of matchedBasenames) {
      if (result.has(basename)) {
        console.log(
          `[browser-hub] multiple Profile Groups databases claim toolkit profile ` +
            `"${basename}" — keeping the first one found (${dbPath} ignored for it)`,
        );
        continue;
      }
      result.set(basename, selectable);
    }
  }

  return result;
}
