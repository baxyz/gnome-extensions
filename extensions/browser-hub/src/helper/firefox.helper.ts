import Gio from "gi://Gio";
import GLib from "gi://GLib";
import type { FirefoxBrowserConfig, ResolvedBrowserEntry } from "../types";
import { SpaceType } from "../types/space-type.enum";
import { buildBaseCommand, filterAvailable } from "./pkg.helper";
import { readZenSpaces } from "./zen.helper";
import { readFirefoxSelectableProfiles } from "./firefox-spaces.helper";

const decoder = new TextDecoder();

type ProfileEntry = { name: string; dir: string; folderBasename: string; isDefault: boolean };

function parseProfiles(content: string, iniDir: string): ProfileEntry[] {
  return content
    .split(/^\[/m)
    .slice(1)
    .flatMap((section) => {
      const name = section.match(/^Name=(.+)/m)?.[1];
      const profilePath = section.match(/^Path=(.+)/m)?.[1];
      const isRelative = /^IsRelative=1/m.test(section);
      const isDefault = /^Default=1/m.test(section);
      if (!name || !profilePath) return [];
      const dir = isRelative ? `${iniDir}/${profilePath.trim()}` : profilePath.trim();
      const folderBasename = GLib.path_get_basename(dir);
      return [{ name: name.trim(), dir, folderBasename, isDefault }];
    });
}

function readProfiles(path: string): Promise<ProfileEntry[]> {
  return new Promise((resolve) => {
    const file = Gio.File.new_for_path(path);
    const iniDir = file.get_parent()?.get_path() ?? "";
    file.load_contents_async(null, (_source, result) => {
      try {
        const [, contents] = file.load_contents_finish(result);
        resolve(parseProfiles(decoder.decode(contents), iniDir));
      } catch {
        resolve([]);
      }
    });
  });
}

export async function resolveFirefoxBrowsers(
  browsers: FirefoxBrowserConfig[],
  enabledSpaces: ReadonlySet<SpaceType> = new Set(Object.values(SpaceType)),
): Promise<ResolvedBrowserEntry[]> {
  const entries = await Promise.all(
    filterAvailable(browsers)
      .filter((b) => GLib.file_test(b.path, GLib.FileTest.EXISTS))
      .map(async (b) => {
        const profiles = await readProfiles(b.path);
        const firefoxRoot = GLib.path_get_dirname(b.path);
        const selectableMap = enabledSpaces.has(SpaceType.FirefoxProfileGroup)
          ? await readFirefoxSelectableProfiles(
              firefoxRoot,
              profiles.map((p) => p.folderBasename),
            )
          : new Map<string, import("./firefox-spaces.helper").FirefoxSelectableProfile[]>();

        const items = (
          await Promise.all(
            profiles.map(async ({ name, dir, folderBasename, isDefault }) => {
              const baseCommand = buildBaseCommand(b.pkg);
              const selectable = selectableMap.get(folderBasename);

              if (selectable != null) {
                return [
                  {
                    label: name,
                    command: `${baseCommand} -P "${name}" -no-remote`,
                    isDefault,
                    spaces: selectable.map((sp) => ({
                      name: sp.name,
                      command: `${baseCommand} --profile "${sp.dir}" -no-remote`,
                    })),
                  },
                ];
              }

              const spaces =
                b.spaceType === SpaceType.ZenWorkspace && enabledSpaces.has(SpaceType.ZenWorkspace)
                  ? (await readZenSpaces(dir)).map((space) => ({
                      ...space,
                      command: `${baseCommand} -P "${name}" --zen-workspace "${space.name}" -no-remote`,
                    }))
                  : [];
              return [
                {
                  label: name,
                  command: `${baseCommand} -P "${name}" -no-remote`,
                  isDefault,
                  ...(spaces.length > 0 && { spaces }),
                },
              ];
            }),
          )
        ).flat();
        items.sort(
          (a, b) => Number(b.isDefault) - Number(a.isDefault) || a.label.localeCompare(b.label),
        );
        return { label: b.label, items };
      }),
  );
  return entries.filter((e) => e.items.length > 0);
}
