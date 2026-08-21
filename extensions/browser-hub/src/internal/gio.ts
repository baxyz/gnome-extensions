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
  launch(files: Gio.File[] | null, context: Gio.AppLaunchContext | null): boolean;
};

export function getDesktopAppInfo(desktopId: string): DesktopAppInfo | null {
  return GioUnix.DesktopAppInfo.new(desktopId) as unknown as DesktopAppInfo | null;
}

// A GAppInfo shape that on Linux is really always a GDesktopAppInfo under
// the hood (confirmed by getRegisteredBrowserAppInfos() below only ever
// sourcing from desktop files) — get_string() isn't part of the generic
// GAppInfo interface @girs types get_all_for_type() as returning, but the
// concrete objects support it regardless, same reasoning as
// getDesktopAppInfo()'s own cast above.
type RegisteredBrowserAppInfo = {
  get_id(): string;
  get_executable(): string | null;
  get_commandline(): string | null;
  get_string(key: string): string | null;
};

// The freedesktop content type every real browser registers as a handler
// for — GNOME Settings' own "Web" default-app picker is built on exactly
// this same query (as is this project's own getDefaultBrowser(), via
// get_default_for_uri_scheme("http")). A far more targeted, GNOME-native
// pool for the identity-based fallbacks below than "every installed app":
// something that isn't a registered http handler isn't a browser as far as
// the desktop itself is concerned, whatever its binary is named. Also
// naturally excludes non-browser lookalikes for free — e.g. Fedora's
// epiphany-runtime (a dependency-only package providing /usr/bin/epiphany
// with no .desktop file at all) was already excluded by never resolving a
// desktop id in the first place; this pool additionally excludes anything
// that has a .desktop file but never registered as a browser.
const BROWSER_CONTENT_TYPE = "x-scheme-handler/http";

// Scanning + parsing every installed .desktop file (below) isn't free —
// cached for the extension's lifetime, same rationale as pkg.ts's
// resolution cache. Cleared by clearAppInfoListCache() (called from
// desktop-icon.ts's clearDesktopIconCache(), itself called on manual
// refresh) so a newly-installed browser is still picked up. Without this,
// every distinct pkg needing an identity-based fallback below would trigger
// its own full re-scan, even though they'd all see the exact same list.
let cachedRegisteredBrowsers: RegisteredBrowserAppInfo[] | null = null;

function getRegisteredBrowserAppInfos(): RegisteredBrowserAppInfo[] {
  if (cachedRegisteredBrowsers === null) {
    cachedRegisteredBrowsers = Gio.AppInfo.get_all_for_type(
      BROWSER_CONTENT_TYPE,
    ) as unknown as RegisteredBrowserAppInfo[];
  }
  return cachedRegisteredBrowsers;
}

/** Clears the registered-browsers list cache. Called on extension disable and manual refresh. */
export function clearAppInfoListCache(): void {
  cachedRegisteredBrowsers = null;
}

/**
 * Finds a registered browser's desktop ID by an exact desktop-file key
 * match — e.g. "X-SnapInstanceName", the field snapd itself injects to name
 * the snap instance a .desktop file belongs to. This is the authoritative
 * identity signal packaging tools use for exactly this purpose (the same
 * field default-browser.ts's detectPkg() already trusts, just in the
 * opposite direction: desktop id -> pkg instead of pkg -> desktop id),
 * rather than a guessed naming convention.
 */
export function findDesktopIdByDesktopKey(key: string, value: string): string | null {
  return (
    getRegisteredBrowserAppInfos()
      .find((info) => info.get_string(key) === value)
      ?.get_id() ?? null
  );
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
function commandBinaryCandidates(info: RegisteredBrowserAppInfo): string[] {
  const commandline = info.get_commandline();
  if (!commandline) return [];
  return commandline
    .split(/\s+/)
    .filter((token) => token !== "" && token !== "env" && !ENV_ASSIGNMENT_RE.test(token))
    .filter((token) => !token.startsWith("-"));
}

/**
 * Finds a registered browser's desktop ID by its real binary — the fallback
 * for Native packages, which (unlike Flatpak/Snap) have no packaging-tool-
 * injected identity field to match on instead: freedesktop has no standard
 * "which distro package provides this .desktop file" key. Used when
 * `${binary}.desktop` (desktop-icon.ts's desktopIdFor guess) is wrong.
 * Confirmed necessary on Fedora: its Firefox RPM ships
 * org.mozilla.firefox.desktop, not firefox.desktop like Debian/Ubuntu's
 * package, so the plain guess resolves to nothing there.
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
