import GLib from "gi://GLib";
import { safeJsonParse } from "@helpers4/object";
import type { ChromiumBrowserConfig, ResolvedBrowserEntry } from "../types";
import { buildBaseCommand, compareByDefault, filterPresent } from "./pkg.helper";
import { readTextFileAsync } from "./gio.helper";

type ChromiumProfile = { name: string; dir: string; isDefault: boolean; bgColor?: string };
type LocalState = {
  profile?: {
    info_cache?: Record<string, { name?: string; background_color?: number }>;
    last_used?: string;
  };
};

function argbToRgb(argb: number): string {
  const r = (argb >>> 16) & 0xff;
  const g = (argb >>> 8) & 0xff;
  const b = argb & 0xff;
  return `rgb(${r},${g},${b})`;
}

function parseProfiles(content: string): ChromiumProfile[] {
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
    .catch(() => []);
}

export async function resolveChromiumBrowsers(
  browsers: ChromiumBrowserConfig[],
): Promise<ResolvedBrowserEntry[]> {
  const entries = await Promise.all(
    filterPresent(browsers).map(async (b) => {
      const profiles = await readProfiles(b.path);
      const items = profiles
        .map((profile) => ({
          label: profile.name,
          command: `${buildBaseCommand(b.pkg)} --profile-directory="${profile.dir}"`,
          isDefault: profile.isDefault,
          bgColor: profile.bgColor,
        }))
        .sort(compareByDefault);
      return { label: b.label, items };
    }),
  );
  return entries.filter((e) => e.items.length > 0);
}
