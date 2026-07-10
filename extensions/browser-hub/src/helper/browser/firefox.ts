import GLib from "gi://GLib";
import type { FirefoxBrowserConfig, ResolvedBrowserEntry } from "../../types";
import type { FirefoxOptions } from "../../types";
import { SpaceType } from "../../types/space-type.enum";
import {
  buildBaseCommand,
  compareByDefault,
  filterPresent,
  logIfUnexpected,
  readTextFileAsync,
  settleAll,
} from "../internal";
import { readFirefoxSelectableProfiles, type FirefoxSelectableProfile } from "./firefox-spaces";
import { readZenSpaces } from "./zen";
import { resolveFirefoxIcon, resolveZenIcon, type IconContext } from "../icons";

export type ProfileEntry = {
  name: string;
  dir: string;
  folderBasename: string;
  isDefault: boolean;
};

export function parseProfiles(content: string, iniDir: string): ProfileEntry[] {
  const sections = content.split(/^\[/m).slice(1);

  // Firefox 67+ (profile-per-install) tracks each installation's default profile
  // in a separate [InstallXXXXXXXX] section (Default=<relative path>), since
  // several installs (release/beta/ESR) can share one profiles.ini. When present,
  // this is the source of truth; the legacy per-profile Default=1 flag can be
  // stale or absent on those installs.
  const installDefaultPaths = new Set(
    sections
      .filter((section) => section.startsWith("Install"))
      .map((section) => section.match(/^Default=(.+)/m)?.[1]?.trim())
      .filter((path): path is string => path !== undefined),
  );

  return sections.flatMap((section) => {
    if (section.startsWith("Install")) return [];
    const name = section.match(/^Name=(.+)/m)?.[1];
    const profilePath = section.match(/^Path=(.+)/m)?.[1];
    const isRelative = /^IsRelative=1/m.test(section);
    if (!name || !profilePath) return [];
    const trimmedPath = profilePath.trim();
    const isDefault =
      installDefaultPaths.size > 0
        ? installDefaultPaths.has(trimmedPath)
        : /^Default=1/m.test(section);
    const dir = isRelative ? `${iniDir}/${trimmedPath}` : trimmedPath;
    const folderBasename = GLib.path_get_basename(dir);
    return [{ name: name.trim(), dir, folderBasename, isDefault }];
  });
}

function readProfiles(path: string): Promise<ProfileEntry[]> {
  const iniDir = GLib.path_get_dirname(path);
  return readTextFileAsync(path)
    .then((text) => parseProfiles(text, iniDir))
    .catch((e: unknown) => {
      logIfUnexpected(e, `[browser-hub] failed to read profiles.ini at ${path}`);
      return [];
    });
}

const spColors = (sp: FirefoxSelectableProfile, context: IconContext) => ({
  icon: resolveFirefoxIcon(sp.avatar, context),
  fgColor: sp.themeFg,
  bgColor: sp.themeBg,
});

const DEFAULT_FIREFOX_OPTIONS: FirefoxOptions = {
  enabledSpaces: new Set(Object.values(SpaceType)),
  profileGroupsMode: "profiles",
};

export async function resolveFirefoxBrowsers(
  browsers: FirefoxBrowserConfig[],
  { enabledSpaces, profileGroupsMode }: FirefoxOptions = DEFAULT_FIREFOX_OPTIONS,
): Promise<ResolvedBrowserEntry[]> {
  const entries = await settleAll(
    filterPresent(browsers).map(async (b) => {
      const baseCommand = buildBaseCommand(b.pkg);
      const profiles = await readProfiles(b.path);
      const firefoxRoot = GLib.path_get_dirname(b.path);
      const selectableMap =
        profileGroupsMode !== "off"
          ? await readFirefoxSelectableProfiles(
              firefoxRoot,
              profiles.map((p) => p.folderBasename),
            )
          : new Map<string, FirefoxSelectableProfile[]>();

      const items = (
        await Promise.all(
          profiles.map(async ({ name, dir, folderBasename, isDefault }) => {
            const selectable = selectableMap.get(folderBasename);

            if (selectable != null) {
              if (profileGroupsMode === "profiles") {
                // Flatten: each selectable profile becomes its own top-level entry
                return selectable.map((sp) => ({
                  label: sp.name,
                  command: [...baseCommand, "--profile", sp.dir, "-no-remote"],
                  // Mark default only on the sp whose folder matches this toolkit profile
                  isDefault: isDefault && sp.dir.split("/").at(-1) === folderBasename,
                  ...spColors(sp, "profile"),
                }));
              }
              // "spaces" mode: nest selectable profiles as space buttons
              return [
                {
                  label: name,
                  command: [...baseCommand, "-P", name, "-no-remote"],
                  isDefault,
                  spaces: selectable.map((sp) => ({
                    name: sp.name,
                    command: [...baseCommand, "--profile", sp.dir, "-no-remote"],
                    ...spColors(sp, "space"),
                  })),
                },
              ];
            }

            const spaces =
              b.spaceType === SpaceType.ZenWorkspace && enabledSpaces.has(SpaceType.ZenWorkspace)
                ? (await readZenSpaces(dir)).map((space) => ({
                    ...space,
                    icon: resolveZenIcon(space.icon),
                    command: [
                      ...baseCommand,
                      "-P",
                      name,
                      "--zen-workspace",
                      space.name,
                      "-no-remote",
                    ],
                  }))
                : [];
            return [
              {
                label: name,
                command: [...baseCommand, "-P", name, "-no-remote"],
                isDefault,
                ...(spaces.length > 0 && { spaces }),
              },
            ];
          }),
        )
      ).flat();
      items.sort(compareByDefault);
      return { label: b.label, items };
    }),
    "[browser-hub] a Firefox-family browser failed to resolve",
  );
  return entries.filter((e) => e.items.length > 0);
}
