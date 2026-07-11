import { argbToRgb } from "@helpers4/color";
import { safeJsonParse } from "@helpers4/object";
import { settle } from "@helpers4/promise";
import type { ChromiumBrowserConfig, ResolvedBrowserEntry } from "../../types";
import {
  buildBaseCommand,
  compareByDefault,
  filterPresent,
  logIfUnexpected,
  readTextFileAsync,
} from "../internal";
import { resolveBrowserIcon } from "../icons";

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
  return Object.entries(cache).map(([dir, info]) => ({
    dir,
    name: info.name ?? dir,
    isDefault: dir === lastUsed,
    bgColor: info.background_color != null ? argbToRgb(info.background_color) : undefined,
  }));
}

function readProfiles(path: string): Promise<ChromiumProfile[]> {
  return readTextFileAsync(path)
    .then((text) => parseProfiles(text))
    .catch((e: unknown) => {
      logIfUnexpected(e, `[browser-hub] failed to read Local State at ${path}`);
      return [];
    });
}

export async function resolveChromiumBrowsers(
  browsers: ChromiumBrowserConfig[],
): Promise<ResolvedBrowserEntry[]> {
  const { fulfilled, rejected } = await settle(
    filterPresent(browsers).map(async (b) => {
      const profiles = await readProfiles(b.path);
      const items = profiles
        .map((profile) => ({
          label: profile.name,
          command: [...buildBaseCommand(b.pkg), `--profile-directory=${profile.dir}`],
          isDefault: profile.isDefault,
          icon: resolveBrowserIcon(b.icon),
          bgColor: profile.bgColor,
          // Chrome's own profile picker shows this same account color, so
          // it's safe to render as-is (unlike Firefox's theme color, which
          // isn't paired with a real icon yet — see firefox.ts).
          showColorDot: true,
        }))
        .sort(compareByDefault);
      return { label: b.label, items };
    }),
  );
  for (const reason of rejected) {
    logError(reason as object, "[browser-hub] a Chromium-family browser failed to resolve");
  }
  return fulfilled.filter((e) => e.items.length > 0);
}
