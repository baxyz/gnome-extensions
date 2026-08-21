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

/** `e.message` for a real Error, else its string form — for display or logging. */
export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * Rethrows `e` with `label` prepended to its message and the original error
 * preserved as `.cause` — used to tag a per-browser resolution failure with
 * which browser it was before it reaches a settle()-based error log that
 * would otherwise report only "a Firefox-family browser failed to resolve"
 * with no way to tell which one.
 */
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

// Scanning + parsing every installed .desktop file (below) isn't free —
// cached for the extension's lifetime, same rationale as pkg.ts's
// resolution cache. Cleared by clearAppInfoListCache() (called from
// desktop-icon.ts's clearDesktopIconCache(), itself called on manual
// refresh) so a newly-installed app is still picked up. Without this, every
// distinct binary/name that needs findDesktopIdByExecutable's fallback below
// would trigger its own full re-scan, even though they'd all see the exact
// same installed-app list.
let cachedAppInfoList: Gio.AppInfo[] | null = null;

function getAllAppInfos(): Gio.AppInfo[] {
  if (cachedAppInfoList === null) cachedAppInfoList = Gio.AppInfo.get_all() as Gio.AppInfo[];
  return cachedAppInfoList;
}

/** Clears the installed-app list cache. Called on extension disable and manual refresh. */
export function clearAppInfoListCache(): void {
  cachedAppInfoList = null;
}

// A leading "VAR=value" environment assignment (e.g. Exec="env
// MOZ_ENABLE_WAYLAND=1 firefox %u") — skipped when scanning an app's full
// commandline for its real binary token, below.
const ENV_ASSIGNMENT_RE = /^[A-Za-z_][A-Za-z0-9_]*=/;

/**
 * Every plausible "this is the real binary" token from `info`'s commandline,
 * for the cases where get_executable() alone doesn't cut it — an
 * Exec="env FOO=1 firefox %u" line (seen on some distros' wrapper scripts)
 * makes get_executable() return "env", not "firefox". get_commandline()
 * gives the fuller picture; flags and env-assignment tokens are filtered out
 * so a basename match against them can't produce a false positive.
 */
function commandBinaryCandidates(info: Gio.AppInfo): string[] {
  const commandline = info.get_commandline();
  if (!commandline) return [];
  return commandline
    .split(/\s+/)
    .filter((token) => token !== "" && token !== "env" && !ENV_ASSIGNMENT_RE.test(token))
    .filter((token) => !token.startsWith("-"));
}

/**
 * Finds the real desktop ID for a Native package (or, keyed by `name`
 * instead, a Snap package — see desktop-icon.ts's fallbackSearchTerm) by
 * scanning every installed app for one whose real binary matches — a
 * fallback for when `${binary}.desktop`/`${name}_${name}.desktop`
 * (desktop-icon.ts's desktopIdFor guesses) are wrong. Confirmed necessary on
 * Fedora: its Firefox RPM ships org.mozilla.firefox.desktop, not
 * firefox.desktop like Debian/Ubuntu's package, so the plain guess resolves
 * to nothing there. Same signal default-browser.ts's getDefaultBrowser()
 * already trusts to identify the OS default browser's real desktop file,
 * just applied to every installed app instead of only the current default.
 */
export function findDesktopIdByExecutable(binary: string): string | null {
  const target = GLib.path_get_basename(binary);
  const match = getAllAppInfos().find((info) => {
    const exe = info.get_executable();
    if (exe !== null && GLib.path_get_basename(exe) === target) return true;
    return commandBinaryCandidates(info).some((token) => GLib.path_get_basename(token) === target);
  });
  return match?.get_id() ?? null;
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
