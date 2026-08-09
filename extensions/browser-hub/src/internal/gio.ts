import Gio from "gi://Gio";
import GLib from "gi://GLib";
import GioUnix from "gi://GioUnix";

// GJS's own Promise wrapper for a Gio async/finish pair, stable since GJS
// 1.54 — see https://gjs.guide/guides/gjs/asynchronous-programming.html#promisify-helper.
// Strips the redundant leading boolean from an array-shaped finish() result
// (failure is signaled by rejection instead) — load_contents_async below
// resolves to [contents, etag], not [ok, contents, etag].
Gio._promisify(Gio.File.prototype, "load_contents_async", "load_contents_finish");
Gio._promisify(Gio.File.prototype, "replace_contents_async", "replace_contents_finish");
Gio._promisify(Gio.File.prototype, "enumerate_children_async", "enumerate_children_finish");

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

export async function readFileAsync(path: string): Promise<Uint8Array> {
  const file = Gio.File.new_for_path(path);
  const size = file.query_info("standard::size", Gio.FileQueryInfoFlags.NONE, null).get_size();
  if (size > MAX_READABLE_FILE_SIZE) {
    throw new Error(`refusing to read ${path}: ${size} bytes exceeds the read size limit`);
  }
  const [contents] = await file.load_contents_async(null);
  return contents;
}

export function readTextFileAsync(path: string): Promise<string> {
  return readFileAsync(path).then((bytes) => decoder.decode(bytes));
}

export async function writeTextFileAsync(path: string, contents: string): Promise<void> {
  const file = Gio.File.new_for_path(path);
  await file.replace_contents_async(
    new TextEncoder().encode(contents),
    null,
    false,
    Gio.FileCreateFlags.NONE,
    null,
  );
}

// DesktopAppInfo actually belongs to gio-unix-2.0 (GioUnix), not Gio itself.
// On at least one GJS build, reaching it off Gio returned null for every
// desktop ID instead of a real lookup — no error, just broken icons and a
// broken setDefaultBrowser() everywhere. @girs's own DesktopAppInfo type
// claims .new() always returns an instance; this hand-written one reflects
// what GJS actually does, which is return null for an unknown ID.
export type DesktopAppInfo = {
  get_string(key: string): string | null;
  get_icon(): Gio.Icon | null;
  set_as_default_for_type(contentType: string): void;
};

export function getDesktopAppInfo(desktopId: string): DesktopAppInfo | null {
  return GioUnix.DesktopAppInfo.new(desktopId) as unknown as DesktopAppInfo | null;
}

export type DirEntry = { name: string; type: Gio.FileType };

/**
 * Lists a directory's immediate entries (name + type), or [] if it doesn't
 * exist or can't be enumerated — callers apply their own name/type filter.
 */
export async function listDirEntries(dirPath: string, logContext: string): Promise<DirEntry[]> {
  try {
    const dir = Gio.File.new_for_path(dirPath);
    const enumerator = await dir.enumerate_children_async(
      "standard::name,standard::type",
      Gio.FileQueryInfoFlags.NONE,
      GLib.PRIORITY_DEFAULT,
      null,
    );
    const entries: DirEntry[] = [];
    let info: Gio.FileInfo | null;
    while ((info = enumerator.next_file(null)) !== null) {
      entries.push({ name: info.get_name(), type: info.get_file_type() });
    }
    enumerator.close(null);
    return entries;
  } catch (e: unknown) {
    logIfUnexpected(e, logContext);
    return [];
  }
}
