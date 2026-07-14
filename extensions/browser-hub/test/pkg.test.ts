import { describe, it, expect, vi, beforeEach } from "vitest";

const findProgramInPath = vi.fn((bin: string) => bin);
const fileTest = vi.fn(() => true);
vi.mock("gi://GLib", () => ({
  default: {
    find_program_in_path: findProgramInPath,
    file_test: fileTest,
    get_home_dir: () => "/home/user",
    getenv: () => null,
    FileTest: { EXISTS: 1 << 2, IS_DIR: 1 << 4 },
  },
}));

const { filterPresent, clearPkgResolutionCache, clearPathPresenceCache } =
  await import("../src/internal/pkg");
const { PackageManager } = await import("../src/taxonomy/package-manager.enum");

beforeEach(() => {
  findProgramInPath.mockClear();
  fileTest.mockClear();
  clearPkgResolutionCache();
  clearPathPresenceCache();
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
