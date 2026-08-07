import Gio from "gi://Gio";
import GLib from "gi://GLib";

export const decoder = new TextDecoder();

/**
 * Rethrows `e` with `label` prepended to its message and the original error
 * preserved as `.cause` — used to tag a per-browser resolution failure with
 * which browser it was before it reaches a settle()-based error log that
 * would otherwise report only "a Firefox-family browser failed to resolve"
 * with no way to tell which one.
 */
export function tagError(label: string, e: unknown): never {
  throw new Error(`${label}: ${e instanceof Error ? e.message : String(e)}`, { cause: e });
}

function matchesIOError(e: unknown, code: number): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "matches" in e &&
    typeof (e as { matches: unknown }).matches === "function" &&
    (e as { matches: (domain: unknown, code: number) => boolean }).matches(Gio.IOErrorEnum, code)
  );
}

/**
 * Logs `e` unless it's a "file doesn't exist" error — that's the expected,
 * silent case for browsers/profiles/session files that simply aren't there
 * yet. A permission error is distinguished from other unexpected failures
 * (corrupt/undecodable content, a bug) since it points at a specific,
 * actionable fix (file ownership/permissions) rather than a code issue.
 */
export function logIfUnexpected(e: unknown, context: string): void {
  if (matchesIOError(e, Gio.IOErrorEnum.NOT_FOUND)) return;
  if (matchesIOError(e, Gio.IOErrorEnum.PERMISSION_DENIED)) {
    console.warn(`[browser-hub] permission denied: ${context}`);
    return;
  }
  logError(e as object, context);
}

// profiles.ini / Local State / zen-sessions.jsonlz4 / a Profile Groups
// .sqlite are all normally well under 1MB even with dozens of profiles —
// this is generous enough to never trip on real data, but still stops a
// corrupted or unexpectedly huge file from being read whole into memory
// and stalling the menu.
const MAX_READABLE_FILE_SIZE = 20 * 1024 * 1024; // 20MB

export function readFileAsync(path: string): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const file = Gio.File.new_for_path(path);
    let size: number;
    try {
      size = file.query_info("standard::size", Gio.FileQueryInfoFlags.NONE, null).get_size();
    } catch (e) {
      reject(e);
      return;
    }
    if (size > MAX_READABLE_FILE_SIZE) {
      reject(new Error(`refusing to read ${path}: ${size} bytes exceeds the read size limit`));
      return;
    }
    file.load_contents_async(null, (_source, result) => {
      try {
        const [, contents] = file.load_contents_finish(result);
        resolve(contents);
      } catch (e) {
        reject(e);
      }
    });
  });
}

export function readTextFileAsync(path: string): Promise<string> {
  return readFileAsync(path).then((bytes) => decoder.decode(bytes));
}

export function writeTextFileAsync(path: string, contents: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = Gio.File.new_for_path(path);
    file.replace_contents_bytes_async(
      new TextEncoder().encode(contents),
      null,
      false,
      Gio.FileCreateFlags.NONE,
      null,
      (_source, result) => {
        try {
          file.replace_contents_finish(result);
          resolve();
        } catch (e) {
          reject(e);
        }
      },
    );
  });
}

// Gio.DesktopAppInfo is Linux-specific (gio-unix-2.0) — present in GJS but
// absent from @girs types. Shared here since both default-browser.ts and
// internal/desktop-icon.ts need it.
export type DesktopAppInfo = {
  get_string(key: string): string | null;
  get_icon(): Gio.Icon | null;
  set_as_default_for_type(contentType: string): void;
};
const _DesktopAppInfo = (
  Gio as unknown as { DesktopAppInfo: { new: (id: string) => DesktopAppInfo | null } }
).DesktopAppInfo;

export function getDesktopAppInfo(desktopId: string): DesktopAppInfo | null {
  return _DesktopAppInfo.new(desktopId);
}

export type DirEntry = { name: string; type: Gio.FileType };

/**
 * Lists a directory's immediate entries (name + type), or [] if it doesn't
 * exist or can't be enumerated — callers apply their own name/type filter.
 */
export function listDirEntries(dirPath: string, logContext: string): Promise<DirEntry[]> {
  return new Promise((resolve) => {
    const dir = Gio.File.new_for_path(dirPath);
    dir.enumerate_children_async(
      "standard::name,standard::type",
      Gio.FileQueryInfoFlags.NONE,
      GLib.PRIORITY_DEFAULT,
      null,
      (_source, result) => {
        try {
          const enumerator = dir.enumerate_children_finish(result);
          const entries: DirEntry[] = [];
          let info: Gio.FileInfo | null;
          while ((info = enumerator.next_file(null)) !== null) {
            entries.push({ name: info.get_name(), type: info.get_file_type() });
          }
          enumerator.close(null);
          resolve(entries);
        } catch (e: unknown) {
          logIfUnexpected(e, logContext);
          resolve([]);
        }
      },
    );
  });
}
