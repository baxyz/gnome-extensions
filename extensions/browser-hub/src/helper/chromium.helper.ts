import Gio from "gi://Gio";
import GLib from "gi://GLib";
import type { ChromiumBrowserConfig, ResolvedBrowserEntry } from "../types";
import { buildBaseCommand, resolvePkg } from "./pkg.helper";

type ChromiumProfile = { name: string; dir: string };

function parseProfiles(content: string): ChromiumProfile[] {
  try {
    const json = JSON.parse(content);
    const cache: Record<string, { name?: string }> = json?.profile?.info_cache ?? {};
    return Object.entries(cache).map(([dir, info]) => ({
      dir,
      name: info.name ?? dir,
    }));
  } catch {
    return [];
  }
}

function readProfiles(path: string): Promise<ChromiumProfile[]> {
  return new Promise((resolve) => {
    const file = Gio.File.new_for_path(path);
    file.load_contents_async(null, (_source, result) => {
      try {
        const [, contents] = file.load_contents_finish(result);
        resolve(parseProfiles(new TextDecoder().decode(contents)));
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
    browsers
      .flatMap((b) => {
        const pkg = resolvePkg(b.pkg);
        return pkg !== null ? [{ ...b, pkg }] : [];
      })
      .filter((b) => GLib.file_test(b.path, GLib.FileTest.EXISTS))
      .map(async (b) => {
        const profiles = await readProfiles(b.path);
        return {
          label: b.label,
          items: profiles.map((profile) => ({
            label: profile.name,
            command: `${buildBaseCommand(b.pkg)} --profile-directory="${profile.dir}"`,
          })),
        };
      }),
  );
  return entries.filter((e) => e.items.length > 0);
}
