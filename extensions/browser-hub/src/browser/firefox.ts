import { settle } from "@helpers4/promise";
import GLib from "gi://GLib";
import type {
  ColorPresentation,
  FirefoxBrowserConfig,
  ProfileGroupsMode,
  ResolvedBrowserEntry,
  ResolvedBrowserItem,
} from "../taxonomy";
import type { FirefoxOptions } from "../taxonomy";
import { SpaceType } from "../taxonomy/space-type.enum";
import {
  buildBaseCommand,
  compareByDefault,
  filterPresent,
  logIfUnexpected,
  readTextFileAsync,
} from "../internal";
import { readFirefoxSelectableProfiles, type FirefoxSelectableProfile } from "./firefox-spaces";
import { readZenSpaces } from "./zen";
import { resolveBrowserIcon, resolveFirefoxIcon, resolveZenIcon, type IconContext } from "../icons";

/** Represents a single profile from Firefox's profiles.ini file. */
export type ProfileEntry = {
  name: string;
  dir: string;
  folderBasename: string;
  isDefault: boolean;
};

/**
 * Parses Firefox's profiles.ini content into ProfileEntry objects.
 * Handles both legacy Default=1 flags and modern [InstallXXXX] Default=path sections.
 * Modern sections take precedence as they track per-installation defaults.
 */
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

/**
 * Reads and parses a profiles.ini file from disk.
 * Returns empty array on error (file not found, permission denied, etc.).
 */
function readProfiles(path: string): Promise<ProfileEntry[]> {
  const iniDir = GLib.path_get_dirname(path);
  return readTextFileAsync(path)
    .then((text) => parseProfiles(text, iniDir))
    .catch((e: unknown) => {
      logIfUnexpected(e, `[browser-hub] failed to read profiles.ini at ${path}`);
      return [];
    });
}

/** Firefox theme colors only ever render as an icon badge, never a dot (that's Chromium-only). */
function toBadgeColor(sp: FirefoxSelectableProfile): ColorPresentation | undefined {
  return sp.themeFg || sp.themeBg
    ? { mode: "badge", fgColor: sp.themeFg, bgColor: sp.themeBg }
    : undefined;
}

function spColors(
  sp: FirefoxSelectableProfile,
  context: "space",
): { icon: string; fgColor: string | undefined; bgColor: string | undefined };
function spColors(
  sp: FirefoxSelectableProfile,
  context: "profile",
  browserIcon?: string | string[],
): { icon: string | undefined; color: ColorPresentation | undefined };
function spColors(
  sp: FirefoxSelectableProfile,
  context: IconContext,
  browserIcon?: string | string[],
) {
  if (context === "space") {
    return {
      icon: resolveFirefoxIcon(sp.avatar, "space"),
      fgColor: sp.themeFg,
      bgColor: sp.themeBg,
    };
  }
  return { icon: resolveFirefoxIcon(sp.avatar, "profile", browserIcon), color: toBadgeColor(sp) };
}

/** "profiles" mode: each selectable profile becomes its own top-level entry. */
function resolveProfileGroupsAsFlatItems(
  selectable: FirefoxSelectableProfile[],
  isDefault: boolean,
  folderBasename: string,
  baseCommand: string[],
  browserIcon: string | string[] | undefined,
): ResolvedBrowserItem[] {
  return selectable.map((sp) => ({
    label: sp.name,
    command: [...baseCommand, "--profile", sp.dir, "-no-remote"],
    // Mark default only on the sp whose folder matches this toolkit profile
    isDefault: isDefault && sp.dir.split("/").at(-1) === folderBasename,
    ...spColors(sp, "profile", browserIcon),
  }));
}

/** "spaces" mode: nest selectable profiles as space buttons under one item. */
function resolveProfileGroupsAsSpaces(
  name: string,
  selectable: FirefoxSelectableProfile[],
  isDefault: boolean,
  baseCommand: string[],
  browserIcon: string | string[] | undefined,
): ResolvedBrowserItem[] {
  return [
    {
      label: name,
      command: [...baseCommand, "-P", name, "-no-remote"],
      isDefault,
      icon: resolveBrowserIcon(browserIcon),
      spaces: selectable.map((sp) => ({
        name: sp.name,
        command: [...baseCommand, "--profile", sp.dir, "-no-remote"],
        ...spColors(sp, "space"),
      })),
    },
  ];
}

