import Gio from "gi://Gio";
import GLib from "gi://GLib";
import { safeJsonParse } from "@helpers4/object";
import type { ZenSpaceData } from "../types";
import { decodeMozLz4 } from "mozlz4";

type ZenSessions = { spaces?: ZenSpaceData[] };

const decoder = new TextDecoder();

function readArchive(archivePath: string): Promise<ZenSpaceData[]> {
  return new Promise((resolve) => {
    const file = Gio.File.new_for_path(archivePath);
    file.load_contents_async(null, (_source, result) => {
      try {
        const [, contents] = file.load_contents_finish(result);
        const json = decoder.decode(decodeMozLz4(contents));
        const data = safeJsonParse<ZenSessions>(json);
        resolve(data?.spaces ?? []);
      } catch {
        resolve([]);
      }
    });
  });
}

/** Reads the Zen spaces for a given profile directory. Returns [] if absent or unreadable. */
export async function readZenSpaces(profileDir: string): Promise<ZenSpaceData[]> {
  const archivePath = `${profileDir}/zen-sessions.jsonlz4`;
  if (!GLib.file_test(archivePath, GLib.FileTest.EXISTS)) return [];
  return readArchive(archivePath);
}
