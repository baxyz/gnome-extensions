import Gio from "gi://Gio";
import GLib from "gi://GLib";
import type { FirefoxBrowserConfig, ResolvedBrowserEntry } from "../types";
import { buildBaseCommand, resolvePkg } from "./pkg.helper";
import { readZenSpaces } from "./zen.helper";

type ProfileEntry = { name: string; dir: string };

function parseProfiles(content: string, iniDir: string): ProfileEntry[] {
  return content.split(/^\[/m).slice(1).flatMap((section) => {
    const name = section.match(/^Name=(.+)/m)?.[1];
    const profilePath = section.match(/^Path=(.+)/m)?.[1];
    const isRelative = /^IsRelative=1/m.test(section);
    if (!name || !profilePath) return [];
    const dir = isRelative ? `${iniDir}/${profilePath.trim()}` : profilePath.trim();
    return [{ name: name.trim(), dir }];
  });
}

function readProfiles(path: string): Promise<ProfileEntry[]> {
  return new Promise((resolve) => {
    const file = Gio.File.new_for_path(path);
    const iniDir = file.get_parent()?.get_path() ?? "";
    file.load_contents_async(null, (_source, result) => {
      try {
        const [, contents] = file.load_contents_finish(result);
        resolve(parseProfiles(new TextDecoder().decode(contents), iniDir));
      } catch {
        resolve([]);
      }
    });
  });
}

export async function resolveFirefoxBrowsers(
  browsers: FirefoxBrowserConfig[],
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
        const items = await Promise.all(
          profiles.map(async ({ name, dir }) => {
            const spaces = b.spaceType != null ? await readZenSpaces(dir) : [];
            return {
              label: name,
              command: `${buildBaseCommand(b.pkg)} -P "${name}" -no-remote`,
              ...(spaces.length > 0 && { spaces }),
            };
          }),
        );
        return { label: b.label, items };
      }),
  );
  return entries.filter((e) => e.items.length > 0);
}
