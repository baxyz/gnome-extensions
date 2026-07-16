import GLib from "gi://GLib";
import { safeJsonParse } from "@helpers4/object";
import type { ZenSpaceData } from "../taxonomy";
import { decodeMozLz4 } from "mozlz4";
import { decoder, logIfUnexpected, pathIsPresent, readFileAsync } from "../internal";

type ZenSessions = { spaces?: ZenSpaceData[] };

/**
 * Zen's own workspace accent color — a "gradient" theme's colors, one of
 * which is flagged primary (falls back to the first if none is). Only
 * "gradient" is understood; any other/future theme type yields no color
 * rather than a guessed one.
 */
export function zenSpaceColor(theme: ZenSpaceData["theme"]): string | undefined {
  if (theme?.type !== "gradient" || !theme.gradientColors?.length) return undefined;
  const primary = theme.gradientColors.find((g) => g.isPrimary) ?? theme.gradientColors[0];
  const [r, g, b] = primary.c;
  return `rgb(${r},${g},${b})`;
}

function readArchive(archivePath: string): Promise<ZenSpaceData[]> {
  return readFileAsync(archivePath)
    .then((contents) => {
      const json = decoder.decode(decodeMozLz4(contents));
      const data = safeJsonParse<ZenSessions>(json);
      // A crash mid-save can leave valid JSON with the wrong shape for
      // "spaces" (e.g. an object instead of an array) — Array.isArray guards
      // against that propagating into an unguarded .map() downstream and
      // crashing this Zen install's whole profile resolution.
      return Array.isArray(data?.spaces) ? data.spaces : [];
    })
    .catch((e: unknown) => {
      logIfUnexpected(e, `[browser-hub] failed to read Zen session archive at ${archivePath}`);
      return [];
    });
}

/** Reads the Zen spaces for a given profile directory. Returns [] if absent or unreadable. */
export async function readZenSpaces(profileDir: string): Promise<ZenSpaceData[]> {
  const archivePath = `${profileDir}/zen-sessions.jsonlz4`;
  if (!pathIsPresent(archivePath, GLib.FileTest.EXISTS)) return [];
  return readArchive(archivePath);
}
