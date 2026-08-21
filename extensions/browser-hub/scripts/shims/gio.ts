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

// internal/gio.ts calls Gio._promisify(Gio.File.prototype, ...) at import
// time, patching this class's prototype — every Gio.File.new_for_path()
// instance needs to share it. See `promisify` below for the shim of
// _promisify itself.
class FakeGioFile {
  constructor(private filePath: string) {}

  get_parent() {
    return { get_path: (): string => nodepath.dirname(this.filePath) };
  }

  enumerate_children(_attrs: string, _flags: number, _cancel: null) {
    return makeEnumerator(this.filePath);
  }

  enumerate_children_async(
    _attrs: string,
    _flags: number,
    _priority: number,
    _cancel: null,
    cb: (src: null, res: { filePath: string }) => void,
  ) {
    cb(null, { filePath: this.filePath });
  }

  enumerate_children_finish(res: { filePath: string }) {
    return makeEnumerator(res.filePath);
  }

  query_info(_attrs: string, _flags: number, _cancel: null) {
    return { get_size: () => fs.statSync(this.filePath).size };
  }

  load_contents_async(_cancel: null, cb: (src: null, res: { filePath: string }) => void) {
    cb(null, { filePath: this.filePath });
  }

  // [true, contents]: real GJS's raw (non-promisified) finish() shape —
  // promisify() below strips the leading boolean.
  load_contents_finish(res: { filePath: string }): [boolean, Uint8Array] {
    return [true, new Uint8Array(fs.readFileSync(res.filePath))];
  }

  make_directory_with_parents(_cancel: null): boolean {
    fs.mkdirSync(this.filePath, { recursive: true });
    return true;
  }

  replace_contents_async(
    contents: Uint8Array,
    _etag: null,
    _makeBackup: boolean,
    _flags: number,
    _cancel: null,
    cb: (src: null, res: { filePath: string }) => void,
  ) {
    fs.writeFileSync(this.filePath, contents);
    cb(null, { filePath: this.filePath });
  }

  replace_contents_finish(_res: { filePath: string }): [boolean, string] {
    return [true, ""];
  }
}

function newFile(filePath: string): FakeGioFile {
  return new FakeGioFile(filePath);
}

/**
 * Shims GJS's own Gio._promisify: https://gjs.guide/guides/gjs/asynchronous-programming.html#promisify-helper
 * The real helper strips a leading boolean from an array-shaped finish()
 * result (the "did it succeed" flag becomes redundant once failure is
 * signaled via rejection instead) and passes through anything else unchanged.
 */
function promisify(
  proto: Record<string, (...args: unknown[]) => unknown>,
  asyncFn: string,
  finishFn: string,
): void {
  const original = proto[asyncFn];
  proto[asyncFn] = function (this: Record<string, (...args: unknown[]) => unknown>, ...args) {
    if (typeof args.at(-1) === "function") return original.apply(this, args);
    return new Promise((resolve, reject) => {
      original.call(this, ...args, (_source: unknown, result: unknown) => {
        try {
          const ret = this[finishFn](result);
          resolve(Array.isArray(ret) && typeof ret[0] === "boolean" ? ret.slice(1) : ret);
        } catch (e) {
          reject(e);
        }
      });
    });
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

/** Every `.desktop` basename across DESKTOP_SEARCH_DIRS — for Gio.AppInfo.get_all()'s shim below. */
function listDesktopIds(): string[] {
  const ids = new Set<string>();
  for (const dir of DESKTOP_SEARCH_DIRS) {
    let entries: string[] = [];
    try {
      entries = fs.readdirSync(dir);
    } catch {
      continue;
    }
    for (const name of entries) {
      if (name.endsWith(".desktop")) ids.add(name);
    }
  }
  return [...ids];
}

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
  // Object.assign, not a plain object literal: Gio._promisify(Gio.File.prototype, ...)
  // needs Gio.File itself to be the class (so .prototype resolves to
  // FakeGioFile.prototype) while still exposing new_for_path as if it were
  // a static factory, matching real Gio.File's own shape.
  File: Object.assign(FakeGioFile, { new_for_path: newFile }),
  _promisify: promisify,
  FileQueryInfoFlags,
  FileCreateFlags: { NONE: 0 },
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
    // findDesktopIdByExecutable()'s (internal/gio.ts) fallback for a Native
    // or Snap package whose guessed desktop id doesn't resolve — mirrors the
    // real Gio.AppInfo.get_all() by scanning every DESKTOP_SEARCH_DIRS entry.
    // get_commandline() carries the full (unsplit) Exec= value, needed for
    // findDesktopIdByExecutable's "env FOO=1 realbinary %u" fallback path.
    get_all: (): {
      get_id(): string;
      get_executable(): string | null;
      get_commandline(): string | null;
    }[] =>
      listDesktopIds().flatMap((desktopId) => {
        const fields = parseDesktopFile(desktopId);
        if (!fields) return [];
        const exec = fields["Exec"] ?? "";
        const executable = exec.split(/\s+/)[0] || null;
        return [
          {
            get_id: () => desktopId,
            get_executable: () => executable,
            get_commandline: () => exec || null,
          },
        ];
      }),
  },
};
