import GLib from "gi://GLib";
import { safeJsonParse } from "@helpers4/object";
import type { ZenSpaceData } from "../taxonomy";
import { decodeMozLz4 } from "mozlz4";
import { decoder, logIfUnexpected, pathIsPresent, readFileAsync } from "../internal";

type ZenSessions = { spaces?: ZenSpaceData[] };

/** The primary color of a "gradient" theme. Other theme types give no color. */
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
      // A file cut mid-write can still be valid JSON of the wrong shape.
      return Array.isArray(data?.spaces) ? data.spaces : [];
    })
    .catch((e: unknown) => {
      logIfUnexpected(e, `[browser-hub] failed to read Zen session archive at ${archivePath}`);
      return [];
    });
}

/** The Zen workspaces of a profile, or [] if there are none. */
export async function readZenSpaces(profileDir: string): Promise<ZenSpaceData[]> {
  const archivePath = `${profileDir}/zen-sessions.jsonlz4`;
  if (!pathIsPresent(archivePath, GLib.FileTest.EXISTS)) return [];
  return readArchive(archivePath);
}
