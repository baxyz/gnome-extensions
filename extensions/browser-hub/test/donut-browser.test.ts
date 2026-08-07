import { describe, it, expect, vi, beforeEach } from "vitest";

// donut-browser.ts imports from "./internal", which loads the whole
// internal/index.ts barrel — including pkg.ts, which reads GLib.get_home_dir()
// at module scope even though nothing here exercises package resolution.
// Needs a stub so the import itself resolves under Node (same pattern as
// menu.test.ts), extended with what donut-browser.ts itself actually calls:
// build_filenamev/uuid_string_random for the profile path, getenv for
// XDG_RUNTIME_DIR.
let uuidCounter = 0;
vi.mock("gi://GLib", () => ({
  default: {
    get_home_dir: () => "/home/user",
    getenv: (name: string) => (name === "XDG_RUNTIME_DIR" ? "/run/user/1000" : null),
    get_tmp_dir: () => "/tmp",
    find_program_in_path: () => null,
    build_filenamev: (parts: string[]) => parts.join("/"),
    uuid_string_random: () => `uuid-${++uuidCounter}`,
    PRIORITY_DEFAULT: 0,
  },
}));

type FakeDir = { made: boolean };
const dirs = new Map<string, FakeDir>();
const written = new Map<string, Uint8Array>();
const subprocessNew = vi.fn();

vi.mock("gi://Gio", () => ({
  default: {
    File: {
      new_for_path: (path: string) => ({
        make_directory_with_parents: (_cancellable: null) => {
          dirs.set(path, { made: true });
          return true;
        },
        replace_contents_bytes_async: (
          contents: Uint8Array,
          _etag: null,
          _makeBackup: boolean,
          _flags: number,
          _cancel: null,
          cb: (src: null, res: { path: string }) => void,
        ) => {
          written.set(path, contents);
          cb(null, { path });
        },
        replace_contents_finish: (_result: { path: string }) => [true, ""],
      }),
    },
    FileCreateFlags: { NONE: 0 },
    Subprocess: { new: subprocessNew },
    SubprocessFlags: { NONE: 0 },
    // desktop-icon.ts (part of the same "./internal" barrel) references these
    // — never called from anything exercised here, but the barrel still
    // evaluates that module's top-level code on import.
    DesktopAppInfo: { new: () => null },
  },
}));

const { findDonutBrowser, createDonutProfile, launchDonutBrowser } =
  await import("../src/donut-browser");
const { PackageManager } = await import("../src/taxonomy/package-manager.enum");

beforeEach(() => {
  dirs.clear();
  written.clear();
  subprocessNew.mockClear();
  uuidCounter = 0;
});

const FIREFOX_NATIVE = { manager: PackageManager.Native, binary: "firefox" } as const;
const ZEN_FLATPAK = { manager: PackageManager.Flatpak, appId: "app.zen_browser.zen" } as const;
const FIREFOX_SNAP = { manager: PackageManager.Snap, name: "firefox" } as const;

describe("findDonutBrowser", () => {
  it("picks the current default browser when it's itself eligible", () => {
    const browsers = [
      { label: "Zen", command: ["zen"], pkg: ZEN_FLATPAK },
      { label: "Firefox", command: ["firefox"], pkg: FIREFOX_NATIVE },
    ];
    const defaultBrowser = { name: "Firefox", command: ["firefox"], pkg: FIREFOX_NATIVE };

    expect(findDonutBrowser(browsers, defaultBrowser)?.label).toBe("Firefox");
  });

  it("falls back to DONUT_PRIORITY order when the default isn't eligible (or there is none)", () => {
    const browsers = [
      { label: "Waterfox", command: ["waterfox"], pkg: FIREFOX_NATIVE },
      { label: "Zen", command: ["zen"], pkg: ZEN_FLATPAK },
    ];
    // Default is Chromium-family — not in the eligible set at all.
    const defaultBrowser = {
      name: "Chromium",
      command: ["chromium"],
      pkg: { manager: PackageManager.Native, binary: "chromium" } as const,
    };

    expect(findDonutBrowser(browsers, defaultBrowser)?.label).toBe("Zen"); // ranked above Waterfox
    expect(findDonutBrowser(browsers, null)?.label).toBe("Zen");
  });

  it("strips packaging-variant suffixes before matching against the priority list", () => {
    const browsers = [{ label: "Firefox (flatpak)", command: ["flatpak"], pkg: ZEN_FLATPAK }];
    expect(findDonutBrowser(browsers, null)?.label).toBe("Firefox (flatpak)");
  });

  it("excludes snap-packaged browsers even when otherwise eligible", () => {
    const browsers = [{ label: "Firefox (snap)", command: ["snap"], pkg: FIREFOX_SNAP }];
    expect(findDonutBrowser(browsers, null)).toBeNull();
  });

  it("excludes browsers not on the eligible list at all (e.g. Tor Browser, Basilisk)", () => {
    const browsers = [
      { label: "Tor Browser", command: ["tor"], pkg: FIREFOX_NATIVE },
      { label: "Basilisk", command: ["basilisk"], pkg: FIREFOX_NATIVE },
    ];
    expect(findDonutBrowser(browsers, null)).toBeNull();
  });

  it("falls back to whatever eligible browser comes first when none match the priority list", () => {
    const browsers = [{ label: "IceCat", command: ["icecat"], pkg: FIREFOX_NATIVE }];
    expect(findDonutBrowser(browsers, null)?.label).toBe("IceCat");
  });

  it("returns null when no browser is present at all", () => {
    expect(findDonutBrowser([], null)).toBeNull();
  });
});

describe("createDonutProfile", () => {
  it("creates a fresh directory under $XDG_RUNTIME_DIR and writes a minimal RFP user.js into it", async () => {
    const dir = await createDonutProfile();

    expect(dir).toBe(`/run/user/1000/browser-hub/donut/uuid-1`);
    expect(dirs.get(dir)).toEqual({ made: true });
    const contents = written.get(`${dir}/user.js`);
    expect(contents).toBeDefined();
    const text = new TextDecoder().decode(contents);
    expect(text).toContain('user_pref("privacy.resistFingerprinting", true);');
    expect(text).toContain('user_pref("browser.privatebrowsing.autostart", true);');
  });

  it("uses a fresh directory on every call", async () => {
    const first = await createDonutProfile();
    const second = await createDonutProfile();
    expect(first).not.toBe(second);
  });
});

describe("launchDonutBrowser", () => {
  it("launches a Native browser with --profile pointed at the new directory", async () => {
    await launchDonutBrowser(
      { label: "Firefox", command: ["firefox"], pkg: FIREFOX_NATIVE },
      "Browser Hub",
      vi.fn(),
    );

    expect(subprocessNew).toHaveBeenCalledWith(
      ["firefox", "--profile", "/run/user/1000/browser-hub/donut/uuid-1", "-no-remote"],
      0,
    );
  });

  it("launches a Flatpak browser with an ad-hoc --filesystem grant for the profile dir", async () => {
    await launchDonutBrowser(
      { label: "Zen", command: ["flatpak", "run", "app.zen_browser.zen"], pkg: ZEN_FLATPAK },
      "Browser Hub",
      vi.fn(),
    );

    const profileDir = "/run/user/1000/browser-hub/donut/uuid-1";
    expect(subprocessNew).toHaveBeenCalledWith(
      [
        "flatpak",
        "run",
        `--filesystem=${profileDir}`,
        "app.zen_browser.zen",
        "--profile",
        profileDir,
        "-no-remote",
      ],
      0,
    );
  });
});
