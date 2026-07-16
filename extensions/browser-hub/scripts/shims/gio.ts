import * as fs from "fs";
import * as os from "os";
import * as nodepath from "path";
import { execSync } from "child_process";

const FileQueryInfoFlags = { NONE: 0 };
const FileType = { DIRECTORY: "directory" as const };

function makeEnumerator(dirPath: string) {
  let entries: fs.Dirent[] = [];
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    /* missing or unreadable */
  }
  let i = 0;
  return {
    next_file: (_cancel: null) => {
      const e = entries[i++];
      if (!e) return null;
      return {
        get_name: () => e.name,
        get_file_type: () => (e.isDirectory() ? FileType.DIRECTORY : ("file" as const)),
      };
    },
    close: (_cancel: null) => {},
  };
}

function newFile(filePath: string) {
  let _contents: Uint8Array | null = null;

  return {
    get_parent: () => ({
      get_path: (): string => nodepath.dirname(filePath),
    }),

    enumerate_children: (_attrs: string, _flags: number, _cancel: null) => {
      return makeEnumerator(filePath);
    },

    enumerate_children_async: (
      _attrs: string,
      _flags: number,
      _priority: number,
      _cancel: null,
      cb: (src: null, res: { filePath: string }) => void,
    ) => {
      cb(null, { filePath });
    },

    enumerate_children_finish: (res: { filePath: string }) => {
      return makeEnumerator(res.filePath);
    },

    load_contents_async: (_cancel: null, cb: (src: null, res: unknown) => void) => {
      try {
        _contents = new Uint8Array(fs.readFileSync(filePath));
      } catch {
        _contents = null;
      }
      cb(null, {});
    },

    load_contents_finish: (_res: unknown): [boolean, Uint8Array] => {
      if (!_contents) throw new Error(`Cannot read: ${filePath}`);
      return [true, _contents];
    },
  };
}

const DESKTOP_SEARCH_DIRS = [
  `${os.homedir()}/.local/share/applications`,
  `${os.homedir()}/.local/share/flatpak/exports/share/applications`,
  "/var/lib/flatpak/exports/share/applications",
  // snapd copies/renames each snap's own .desktop file into here as
  // "<snap>_<snap>.desktop" (see desktop-icon.ts's desktopIdFor) — confirmed
  // present here on a real system for Brave/Firefox/Opera snaps, missing
  // from this list caused pnpm check to report no icon for every snap
  // browser regardless of whether the real file existed.
  "/var/lib/snapd/desktop/applications",
  "/usr/share/applications",
  "/usr/local/share/applications",
];

function parseDesktopFile(desktopId: string): Record<string, string> | null {
  for (const dir of DESKTOP_SEARCH_DIRS) {
    try {
      const content = fs.readFileSync(`${dir}/${desktopId}`, "utf8");
      const fields: Record<string, string> = {};
      let inMainSection = false;
      for (const raw of content.split("\n")) {
        const line = raw.trim();
        if (line.startsWith("[")) {
          inMainSection = line === "[Desktop Entry]";
          continue;
        }
        if (!inMainSection) continue;
        const eq = line.indexOf("=");
        if (eq === -1) continue;
        fields[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
      }
      return fields;
    } catch {
      // try next dir
    }
  }
  return null;
}

export default {
  File: { new_for_path: newFile },
  FileQueryInfoFlags,
  FileType,
  DesktopAppInfo: {
    new: (desktopId: string) => {
      const fields = parseDesktopFile(desktopId);
      if (!fields) return null;
      return {
        get_string: (key: string): string | null => fields[key] ?? null,
        has_key: (key: string): boolean => key in fields,
        // Real Gio.DesktopAppInfo.get_icon() returns a themed/file Gio.Icon;
        // check-browsers.ts never renders it (no St under Node), so a plain
        // stub carrying the .desktop file's "Icon=" name is enough to prove
        // resolution succeeded without crashing.
        get_icon: (): { name: string } | null => (fields["Icon"] ? { name: fields["Icon"] } : null),
      };
    },
  },
  AppInfo: {
    get_default_for_uri_scheme: (_scheme: string) => {
      try {
        const desktopId = execSync("xdg-settings get default-web-browser", {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
        }).trim();
        if (!desktopId) return null;
        const fields = parseDesktopFile(desktopId);
        const name = fields?.["Name"] ?? desktopId.replace(/\.desktop$/, "");
        const executable = (fields?.["Exec"] ?? "").split(/\s+/)[0] || name;
        return {
          get_name: () => name,
          get_id: () => desktopId,
          get_executable: () => executable,
        };
      } catch {
        return null;
      }
    },
  },
};
