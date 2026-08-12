import { describe, it, expect, vi } from "vitest";

// The modules under test transitively import "gi://GLib" and "gi://Gio" at
// module scope (via internal/, firefox-spaces.ts, zen.ts) even though the
// pure parsing/command-building logic exercised here never calls into GJS —
// stub just enough of their surface for those modules to load under Node.
vi.mock("gi://GLib", () => ({
  default: {
    path_get_basename: (p: string) => p.split("/").filter(Boolean).pop() ?? "",
    path_get_dirname: (p: string) => {
      const parts = p.split("/").filter(Boolean);
      parts.pop();
      return `/${parts.join("/")}`;
    },
    find_program_in_path: () => null,
    file_test: () => false,
    get_home_dir: () => "/home/user",
    getenv: () => null,
    FileTest: { EXISTS: 1 << 2, IS_DIR: 1 << 4, IS_REGULAR: 1 << 3 },
  },
}));

// internal/desktop-icon.ts (transitively imported) also imports
// "gi://GdkPixbuf" to validate .desktop icons before use — irrelevant to
// what this file tests, so a stub that always "succeeds" is enough for the
// module to load under Node.
vi.mock("gi://GdkPixbuf", () => ({
  default: {
    Pixbuf: { new_from_file_at_size: () => ({ get_width: () => 1, get_height: () => 1 }) },
  },
}));

// internal/gio.ts calls Gio._promisify(Gio.File.prototype, ...) at module
// scope on import, which needs an actual prototype to patch even though
// nothing here exercises the promisified methods themselves.
class FakeGioFile {
  load_contents_async() {}
}

vi.mock("gi://Gio", () => ({
  default: {
    File: Object.assign(FakeGioFile, { new_for_path: () => new FakeGioFile() }),
    _promisify: () => {},
    FileQueryInfoFlags: { NONE: 0 },
    FileType: { DIRECTORY: "directory" },
    Subprocess: { new: () => ({}) },
    SubprocessFlags: { NONE: 0 },
    IOErrorEnum: { NOT_FOUND: 1 },
  },
}));

// internal/gio.ts also imports GioUnix (unused by anything exercised here).
vi.mock("gi://GioUnix", () => ({ default: { DesktopAppInfo: { new: () => null } } }));

// firefox.ts/chromium.ts import the icons module, which checks icon presence
// via St.IconTheme — stub it as "everything is present" since icon-theme
// availability itself is covered by icons.test.ts, not this file.
vi.mock("gi://St", () => ({
  default: {
    IconTheme: class {
      has_icon() {
        return true;
      }
    },
  },
}));

const { parseProfiles: parseFirefoxProfiles } = await import("../src/browser/firefox");
const { parseProfiles: parseChromiumProfiles } = await import("../src/browser/chromium");
const { zenSpaceColor } = await import("../src/browser/zen");
const { argbToRgb } = await import("@helpers4/color");
const { buildBaseCommand } = await import("../src/internal/pkg");
const { PackageManager } = await import("../src/taxonomy/package-manager.enum");

describe("firefox profiles.ini parsing", () => {
  it("marks the legacy Default=1 profile as default when there is no Install section", () => {
    const ini = [
      "[Profile0]",
      "Name=default",
      "IsRelative=1",
      "Path=abc.default",
      "Default=1",
      "",
      "[Profile1]",
      "Name=work",
      "IsRelative=1",
      "Path=xyz.work",
    ].join("\n");

    const profiles = parseFirefoxProfiles(ini, "/home/user/.mozilla/firefox");
    expect(profiles).toEqual([
      {
        name: "default",
        dir: "/home/user/.mozilla/firefox/abc.default",
        folderBasename: "abc.default",
        isDefault: true,
      },
      {
        name: "work",
        dir: "/home/user/.mozilla/firefox/xyz.work",
        folderBasename: "xyz.work",
        isDefault: false,
      },
    ]);
  });

  it("prefers the [InstallXXXX] Default= path over a stale legacy Default=1 flag", () => {
    const ini = [
      "[Profile0]",
      "Name=default",
      "IsRelative=1",
      "Path=abc.default",
      "Default=1",
      "",
      "[Profile1]",
      "Name=work",
      "IsRelative=1",
      "Path=xyz.work",
      "",
      "[Install4F96D1932A9F858E]",
      "Default=xyz.work",
      "Locked=1",
    ].join("\n");

    const profiles = parseFirefoxProfiles(ini, "/home/user/.mozilla/firefox");
    const byName = Object.fromEntries(profiles.map((p) => [p.name, p.isDefault]));
    expect(byName).toEqual({ default: false, work: true });
  });

  it("uses an absolute path as-is when IsRelative is not set", () => {
    const ini = ["[Profile0]", "Name=portable", "Path=/mnt/usb/firefox-profile"].join("\n");

    const profiles = parseFirefoxProfiles(ini, "/home/user/.mozilla/firefox");
    expect(profiles).toEqual([
      {
        name: "portable",
        dir: "/mnt/usb/firefox-profile",
        folderBasename: "firefox-profile",
        isDefault: false,
      },
    ]);
  });

  it("skips sections missing Name or Path", () => {
    const ini = [
      "[Profile0]",
      "IsRelative=1",
      "Path=abc.default",
      "",
      "[General]",
      "StartWithLastProfile=1",
    ].join("\n");

    expect(parseFirefoxProfiles(ini, "/home/user/.mozilla/firefox")).toEqual([]);
  });
});

