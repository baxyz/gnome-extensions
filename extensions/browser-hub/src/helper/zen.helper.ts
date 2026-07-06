import GLib from "gi://GLib";
import { safeJsonParse } from "@helpers4/object";
import type { ZenSpaceData } from "../types";
import { decodeMozLz4 } from "mozlz4";
import { decoder, readFileAsync } from "./gio.helper";

type ZenSessions = { spaces?: ZenSpaceData[] };

function readArchive(archivePath: string): Promise<ZenSpaceData[]> {
  return readFileAsync(archivePath)
    .then((contents) => {
      const json = decoder.decode(decodeMozLz4(contents));
      const data = safeJsonParse<ZenSessions>(json);
      return data?.spaces ?? [];
    })
    .catch(() => []);
}

/** Reads the Zen spaces for a given profile directory. Returns [] if absent or unreadable. */
export async function readZenSpaces(profileDir: string): Promise<ZenSpaceData[]> {
  const archivePath = `${profileDir}/zen-sessions.jsonlz4`;
  if (!GLib.file_test(archivePath, GLib.FileTest.EXISTS)) return [];
  return readArchive(archivePath);
}
