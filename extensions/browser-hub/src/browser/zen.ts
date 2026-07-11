import GLib from "gi://GLib";
import { safeJsonParse } from "@helpers4/object";
import type { ZenSpaceData } from "../taxonomy";
import { decodeMozLz4 } from "mozlz4";
import { decoder, logIfUnexpected, readFileAsync } from "../internal";

type ZenSessions = { spaces?: ZenSpaceData[] };

function readArchive(archivePath: string): Promise<ZenSpaceData[]> {
  return readFileAsync(archivePath)
    .then((contents) => {
      const json = decoder.decode(decodeMozLz4(contents));
      const data = safeJsonParse<ZenSessions>(json);
      return data?.spaces ?? [];
    })
    .catch((e: unknown) => {
      logIfUnexpected(e, `[browser-hub] failed to read Zen session archive at ${archivePath}`);
      return [];
    });
}

/** Reads the Zen spaces for a given profile directory. Returns [] if absent or unreadable. */
export async function readZenSpaces(profileDir: string): Promise<ZenSpaceData[]> {
  const archivePath = `${profileDir}/zen-sessions.jsonlz4`;
  if (!GLib.file_test(archivePath, GLib.FileTest.EXISTS)) return [];
  return readArchive(archivePath);
}