describe("zenSpaceColor", () => {
  it("prefers the color flagged isPrimary over the first one", () => {
    const color = zenSpaceColor({
      type: "gradient",
      gradientColors: [
        { c: [10, 20, 30], isPrimary: false },
        { c: [40, 50, 60], isPrimary: true },
      ],
    });
    expect(color).toBe("rgb(40,50,60)");
  });

  it("falls back to the first color when none is flagged isPrimary", () => {
    const color = zenSpaceColor({
      type: "gradient",
      gradientColors: [{ c: [10, 20, 30] }, { c: [40, 50, 60] }],
    });
    expect(color).toBe("rgb(10,20,30)");
  });

  it("returns undefined for a non-gradient theme type", () => {
    expect(zenSpaceColor({ type: "solid", gradientColors: [{ c: [1, 2, 3] }] })).toBeUndefined();
  });

  it("returns undefined when gradientColors is empty or missing", () => {
    expect(zenSpaceColor({ type: "gradient", gradientColors: [] })).toBeUndefined();
    expect(zenSpaceColor({ type: "gradient" })).toBeUndefined();
  });

  it("returns undefined when theme itself is absent", () => {
    expect(zenSpaceColor(undefined)).toBeUndefined();
  });
});

describe("chromium Local State parsing", () => {
  it("converts an ARGB int to an rgb() string", () => {
    expect(argbToRgb(0xff112233)).toBe("rgb(17,34,51)");
  });

  it("marks the last_used profile as default", () => {
    const localState = JSON.stringify({
      profile: {
        last_used: "Profile 2",
        info_cache: {
          Default: { name: "Person 1" },
          "Profile 2": { name: "Person 2", background_color: 0xff112233 },
        },
      },
    });

    const profiles = parseChromiumProfiles(localState);
    expect(profiles).toEqual([
      { dir: "Default", name: "Person 1", isDefault: false, bgColor: undefined },
      { dir: "Profile 2", name: "Person 2", isDefault: true, bgColor: "rgb(17,34,51)" },
    ]);
  });

  it("falls back to dir when name is missing entirely", () => {
    const localState = JSON.stringify({
      profile: { info_cache: { Default: {} } },
    });

    expect(parseChromiumProfiles(localState)).toEqual([
      { dir: "Default", name: "Default", isDefault: false, bgColor: undefined },
    ]);
  });

  it("falls back to dir when name is an empty string (Opera writes this instead of omitting the key)", () => {
    const localState = JSON.stringify({
      profile: { info_cache: { Default: { name: "" } } },
    });

    expect(parseChromiumProfiles(localState)).toEqual([
      { dir: "Default", name: "Default", isDefault: false, bgColor: undefined },
    ]);
  });

  it("returns an empty list for malformed JSON instead of throwing", () => {
    expect(() => parseChromiumProfiles("{not json")).not.toThrow();
    expect(parseChromiumProfiles("{not json")).toEqual([]);
  });

  it("skips a null/malformed info_cache entry instead of losing every profile in the file", () => {
    // A crash mid-write can leave one entry null/wrong-shaped while the rest
    // of Local State is intact valid JSON — only the bad entry should be lost.
    const localState = JSON.stringify({
      profile: {
        info_cache: {
          Default: { name: "Person 1" },
          "Profile 2": null,
        },
      },
    });

    expect(() => parseChromiumProfiles(localState)).not.toThrow();
    expect(parseChromiumProfiles(localState)).toEqual([
      { dir: "Default", name: "Person 1", isDefault: false, bgColor: undefined },
    ]);
  });
});

describe("buildBaseCommand", () => {
  it("returns argv arrays, never a pre-joined string", () => {
    expect(buildBaseCommand({ manager: PackageManager.Native, binary: "firefox" })).toEqual([
      "firefox",
    ]);
    expect(
      buildBaseCommand({ manager: PackageManager.Flatpak, appId: "org.mozilla.firefox" }),
    ).toEqual(["flatpak", "run", "org.mozilla.firefox"]);
    expect(buildBaseCommand({ manager: PackageManager.Snap, name: "firefox" })).toEqual([
      "snap",
      "run",
      "firefox",
    ]);
  });
});
