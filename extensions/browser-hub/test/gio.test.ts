import { describe, it, expect, vi } from "vitest";

type FakeFile = {
  path: string;
  size: number;
  contents: Uint8Array;
  present: boolean;
};

const files = new Map<string, FakeFile>();
// Separate from `files` above (a different shape, and writeTextFileAsync's
// own tests don't need query_info/load_contents at all) — written contents
// captured here for assertions.
const written = new Map<string, Uint8Array>();
let writeShouldFail = false;

function ioError(code: number): { matches: (domain: unknown, c: number) => boolean } {
  return { matches: (_domain: unknown, c: number) => c === code };
}

const NOT_FOUND = 1;
const PERMISSION_DENIED = 2;

// A real class (not a factory returning a fresh object per call): the
// production code under test calls Gio._promisify(Gio.File.prototype, ...)
// at import time, which needs an actual shared prototype to patch, the same
// way real GJS's Gio.File does.
class FakeGioFile {
  constructor(private path: string) {}

  query_info(_attrs: string, _flags: number, _cancel: null) {
    const f = files.get(this.path);
    if (!f || !f.present) throw ioError(NOT_FOUND);
    return { get_size: () => f.size };
  }

  load_contents_async(_cancel: null, cb: (src: null, res: { path: string }) => void) {
    cb(null, { path: this.path });
  }

  load_contents_finish(result: { path: string }) {
    const f = files.get(result.path);
    if (!f || !f.present) throw ioError(NOT_FOUND);
    if (f.size === -1) throw ioError(PERMISSION_DENIED);
    return [true, f.contents];
  }

  replace_contents_async(
    contents: Uint8Array,
    _etag: null,
    _makeBackup: boolean,
    _flags: number,
    _cancel: null,
    cb: (src: null, res: { path: string }) => void,
  ) {
    if (!writeShouldFail) written.set(this.path, contents);
    cb(null, { path: this.path });
  }

  replace_contents_finish(_result: { path: string }) {
    if (writeShouldFail) throw new Error("disk full");
    return [true, ""];
  }
}

// Mirrors GJS's real Gio._promisify (see internal/gio.ts) — strips a leading
// boolean from an array-shaped finish() result, passes through anything else.
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

vi.mock("gi://Gio", () => ({
  default: {
    FileQueryInfoFlags: { NONE: 0 },
    IOErrorEnum: { NOT_FOUND, PERMISSION_DENIED },
    File: Object.assign(FakeGioFile, { new_for_path: (path: string) => new FakeGioFile(path) }),
    _promisify: promisify,
    FileCreateFlags: { NONE: 0 },
  },
}));

// internal/gio.ts imports GLib too (unused by anything exercised here) —
// the import itself must still resolve under Node.
vi.mock("gi://GLib", () => ({ default: { PRIORITY_DEFAULT: 0 } }));

const { logIfUnexpected, readFileAsync, tagError, writeTextFileAsync } =
  await import("../src/internal/gio");

describe("logIfUnexpected", () => {
  it("stays silent for a NOT_FOUND error", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    globalThis.logError = spy;

    logIfUnexpected(ioError(NOT_FOUND), "context");

    expect(spy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    spy.mockRestore();
    warnSpy.mockRestore();
  });

  it("warns (not logError) for a PERMISSION_DENIED error", () => {
    const errorSpy = vi.fn();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    globalThis.logError = errorSpy;

    logIfUnexpected(ioError(PERMISSION_DENIED), "reading ~/.config/foo");

    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("permission denied: reading ~/.config/foo"),
    );
    warnSpy.mockRestore();
  });

  it("logs any other error via logError", () => {
    const errorSpy = vi.fn();
    globalThis.logError = errorSpy;
    const weirdError = new Error("disk on fire");

    logIfUnexpected(weirdError, "context");

    expect(errorSpy).toHaveBeenCalledWith(weirdError, "context");
  });
});

describe("tagError", () => {
  it("prepends the label to an Error's message and preserves it as cause", () => {
    const original = new Error("profiles.ini not found");
    expect(() => tagError("Firefox (classic)", original)).toThrowError(
      "Firefox (classic): profiles.ini not found",
    );
    try {
      tagError("Firefox (classic)", original);
    } catch (e) {
      expect((e as Error).cause).toBe(original);
    }
  });

  it("stringifies a non-Error thrown value", () => {
    expect(() => tagError("Chromium", "just a string")).toThrowError("Chromium: just a string");
  });
});

describe("readFileAsync", () => {
  it("resolves with the file's contents when under the size limit", async () => {
    const contents = new Uint8Array([1, 2, 3]);
    files.set("/small", { path: "/small", size: contents.byteLength, contents, present: true });

    await expect(readFileAsync("/small")).resolves.toEqual(contents);
  });

  it("rejects without reading the file's contents when it exceeds the size limit", async () => {
    files.set("/huge", {
      path: "/huge",
      size: 21 * 1024 * 1024,
      contents: new Uint8Array(),
      present: true,
    });

    await expect(readFileAsync("/huge")).rejects.toThrow(/exceeds the read size limit/);
  });
});

describe("writeTextFileAsync", () => {
  it("writes the given text, UTF-8 encoded", async () => {
    writeShouldFail = false;
    await writeTextFileAsync("/out/user.js", 'user_pref("a", true);');
    expect(written.get("/out/user.js")).toEqual(new TextEncoder().encode('user_pref("a", true);'));
  });

  it("rejects when the underlying write fails", async () => {
    writeShouldFail = true;
    await expect(writeTextFileAsync("/out/user.js", "x")).rejects.toThrow("disk full");
    writeShouldFail = false;
  });
});