/** A profile with real Zen workspaces and no Profile Groups match — reads its zen-sessions.jsonlz4. */
async function resolveZenWorkspaceItem(
  name: string,
  dir: string,
  isDefault: boolean,
  baseCommand: string[],
  browserIcon: string | string[] | undefined,
): Promise<ResolvedBrowserItem> {
  const spaces = (await readZenSpaces(dir)).map((space) => ({
    ...space,
    icon: resolveZenIcon(space.icon),
    command: [...baseCommand, "-P", name, "--zen-workspace", space.name, "-no-remote"],
  }));
  return {
    label: name,
    command: [...baseCommand, "-P", name, "-no-remote"],
    isDefault,
    icon: resolveBrowserIcon(browserIcon),
    ...(spaces.length > 0 && { spaces }),
  };
}

/** A profile with neither Profile Groups nor Zen workspaces. */
function resolvePlainProfileItem(
  name: string,
  isDefault: boolean,
  baseCommand: string[],
  browserIcon: string | string[] | undefined,
): ResolvedBrowserItem {
  return {
    label: name,
    command: [...baseCommand, "-P", name, "-no-remote"],
    isDefault,
    icon: resolveBrowserIcon(browserIcon),
  };
}

/**
 * Resolves a single toolkit profile to one or more menu items.
 *
 * Precedence when a profile has BOTH a Firefox Profile Groups match AND real
 * Zen workspaces: Profile Groups wins and the Zen workspaces are dropped —
 * the menu has one "spaces" slot per item, so the two can't both be shown.
 * This is a deliberate choice (not an accident of branch ordering), logged
 * so it's visible if it ever surprises someone.
 */
async function resolveOneProfile(
  { name, dir, folderBasename, isDefault }: ProfileEntry,
  selectableMap: Map<string, FirefoxSelectableProfile[]>,
  profileGroupsMode: ProfileGroupsMode,
  baseCommand: string[],
  browserIcon: string | string[] | undefined,
  spaceType: SpaceType | undefined,
  enabledSpaces: ReadonlySet<SpaceType>,
): Promise<ResolvedBrowserItem[]> {
  const selectable = selectableMap.get(folderBasename);
  const hasZenWorkspaces =
    spaceType === SpaceType.ZenWorkspaces && enabledSpaces.has(SpaceType.ZenWorkspaces);

  if (selectable != null) {
    if (hasZenWorkspaces) {
      console.log(
        `[browser-hub] profile "${name}" has both Firefox Profile Groups and Zen workspaces` +
          " — Profile Groups takes precedence, Zen workspaces are not shown",
      );
    }
    return profileGroupsMode === "profiles"
      ? resolveProfileGroupsAsFlatItems(
          selectable,
          isDefault,
          folderBasename,
          baseCommand,
          browserIcon,
        )
      : resolveProfileGroupsAsSpaces(name, selectable, isDefault, baseCommand, browserIcon);
  }

  return hasZenWorkspaces
    ? [await resolveZenWorkspaceItem(name, dir, isDefault, baseCommand, browserIcon)]
    : [resolvePlainProfileItem(name, isDefault, baseCommand, browserIcon)];
}

const DEFAULT_FIREFOX_OPTIONS: FirefoxOptions = {
  enabledSpaces: new Set(Object.values(SpaceType)),
  profileGroupsMode: "profiles",
};

/**
 * Resolves Firefox-family browsers (Firefox, LibreWolf, Waterfox, Floorp, Zen, etc.)
 * and their profiles.
 *
 * Profile Groups (Firefox 128+) handling depends on profileGroupsMode:
 * - "profiles": Each selectable profile becomes its own top-level menu entry
 * - "spaces": Selectable profiles are nested as space buttons under the matched profile
 * - "off": Firefox Profile Groups are ignored entirely
 *
 * Zen Browser workspaces are included when enabledSpaces has ZenWorkspaces and
 * the browser config has spaceType === SpaceType.ZenWorkspaces.
 */
export async function resolveFirefoxBrowsers(
  browsers: FirefoxBrowserConfig[],
  { enabledSpaces, profileGroupsMode }: FirefoxOptions = DEFAULT_FIREFOX_OPTIONS,
): Promise<ResolvedBrowserEntry[]> {
  const { fulfilled, rejected } = await settle(
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
          profiles.map((profile) =>
            resolveOneProfile(
              profile,
              selectableMap,
              profileGroupsMode,
              baseCommand,
              b.icon,
              b.spaceType,
              enabledSpaces,
            ),
          ),
        )
      ).flat();
      items.sort(compareByDefault);
      return { label: b.label, items };
    }),
  );
  for (const reason of rejected) {
    logError(reason as object, "[browser-hub] a Firefox-family browser failed to resolve");
  }
  return fulfilled.filter((e) => e.items.length > 0);
}
