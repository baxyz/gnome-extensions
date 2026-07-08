import Gio from "gi://Gio";

export const decoder = new TextDecoder();

/**
 * Logs `e` unless it's a "file doesn't exist" error — that's the expected,
 * silent case for browsers/profiles/session files that simply aren't there
 * yet. Anything else (permission denied, corrupt/undecodable content) is a
 * real signal that was previously swallowed with no diagnostic trail.
 */
export function logIfUnexpected(e: unknown, context: string): void {
  const isNotFound =
    typeof e === "object" &&
    e !== null &&
    "matches" in e &&
    typeof (e as { matches: unknown }).matches === "function" &&
    (e as { matches: (domain: unknown, code: number) => boolean }).matches(
      Gio.IOErrorEnum,
      Gio.IOErrorEnum.NOT_FOUND,
    );
  if (!isNotFound) {
    logError(e as object, context);
  }
}

export function readFileAsync(path: string): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const file = Gio.File.new_for_path(path);
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
