import { describe, it, expect, vi, beforeEach } from "vitest";
import { fakeGioPromisify } from "./helpers/fake-gio-promisify";

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
    path_get_basename: (p: string) => p.split("/").at(-1) ?? p,
    PRIORITY_DEFAULT: 0,
  },
}));

// internal/desktop-icon.ts (transitively imported) also imports
// "gi://GdkPixbuf" to validate .desktop icons before use, and "gi://St" for
// its symbolic-icon fallback — both irrelevant to what this file tests, so
// stubs that always "succeed"/"don't match" are enough for the module to
// load under Node.
vi.mock("gi://GdkPixbuf", () => ({
  default: {
    Pixbuf: { new_from_file_at_size: () => ({ get_width: () => 1, get_height: () => 1 }) },
  },
}));
vi.mock("gi://St", () => ({
  default: {
    IconTheme: class {
      has_icon() {
        return false;
      }
    },
  },
}));

type FakeDir = { made: boolean };
const dirs = new Map<string, FakeDir>();
const written = new Map<string, Uint8Array>();
const subprocessNew = vi.fn();

// donut-browser.ts imports internal/gio.ts, which calls
// Gio._promisify(Gio.File.prototype, ...) at import time, patching this
// class's prototype — every instance needs to share it.
class FakeGioFile {
  constructor(private path: string) {}

  make_directory_with_parents(_cancellable: null) {
    dirs.set(this.path, { made: true });
    return true;
  }

  replace_contents_async(
    contents: Uint8Array,
    _etag: null,
    _makeBackup: boolean,
    _flags: number,
    _cancel: null,
    cb: (src: null, res: { path: string }) => void,
  ) {
    written.set(this.path, contents);
    cb(null, { path: this.path });
  }

  replace_contents_finish(_result: { path: string }) {
    return [true, ""];
  }
}

vi.mock("gi://Gio", () => ({
  default: {
    File: Object.assign(FakeGioFile, { new_for_path: (path: string) => new FakeGioFile(path) }),
    _promisify: fakeGioPromisify,
    FileCreateFlags: { NONE: 0 },
    Subprocess: { new: subprocessNew },
    SubprocessFlags: { NONE: 0 },
  },
}));

// desktop-icon.ts (part of the same "./internal" barrel) references this via
// GioUnix — never called from anything exercised here, but the barrel still
// evaluates that module's top-level code on import.
vi.mock("gi://GioUnix", () => ({
  default: { DesktopAppInfo: { new: () => null } },
}));

const { filterDonutEligible, findDonutBrowser, createDonutProfile, launchDonutBrowser } =
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

describe("filterDonutEligible", () => {
  it("keeps only DONUT_ELIGIBLE browsers with a resolved pkg, excluding Snap", () => {
    const browsers = [
      { label: "Firefox", command: ["firefox"], pkg: FIREFOX_NATIVE },
      { label: "Firefox (snap)", command: ["snap"], pkg: FIREFOX_SNAP },
      { label: "Tor Browser", command: ["tor"], pkg: FIREFOX_NATIVE },
      { label: "Chromium", command: ["chromium"] }, // no pkg
    ];

    expect(filterDonutEligible(browsers).map((b) => b.label)).toEqual(["Firefox"]);
  });

  it("is what findDonutBrowser's own eligibility narrows down from — used by the Donut picker page", () => {
    const browsers = [
      { label: "Waterfox", command: ["waterfox"], pkg: FIREFOX_NATIVE },
      { label: "Zen", command: ["zen"], pkg: ZEN_FLATPAK },
    ];

    expect(filterDonutEligible(browsers)).toHaveLength(2);
  });
});

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
    // First-run wizard/onboarding suppression — see DONUT_USER_JS's comment
    // for why a fresh profile needs these to open ready-to-use.
    expect(text).toContain('user_pref("browser.aboutwelcome.enabled", false);');
    expect(text).toContain('user_pref("browser.migration.version", 9999);');
    expect(text).toContain('user_pref("browser.shell.checkDefaultBrowser", false);');
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
