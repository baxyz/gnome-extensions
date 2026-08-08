import GLib from "gi://GLib";
import { readTable } from "sqlite-reader";
import { createSortByStringFn, isEmpty } from "@helpers4/array";
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

// A stale .sqlite left behind by e.g. a profile migration is harmless on its
// own, but nothing bounds how many could accumulate over years of use —
// cap how many get read so a directory with hundreds of them can't turn a
// menu-open into a long stall. Sorted first so which ones get kept is
// deterministic (directory-listing order isn't guaranteed stable), not a
// coin flip across runs.
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
  /** Every toolkit basename in this group's own rows — not just the first found. */
  matchedBasenames: string[];
  selectable: FirefoxSelectableProfile[];
};

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
  const toolkitSet = new Set(toolkitBasenames);

  // Read every db first, then combine in a stable (sorted by path) order —
  // Promise.all settles in unspecified order, and if two db files somehow
  // matched the same toolkit folder (e.g. a stale database left over from a
  // profile migration), "whichever happens to finish reading first wins"
  // would make the selectable-profile list for that folder a coin flip
  // across runs instead of a function of the actual file contents.
  const perFile = await Promise.all(
    dbFiles.map(async (dbPath): Promise<MatchedGroup> => {
      const empty: MatchedGroup = { dbPath, matchedBasenames: [], selectable: [] };
      try {
        const data = await readFileAsync(dbPath);
        const rows = readTable(data, "Profiles");
        if (rows.length <= 1) return empty;

        // Every toolkit profile that's actually part of this group, not just
        // the first one found — a group can have more than one of its
        // members independently listed in profiles.ini too.
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
