import Gio from "gi://Gio";
import GLib from "gi://GLib";
import GioUnix from "gi://GioUnix";

// See https://gjs.guide/guides/gjs/asynchronous-programming.html#promisify-helper
Gio._promisify(Gio.File.prototype, "load_contents_async", "load_contents_finish");
Gio._promisify(Gio.File.prototype, "replace_contents_async", "replace_contents_finish");
Gio._promisify(Gio.File.prototype, "enumerate_children_async", "enumerate_children_finish");
Gio._promisify(Gio.File.prototype, "delete_async", "delete_finish");

export const decoder = new TextDecoder();

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Rethrows `e` prefixed with `label`, so the log says which browser failed. */
export function tagError(label: string, e: unknown): never {
  throw new Error(`${label}: ${errorMessage(e)}`, { cause: e });
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

/** Logs `e`, except for a missing file, which is the normal case. */
export function logIfUnexpected(e: unknown, context: string): void {
  if (matchesIOError(e, Gio.IOErrorEnum.NOT_FOUND)) return;
  if (matchesIOError(e, Gio.IOErrorEnum.PERMISSION_DENIED)) {
    console.warn(`[browser-hub] permission denied: ${context}`);
    return;
  }
  logError(e as object, context);
}

// Real files are far smaller; this only guards against a corrupted one.
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

// DesktopAppInfo lives in GioUnix. new() returns null for an unknown id,
// which the @girs type doesn't say.
export type DesktopAppInfo = {
  get_string(key: string): string | null;
  get_icon(): Gio.Icon | null;
  set_as_default_for_type(contentType: string): void;
  launch(files: Gio.File[] | null, context: Gio.AppLaunchContext | null): boolean;
};

export function getDesktopAppInfo(desktopId: string): DesktopAppInfo | null {
  return GioUnix.DesktopAppInfo.new(desktopId) as unknown as DesktopAppInfo | null;
}

// These come from .desktop files, so get_string() works even though the
// generic GAppInfo type doesn't declare it.
type RegisteredBrowserAppInfo = {
  get_id(): string;
  get_executable(): string | null;
  get_commandline(): string | null;
  get_string(key: string): string | null;
  should_show(): boolean;
};

// Same query as GNOME Settings' default web browser picker.
const BROWSER_CONTENT_TYPE = "x-scheme-handler/http";

// Cleared on manual refresh and on disable.
let cachedRegisteredBrowsers: RegisteredBrowserAppInfo[] | null = null;

function getRegisteredBrowserAppInfos(): RegisteredBrowserAppInfo[] {
  if (cachedRegisteredBrowsers === null) {
    // should_show() also drops NoDisplay entries, get_all_for_type() doesn't.
    cachedRegisteredBrowsers = (
      Gio.AppInfo.get_all_for_type(BROWSER_CONTENT_TYPE) as unknown as RegisteredBrowserAppInfo[]
    ).filter((info) => info.should_show());
  }
  return cachedRegisteredBrowsers;
}

export function clearAppInfoListCache(): void {
  cachedRegisteredBrowsers = null;
}

/** Desktop id of the registered browser whose .desktop file has `key=value`. */
export function findDesktopIdByDesktopKey(key: string, value: string): string | null {
  return (
    getRegisteredBrowserAppInfos()
      .find((info) => info.get_string(key) === value)
      ?.get_id() ?? null
  );
}

// e.g. "MOZ_ENABLE_WAYLAND=1" in Exec="env MOZ_ENABLE_WAYLAND=1 firefox %u"
const ENV_ASSIGNMENT_RE = /^[A-Za-z_][A-Za-z0-9_]*=/;

/** Commandline tokens that could be the binary, without env, VAR=value or flags. */
function commandBinaryCandidates(info: RegisteredBrowserAppInfo): string[] {
  const commandline = info.get_commandline();
  if (!commandline) return [];
  return commandline
    .split(/\s+/)
    .filter((token) => token !== "" && token !== "env" && !ENV_ASSIGNMENT_RE.test(token))
    .filter((token) => !token.startsWith("-"));
}

/**
 * Desktop id of the registered browser that runs `binary`. Needed when
 * `<binary>.desktop` doesn't exist, e.g. Fedora's org.mozilla.firefox.desktop.
 */
export function findDesktopIdByExecutable(binary: string): string | null {
  const target = GLib.path_get_basename(binary);
  const match = getRegisteredBrowserAppInfos().find((info) => {
    const exe = info.get_executable();
    if (exe !== null && GLib.path_get_basename(exe) === target) return true;
    return commandBinaryCandidates(info).some((token) => GLib.path_get_basename(token) === target);
  });
  return match?.get_id() ?? null;
}

/**
 * Deletes `dir` recursively without following symlinks. Children are listed
 * first: changing a directory while enumerating it is unspecified in GIO.
 */
export async function deleteDirectoryAsync(dir: Gio.File): Promise<void> {
  const enumerator = await dir.enumerate_children_async(
    "standard::name,standard::type",
    Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS,
    GLib.PRIORITY_DEFAULT,
    null,
  );
  const children: { file: Gio.File; isDir: boolean }[] = [];
  let info: Gio.FileInfo | null;
  while ((info = enumerator.next_file(null)) !== null) {
    children.push({
      file: enumerator.get_child(info),
      isDir: info.get_file_type() === Gio.FileType.DIRECTORY,
    });
  }
  enumerator.close(null);

  for (const { file, isDir } of children) {
    if (isDir) await deleteDirectoryAsync(file);
    else await file.delete_async(GLib.PRIORITY_DEFAULT, null);
  }
  await dir.delete_async(GLib.PRIORITY_DEFAULT, null);
}

export type DirEntry = { name: string; type: Gio.FileType };

/** A directory's entries, or [] if it can't be read. */
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
