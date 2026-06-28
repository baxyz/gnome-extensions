import Gio from "gi://Gio";
import GLib from "gi://GLib";
import { safeJsonParse } from "@helpers4/object";
import type { ChromiumBrowserConfig, ResolvedBrowserEntry } from "../types";
import { buildBaseCommand, filterAvailable } from "./pkg.helper";

const decoder = new TextDecoder();

type ChromiumProfile = { name: string; dir: string; isDefault: boolean };
type LocalState = {
  profile?: { info_cache?: Record<string, { name?: string }>; last_used?: string };
};

function parseProfiles(content: string): ChromiumProfile[] {
  const json = safeJsonParse<LocalState>(content);
  const cache = json?.profile?.info_cache ?? {};
  const lastUsed = json?.profile?.last_used;
  return Object.entries(cache).map(([dir, info]) => ({
    dir,
    name: info.name ?? dir,
    isDefault: dir === lastUsed,
  }));
}

function readProfiles(path: string): Promise<ChromiumProfile[]> {
  return new Promise((resolve) => {
    const file = Gio.File.new_for_path(path);
    file.load_contents_async(null, (_source, result) => {
      try {
        const [, contents] = file.load_contents_finish(result);
        resolve(parseProfiles(decoder.decode(contents)));
      } catch {
        resolve([]);
      }
    });
  });
}

export async function resolveChromiumBrowsers(
  browsers: ChromiumBrowserConfig[],
): Promise<ResolvedBrowserEntry[]> {
  const entries = await Promise.all(
    filterAvailable(browsers)
      .filter((b) => GLib.file_test(b.path, GLib.FileTest.EXISTS))
      .map(async (b) => {
        const profiles = await readProfiles(b.path);
        return {
          label: b.label,
          items: profiles.map((profile) => ({
            label: profile.name,
            command: `${buildBaseCommand(b.pkg)} --profile-directory="${profile.dir}"`,
            isDefault: profile.isDefault,
          })),
        };
      }),
  );
  return entries.filter((e) => e.items.length > 0);
}
