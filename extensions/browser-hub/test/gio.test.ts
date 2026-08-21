import { describe, it, expect, vi } from "vitest";
import { fakeGioPromisify } from "./helpers/fake-gio-promisify";

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

// The production code under test calls Gio._promisify(Gio.File.prototype, ...)
// at import time, patching this class's prototype — every instance needs to
// share it.
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

// Fake installed-app list for findDesktopIdByExecutable() — each entry's
// commandline is independent of its "executable" so tests can exercise the
// env-wrapper fallback path (get_executable() alone wouldn't find it).
type FakeAppInfo = { id: string; executable: string | null; commandline: string | null };
let installedApps: FakeAppInfo[] = [];
const appInfoGetAll = vi.fn(() =>
  installedApps.map((a) => ({
    get_id: () => a.id,
    get_executable: () => a.executable,
    get_commandline: () => a.commandline,
  })),
);

vi.mock("gi://Gio", () => ({
  default: {
    FileQueryInfoFlags: { NONE: 0 },
    IOErrorEnum: { NOT_FOUND, PERMISSION_DENIED },
    File: Object.assign(FakeGioFile, { new_for_path: (path: string) => new FakeGioFile(path) }),
    _promisify: fakeGioPromisify,
    FileCreateFlags: { NONE: 0 },
    AppInfo: { get_all: () => appInfoGetAll() },
  },
}));

// internal/gio.ts imports GLib and GioUnix too — GLib's path_get_basename is
// exercised by findDesktopIdByExecutable() below.
vi.mock("gi://GLib", () => ({
  default: {
    PRIORITY_DEFAULT: 0,
    path_get_basename: (p: string) => p.split("/").filter(Boolean).pop() ?? "",
  },
}));
vi.mock("gi://GioUnix", () => ({ default: { DesktopAppInfo: { new: () => null } } }));

const {
  clearAppInfoListCache,
  findDesktopIdByExecutable,
  logIfUnexpected,
  readFileAsync,
  tagError,
  writeTextFileAsync,
} = await import("../src/internal/gio");

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

describe("findDesktopIdByExecutable", () => {
  beforeEach(() => {
    installedApps = [];
    appInfoGetAll.mockClear();
    clearAppInfoListCache();
  });

  it("matches by get_executable()'s basename", () => {
    installedApps = [
      {
        id: "org.mozilla.firefox.desktop",
        executable: "/usr/lib/firefox/firefox",
        commandline: null,
      },
    ];

    expect(findDesktopIdByExecutable("firefox")).toBe("org.mozilla.firefox.desktop");
  });

  it("returns null when no installed app's executable matches", () => {
    installedApps = [{ id: "unrelated.desktop", executable: "unrelated", commandline: null }];

    expect(findDesktopIdByExecutable("firefox")).toBeNull();
  });

  it('falls back to the commandline when get_executable() is a wrapper (e.g. Exec="env FOO=1 firefox %u")', () => {
    installedApps = [
      {
        id: "org.mozilla.firefox.desktop",
        executable: "env",
        commandline: "env MOZ_ENABLE_WAYLAND=1 firefox %u",
      },
    ];

    expect(findDesktopIdByExecutable("firefox")).toBe("org.mozilla.firefox.desktop");
  });

  it("doesn't mistake a flag or an env-assignment token in the commandline for the binary", () => {
    installedApps = [
      {
        id: "decoy.desktop",
        executable: "launcher",
        commandline: "launcher --profile=firefox FIREFOX_PROFILE=firefox -x",
      },
    ];

    expect(findDesktopIdByExecutable("firefox")).toBeNull();
  });

  it("scans the installed-app list once, sharing it across multiple distinct lookups", () => {
    installedApps = [{ id: "a.desktop", executable: "a", commandline: null }];

    findDesktopIdByExecutable("a");
    findDesktopIdByExecutable("b");
    findDesktopIdByExecutable("c");

    expect(appInfoGetAll).toHaveBeenCalledTimes(1);
  });

  it("clearAppInfoListCache() forces a fresh scan", () => {
    installedApps = [{ id: "a.desktop", executable: "a", commandline: null }];

    findDesktopIdByExecutable("a");
    clearAppInfoListCache();
    findDesktopIdByExecutable("a");

    expect(appInfoGetAll).toHaveBeenCalledTimes(2);
  });
});
