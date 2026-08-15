import { describe, it, expect, vi, beforeEach } from "vitest";

const findProgramInPath = vi.fn((bin: string) => bin);
const fileTest = vi.fn(() => true);
// Default: not a symlink — the common case for a genuine native install.
// Individual isSnapLauncherShim tests below override this per-call to
// simulate a real snap shim (readlink -> .../snap).
const fileReadLink = vi.fn((_path: string): string => {
  throw new Error("not a symlink");
});
vi.mock("gi://GLib", () => ({
  default: {
    find_program_in_path: findProgramInPath,
    file_test: fileTest,
    get_home_dir: () => "/home/user",
    getenv: () => null,
    FileTest: { EXISTS: 1 << 2, IS_DIR: 1 << 4 },
    file_read_link: fileReadLink,
    path_get_basename: (p: string) => p.split("/").pop(),
  },
}));

// isSnapLauncherShim()'s wrapper-script check, reached once file_read_link
// above throws. Default: reading fails outright, same safe "not a shim"
// verdict a real permission-denied/unreadable path would get. Individual
// tests override readContent to simulate a real Ubuntu-style wrapper
// script's content.
let readContent = "";
let readShouldFail = true;
vi.mock("gi://Gio", () => ({
  default: {
    File: {
      new_for_path: () => ({
        read: () => {
          if (readShouldFail) throw new Error("not a real file");
          return {
            read_bytes: () => ({ get_data: () => new TextEncoder().encode(readContent) }),
            close: () => {},
          };
        },
      }),
    },
  },
}));

const { filterPresent, resolvePkg, clearPkgResolutionCache, clearPathPresenceCache } =
  await import("../src/internal/pkg");
const { PackageManager } = await import("../src/taxonomy/package-manager.enum");

beforeEach(() => {
  findProgramInPath.mockClear();
  fileTest.mockClear();
  fileReadLink.mockClear();
  fileReadLink.mockImplementation((_path: string) => {
    throw new Error("not a symlink");
  });
  readShouldFail = true;
  readContent = "";
  clearPkgResolutionCache();
  clearPathPresenceCache();
});

describe("resolvePkg: Native binaries that are actually snap shims", () => {
  it("rejects a binary whose PATH match is a symlink to snapd's own launcher", () => {
    fileReadLink.mockImplementation(() => "/usr/bin/snap");

    const pkg = resolvePkg({ manager: PackageManager.Native, binary: "opera" });

    expect(pkg).toBeNull();
  });

  it("rejects a binary that's really an Ubuntu-style wrapper script exec'ing the snap", () => {
    readShouldFail = false;
    readContent = '#!/bin/sh\nexec /snap/bin/firefox "$@"\n';

    const pkg = resolvePkg({ manager: PackageManager.Native, binary: "firefox" });

    expect(pkg).toBeNull();
  });

  it("still resolves a genuine native binary (real symlink target, not a script referencing a snap)", () => {
    readShouldFail = false;
    readContent = "\x7fELF"; // real binaries are never a shebang script

    const pkg = resolvePkg({ manager: PackageManager.Native, binary: "firefox" });

    expect(pkg).toEqual({
      manager: PackageManager.Native,
      binary: "firefox",
      desktopId: undefined,
    });
  });

  it("still resolves a genuine native binary that's a shell script unrelated to any snap", () => {
    readShouldFail = false;
    readContent = '#!/bin/sh\nexec /usr/lib/firefox/firefox "$@"\n';

    const pkg = resolvePkg({ manager: PackageManager.Native, binary: "firefox" });

    expect(pkg).toEqual({
      manager: PackageManager.Native,
      binary: "firefox",
      desktopId: undefined,
    });
  });
});

describe("filterPresent path-presence cache", () => {
  it("only calls GLib.file_test once per (test flag, path) across separate filterPresent calls", () => {
    const browsers = [
      {
        label: "Firefox",
        path: "/home/user/.mozilla/firefox/profiles.ini",
        pkg: { manager: PackageManager.Native, binary: "firefox" },
      },
    ];

    // Simulates resolveFirefoxBrowsers and resolveBrowsersRow both filtering
    // the same config in the same getBrowserEntries tick (see resolve-all.ts).
    filterPresent(browsers);
    filterPresent(browsers);

    expect(fileTest).toHaveBeenCalledTimes(1);
  });

  it("checks the same path again under a different test flag (EXISTS vs IS_DIR aren't conflated)", () => {
    const browsers = [
      {
        label: "Falkon",
        path: "/home/user/.config/falkon/profiles",
        pkg: { manager: PackageManager.Native, binary: "falkon" },
      },
    ];

    filterPresent(browsers, 1 << 4); // IS_DIR
    filterPresent(browsers); // default EXISTS

    expect(fileTest).toHaveBeenCalledTimes(2);
  });

  it("re-checks after clearPathPresenceCache (manual refresh picks up a newly-created path)", () => {
    const browsers = [
      {
        label: "Firefox",
        path: "/home/user/.mozilla/firefox/profiles.ini",
        pkg: { manager: PackageManager.Native, binary: "firefox" },
      },
    ];

    filterPresent(browsers);
    clearPathPresenceCache();
    filterPresent(browsers);

    expect(fileTest).toHaveBeenCalledTimes(2);
  });
});
