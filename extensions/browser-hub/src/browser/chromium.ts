import { argbToRgb } from "@helpers4/color";
import { safeJsonParse } from "@helpers4/object";
import { settle } from "@helpers4/promise";
import type { ChromiumBrowserConfig, ColorPresentation, ResolvedBrowserEntry } from "../taxonomy";
import {
  compareByDefault,
  errorMessage,
  filterPresent,
  logIfUnexpected,
  readTextFileAsync,
  resolveDesktopIcon,
  tagError,
} from "../internal";

export type ChromiumProfile = { name: string; dir: string; isDefault: boolean; bgColor?: string };
type LocalState = {
  profile?: {
    info_cache?: Record<string, { name?: string; background_color?: number }>;
    last_used?: string;
  };
};

export function parseProfiles(content: string): ChromiumProfile[] {
  const json = safeJsonParse<LocalState>(content);
  const cache = json?.profile?.info_cache ?? {};
  const lastUsed = json?.profile?.last_used;
  // Skip malformed entries instead of losing every profile.
  return Object.entries(cache).flatMap(([dir, info]) => {
    if (info == null || typeof info !== "object") return [];
    return [
      {
        dir,
        // `||`: Opera can write an empty name.
        name: info.name || dir,
        isDefault: dir === lastUsed,
        bgColor: info.background_color != null ? argbToRgb(info.background_color) : undefined,
      },
    ];
  });
}

/** Chromium colors are shown as a dot after the label. */
function toDotColor(bgColor: string | undefined): ColorPresentation | undefined {
  return bgColor != null ? { mode: "dot", bgColor } : undefined;
}

function readProfiles(path: string): Promise<ChromiumProfile[]> {
  return readTextFileAsync(path)
    .then((text) => parseProfiles(text))
    .catch((e: unknown) => {
      logIfUnexpected(e, `[browser-hub] failed to read Local State at ${path}`);
      return [];
    });
}

/** `errors` gets one message per browser that failed. */
export async function resolveChromiumBrowsers(
  browsers: ChromiumBrowserConfig[],
  errors: string[] = [],
): Promise<ResolvedBrowserEntry[]> {
  const { fulfilled, rejected } = await settle(
    filterPresent(browsers).map(async (b) => {
      try {
        const profiles = await readProfiles(b.path);
        const items = profiles
          .map((profile) => ({
            label: profile.name,
            launch: { kind: "chromiumProfile", pkg: b.pkg, dir: profile.dir } as const,
            isDefault: profile.isDefault,
            color: toDotColor(profile.bgColor),
          }))
          .sort(compareByDefault);
        return { label: b.label, items, icon: resolveDesktopIcon(b.pkg) };
      } catch (e) {
        tagError(b.label, e);
      }
    }),
  );
  for (const reason of rejected) {
    errors.push(errorMessage(reason));
    logError(reason as object, "[browser-hub] a Chromium-family browser failed to resolve");
  }
  return fulfilled.filter((e) => e.items.length > 0);
}
