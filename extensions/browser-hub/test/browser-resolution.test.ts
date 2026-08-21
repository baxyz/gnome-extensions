import { describe, it, expect, vi, beforeEach } from "vitest";
import { fakeGioPromisify } from "./helpers/fake-gio-promisify";

// Assert on the browser resolvers' OBSERVABLE output (what ends up in
// ResolvedBrowserEntry[]) rather than internal shape, so a resolver's own
// implementation can change without these needing to follow along.

type FsEntry = { type: "file"; content: Uint8Array } | { type: "dir"; names: string[] };
const fs = new Map<string, FsEntry>();
const encoder = new TextEncoder();

function setFile(path: string, text: string): void {
  fs.set(path, { type: "file", content: encoder.encode(text) });
}
function setDir(path: string, names: string[]): void {
  fs.set(path, { type: "dir", names });
}
function resetFs(): void {
  fs.clear();
}

function notFoundError(): { matches: (domain: unknown, code: number) => boolean } {
  return { matches: (_domain: unknown, code: number) => code === 1 };
}

const FAKE_ICON = { __fakeIcon: true };
// Set to true only by the one test simulating a crash reachable from
// resolveBrowsersRow (GNOME Web's real desktopId, org.gnome.Epiphany.desktop)
// — reset every test so it doesn't break every other test that expects
// GNOME Web to resolve normally.
let epiphanyIconThrows = false;

// logError is a GJS ambient global — no test here previously exercised a
// genuine rejected/thrown path, so it was never stubbed. Stub it so a test
// that deliberately forces a throw asserts on the resolved return value
// instead of failing on an unrelated "logError is not defined".
globalThis.logError = () => {};

vi.mock("gi://GLib", () => ({
  default: {
    path_get_basename: (p: string) => p.split("/").filter(Boolean).pop() ?? "",
    path_get_dirname: (p: string) => {
      const parts = p.split("/").filter(Boolean);
      parts.pop();
      return `/${parts.join("/")}`;
    },
    // Every configured binary is treated as installed — these tests are about
    // resolution/branching logic, not package-presence detection.
    find_program_in_path: (bin: string) => bin,
    file_test: (path: string, test: number) => {
      const entry = fs.get(path);
      if (!entry) return false;
      if (test === 1 << 4) return entry.type === "dir"; // IS_DIR
      return true; // EXISTS (matches file or dir)
    },
    get_home_dir: () => "/home/user",
    getenv: () => null,
    PRIORITY_DEFAULT: 0,
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

// The resolvers under test import internal/gio.ts, which calls
// Gio._promisify(Gio.File.prototype, ...) at import time, patching this
// class's prototype — every instance needs to share it.
class FakeGioFile {
  constructor(private path: string) {}

  query_info(_attrs: string, _flags: number, _cancellable: null) {
    const entry = fs.get(this.path);
    if (!entry || entry.type !== "file") throw notFoundError();
    return { get_size: () => entry.content.byteLength };
  }

  load_contents_async(
    _cancellable: null,
    callback: (source: unknown, result: { path: string }) => void,
  ) {
    callback(null, { path: this.path });
  }

  load_contents_finish(result: { path: string }) {
    const entry = fs.get(result.path);
    if (!entry || entry.type !== "file") throw notFoundError();
    return [true, entry.content];
  }

  enumerate_children_async(
    _attrs: string,
    _flags: number,
    _prio: number,
    _cancellable: null,
    callback: (source: unknown, result: { path: string }) => void,
  ) {
    callback(null, { path: this.path });
  }

  enumerate_children_finish(result: { path: string }) {
    const entry = fs.get(result.path);
    if (!entry || entry.type !== "dir") throw notFoundError();
    let i = 0;
    return {
      next_file: () =>
        i < entry.names.length
          ? {
              get_name: () => entry.names[i++],
              get_file_type: () => "directory",
            }
          : null,
      close: () => {},
    };
  }
}

vi.mock("gi://Gio", () => ({
  default: {
    File: Object.assign(FakeGioFile, { new_for_path: (path: string) => new FakeGioFile(path) }),
    _promisify: fakeGioPromisify,
    FileQueryInfoFlags: { NONE: 0 },
    FileType: { DIRECTORY: "directory" },
    Subprocess: { new: () => ({}) },
    SubprocessFlags: { NONE: 0 },
    IOErrorEnum: { NOT_FOUND: 1 },
    // findDesktopIdByExecutable()'s fallback source (internal/gio.ts) — no
    // installed app in this file's fixtures, so an empty list keeps every
    // guessed-id-doesn't-resolve case falling through exactly as before.
    AppInfo: { get_all: () => [] },
  },
}));

// Only "iconbrowser.desktop" resolves to a real icon (used to verify the
// browser icon lands on the entry, not on every profile item) — every
// other guessed desktop id (the "firefox"/"chromium"/"falkon" binaries
// used throughout this file) matches nothing, same as before.
// "org.gnome.Epiphany.desktop" (GNOME Web's real desktopId) throws when
// epiphanyIconThrows is set — used by one test to simulate a crash
// reachable only from resolveBrowsersRow (SIMPLE_BROWSERS entries are
// never touched by the family resolvers).
vi.mock("gi://GioUnix", () => ({
  default: {
    DesktopAppInfo: {
      new: (id: string) => {
        if (id === "iconbrowser.desktop") return { get_icon: () => FAKE_ICON };
        if (id === "org.gnome.Epiphany.desktop" && epiphanyIconThrows) {
          return {
            get_icon: () => {
              throw new Error("simulated icon crash");
            },
          };
        }
        return null;
      },
    },
  },
}));

// Icon-theme availability is covered by icons.test.ts — default everything to
// present here so these tests stay focused on resolution/branching.
vi.mock("gi://St", () => ({
  default: {
    IconTheme: class {
      has_icon() {
        return true;
      }
    },
  },
}));

// Not real SQLite/mozlz4 — these tests exercise OUR row/space handling, not
// sqlite-reader's or mozlz4's own parsing (each has its own test suite).
// Store rows/spaces as plain JSON text in the virtual filesystem and have the
// mocks decode it back out.
vi.mock("sqlite-reader", () => ({
  readTable: (data: Uint8Array) => JSON.parse(new TextDecoder().decode(data)),
}));
vi.mock("mozlz4", () => ({
  decodeMozLz4: (data: Uint8Array) => data,
}));

const { resolveFirefoxBrowsers } = await import("../src/browser/firefox");
const { resolveChromiumBrowsers } = await import("../src/browser/chromium");
const { resolveFalkonBrowsers } = await import("../src/browser/falkon");
const { getBrowserEntries } = await import("../src/browser");
const { clearPkgResolutionCache, clearPathPresenceCache, clearDesktopIconCache } =
  await import("../src/internal");
const { PackageManager } = await import("../src/taxonomy/package-manager.enum");
const { BrowserType } = await import("../src/taxonomy/browser-type.enum");
const { SpaceType } = await import("../src/taxonomy/space-type.enum");

beforeEach(() => {
  resetFs();
  // pkgResolutionCache/pathPresenceCache/desktopIconCache (internal/pkg.ts,
  // internal/desktop-icon.ts) are module-level singletons that outlive any
  // single test — without clearing them here, a later test whose fixture
  // flips a path from present to absent (or vice versa) after resetFs()
  // would silently read an earlier test's stale cached answer instead of
  // the freshly-mocked filesystem state.
  clearPkgResolutionCache();
  clearPathPresenceCache();
  clearDesktopIconCache();
  epiphanyIconThrows = false;
});

describe("resolveFirefoxBrowsers", () => {
  const pkg = { manager: PackageManager.Native, binary: "firefox" };

  function profilesIni(entries: { name: string; path: string; isDefault?: boolean }[]): string {
    return entries
      .map(
        (e, i) =>
          `[Profile${i}]\nName=${e.name}\nIsRelative=1\nPath=${e.path}${e.isDefault ? "\nDefault=1" : ""}`,
      )
      .join("\n\n");
  }

  it("resolves a plain profile with no Profile Groups and no Zen workspaces", async () => {
    setFile(
      "/home/user/.mozilla/firefox/profiles.ini",
      profilesIni([{ name: "default", path: "abc.default", isDefault: true }]),
    );

    const entries = await resolveFirefoxBrowsers([
      {
        type: BrowserType.Firefox,
        label: "Firefox",
        path: "/home/user/.mozilla/firefox/profiles.ini",
        pkg,
      },
    ]);

    expect(entries).toEqual([
      {
        label: "Firefox",
        // No .desktop app installed in this test's DesktopAppInfo mock —
        // falls back to the "<binary>-symbolic" icon (this file's St mock
        // reports every icon name as present, see "Icon-theme availability"
        // comment above).
        icon: "firefox-symbolic",
        items: [
          {
            label: "default",
            command: ["firefox", "-P", "default", "-no-remote"],
            isDefault: true,
            icon: undefined,
          },
        ],
      },
    ]);
  });

  it("attaches the browser's real icon to the entry, never as a fallback on a plain profile item", async () => {
    setFile(
      "/home/user/.mozilla/firefox/profiles.ini",
      profilesIni([{ name: "default", path: "abc.default", isDefault: true }]),
    );

    const entries = await resolveFirefoxBrowsers([
      {
        type: BrowserType.Firefox,
        label: "Firefox",
        path: "/home/user/.mozilla/firefox/profiles.ini",
        pkg: { manager: PackageManager.Native, binary: "iconbrowser" },
      },
    ]);

    expect(entries[0].icon).toBe(FAKE_ICON);
    expect(entries[0].items[0].icon).toBeUndefined();
  });

  it("attaches Zen workspaces when there's no Profile Groups match for that profile", async () => {
    setFile(
      "/home/user/.zen/profiles.ini",
      profilesIni([{ name: "default", path: "abc.default", isDefault: true }]),
    );
    setFile(
      "/home/user/.zen/abc.default/zen-sessions.jsonlz4",
      // Real stored format (confirmed against the project's own
      // sample/zen-sessions.json) — a full chrome://.../<name>.svg URI, not
      // a bare name. "briefcase" has no Adwaita equivalent (see icon-catalog.ts).
      JSON.stringify({
        spaces: [
          {
            uuid: "u1",
            name: "Work",
            icon: "chrome://browser/skin/zen-icons/selectable/briefcase.svg",
          },
        ],
      }),
    );

    const entries = await resolveFirefoxBrowsers([
      {
        type: BrowserType.Firefox,
        label: "Zen",
        path: "/home/user/.zen/profiles.ini",
        pkg: { manager: PackageManager.Native, binary: "zen-browser" },
        spaceType: SpaceType.ZenWorkspaces,
      },
    ]);

    expect(entries[0].items[0].spaces).toEqual([
      {
        uuid: "u1",
        name: "Work",
        icon: expect.any(String), // resolveZenIcon's fallback (dot) since "briefcase" is unmapped
        command: ["zen-browser", "-P", "default", "--zen-workspace", "Work", "-no-remote"],
      },
    ]);
  });

  it("resolves the profile itself even when its zen-sessions.jsonlz4 has a malformed (non-array) spaces value", async () => {
    setFile(
      "/home/user/.zen/profiles.ini",
      profilesIni([{ name: "default", path: "abc.default", isDefault: true }]),
    );
    // Valid JSON, wrong shape — e.g. left behind by a crash mid-save.
    setFile("/home/user/.zen/abc.default/zen-sessions.jsonlz4", JSON.stringify({ spaces: 0 }));

    const entries = await resolveFirefoxBrowsers([
      {
        type: BrowserType.Firefox,
        label: "Zen",
        path: "/home/user/.zen/profiles.ini",
        pkg: { manager: PackageManager.Native, binary: "zen-browser" },
        spaceType: SpaceType.ZenWorkspaces,
      },
    ]);

    expect(entries[0].items[0].label).toBe("default");
    expect(entries[0].items[0].spaces).toBeUndefined();
  });

  it("resolves a mapped Zen workspace icon from the real chrome://.../<name>.svg format, end to end", async () => {
    setFile(
      "/home/user/.zen/profiles.ini",
      profilesIni([{ name: "default", path: "abc.default", isDefault: true }]),
    );
    setFile(
      "/home/user/.zen/abc.default/zen-sessions.jsonlz4",
      JSON.stringify({
        spaces: [
          {
            uuid: "u1",
            name: "Night",
            icon: "chrome://browser/skin/zen-icons/selectable/moon.svg",
          },
        ],
      }),
    );

    const entries = await resolveFirefoxBrowsers([
      {
        type: BrowserType.Firefox,
        label: "Zen",
        path: "/home/user/.zen/profiles.ini",
        pkg: { manager: PackageManager.Native, binary: "zen-browser" },
        spaceType: SpaceType.ZenWorkspaces,
      },
    ]);

    expect(entries[0].items[0].spaces?.[0].icon).toBe("weather-clear-night-symbolic");
  });

  it("extracts a Zen workspace's gradient theme as bgColor, preferring the primary color", async () => {
    setFile(
      "/home/user/.zen/profiles.ini",
      profilesIni([{ name: "default", path: "abc.default", isDefault: true }]),
    );
    setFile(
      "/home/user/.zen/abc.default/zen-sessions.jsonlz4",
      JSON.stringify({
        spaces: [
          {
            uuid: "u1",
            name: "Work",
            icon: "chrome://browser/skin/zen-icons/selectable/briefcase.svg",
            theme: {
              type: "gradient",
              gradientColors: [
                { c: [10, 20, 30], isPrimary: false },
                { c: [40, 50, 60], isPrimary: true },
              ],
            },
          },
        ],
      }),
    );

    const entries = await resolveFirefoxBrowsers([
      {
        type: BrowserType.Firefox,
        label: "Zen",
        path: "/home/user/.zen/profiles.ini",
        pkg: { manager: PackageManager.Native, binary: "zen-browser" },
        spaceType: SpaceType.ZenWorkspaces,
      },
    ]);

    expect(entries[0].items[0].spaces?.[0].bgColor).toBe("rgb(40,50,60)");
  });

  it("leaves bgColor undefined for a Zen workspace with no gradient theme", async () => {
    setFile(
      "/home/user/.zen/profiles.ini",
      profilesIni([{ name: "default", path: "abc.default", isDefault: true }]),
    );
    setFile(
      "/home/user/.zen/abc.default/zen-sessions.jsonlz4",
      JSON.stringify({
        spaces: [{ uuid: "u1", name: "Work", icon: "chrome://.../briefcase.svg" }],
      }),
    );

    const entries = await resolveFirefoxBrowsers([
      {
        type: BrowserType.Firefox,
        label: "Zen",
        path: "/home/user/.zen/profiles.ini",
        pkg: { manager: PackageManager.Native, binary: "zen-browser" },
        spaceType: SpaceType.ZenWorkspaces,
      },
    ]);

    expect(entries[0].items[0].spaces?.[0].bgColor).toBeUndefined();
  });

  it("flattens Profile Groups selectable profiles as top-level items in 'profiles' mode", async () => {
    setFile(
      "/home/user/.mozilla/firefox/profiles.ini",
      profilesIni([{ name: "default", path: "abc.default", isDefault: true }]),
    );
    setDir("/home/user/.mozilla/firefox/Profile Groups", ["group.sqlite"]);
    setFile(
      "/home/user/.mozilla/firefox/Profile Groups/group.sqlite",
      JSON.stringify([
        { path: "abc.default", name: "Work", avatar: "star" },
        { path: "xyz.second", name: "Personal", avatar: "book" },
      ]),
    );

    const entries = await resolveFirefoxBrowsers(
      [
        {
          type: BrowserType.Firefox,
          label: "Firefox",
          path: "/home/user/.mozilla/firefox/profiles.ini",
          pkg,
        },
      ],
      { enabledSpaces: new Set(), profileGroupsMode: "profiles" },
    );

    expect(entries[0].items).toHaveLength(2);
    expect(entries[0].items.map((i) => i.label).sort()).toEqual(["Personal", "Work"]);
    // Only the sp whose folder matches the toolkit profile's own folder keeps isDefault.
    const work = entries[0].items.find((i) => i.label === "Work");
    expect(work?.isDefault).toBe(true);
    const personal = entries[0].items.find((i) => i.label === "Personal");
    expect(personal?.isDefault).toBe(false);
  });

  it("passes through a foreground-only theme color as fgColor, with no bgColor pill", async () => {
    setFile(
      "/home/user/.mozilla/firefox/profiles.ini",
      profilesIni([{ name: "default", path: "abc.default", isDefault: true }]),
    );
    setDir("/home/user/.mozilla/firefox/Profile Groups", ["group.sqlite"]);
    setFile(
      "/home/user/.mozilla/firefox/Profile Groups/group.sqlite",
      // A group DB needs >= 2 rows to be treated as a real Profile Groups
      // install (see firefox-spaces.ts) — "Personal" has no theme color at
      // all, only "Work" (the one under test) has a foreground-only color.
      JSON.stringify([
        { path: "abc.default", name: "Work", avatar: "star", themeFg: "#ffffff" },
        { path: "xyz.second", name: "Personal", avatar: "book" },
      ]),
    );

    const entries = await resolveFirefoxBrowsers(
      [
        {
          type: BrowserType.Firefox,
          label: "Firefox",
          path: "/home/user/.mozilla/firefox/profiles.ini",
          pkg,
        },
      ],
      { enabledSpaces: new Set(), profileGroupsMode: "profiles" },
    );

    const work = entries[0].items.find((i) => i.label === "Work");
    expect(work?.color).toEqual({ mode: "badge", fgColor: "#ffffff" });
  });

  it("passes through both a foreground and background theme color", async () => {
    setFile(
      "/home/user/.mozilla/firefox/profiles.ini",
      profilesIni([{ name: "default", path: "abc.default", isDefault: true }]),
    );
    setDir("/home/user/.mozilla/firefox/Profile Groups", ["group.sqlite"]);
    setFile(
      "/home/user/.mozilla/firefox/Profile Groups/group.sqlite",
      JSON.stringify([
        {
          path: "abc.default",
          name: "Work",
          avatar: "star",
          themeFg: "#ffffff",
          themeBg: "#20123a",
        },
        { path: "xyz.second", name: "Personal", avatar: "book" },
      ]),
    );

    const entries = await resolveFirefoxBrowsers(
      [
        {
          type: BrowserType.Firefox,
          label: "Firefox",
          path: "/home/user/.mozilla/firefox/profiles.ini",
          pkg,
        },
      ],
      { enabledSpaces: new Set(), profileGroupsMode: "profiles" },
    );

    const work = entries[0].items.find((i) => i.label === "Work");
    expect(work?.color).toEqual({ mode: "badge", fgColor: "#ffffff", bgColor: "#20123a" });
  });

  it("nests Profile Groups selectable profiles as spaces under one item in 'spaces' mode", async () => {
    setFile(
      "/home/user/.mozilla/firefox/profiles.ini",
      profilesIni([{ name: "default", path: "abc.default", isDefault: true }]),
    );
    setDir("/home/user/.mozilla/firefox/Profile Groups", ["group.sqlite"]);
    setFile(
      "/home/user/.mozilla/firefox/Profile Groups/group.sqlite",
      JSON.stringify([
        { path: "abc.default", name: "Work", avatar: "star" },
        { path: "xyz.second", name: "Personal", avatar: "book" },
      ]),
    );

    const entries = await resolveFirefoxBrowsers(
      [
        {
          type: BrowserType.Firefox,
          label: "Firefox",
          path: "/home/user/.mozilla/firefox/profiles.ini",
          pkg,
        },
      ],
      { enabledSpaces: new Set(), profileGroupsMode: "spaces" },
    );

    expect(entries[0].items).toHaveLength(1);
    expect(entries[0].items[0].label).toBe("default");
    expect(entries[0].items[0].spaces?.map((s) => s.name).sort()).toEqual(["Personal", "Work"]);
    // "Work"'s folder (abc.default) matches this toolkit profile's own
    // folder — only it should be marked default among the nested spaces.
    const work = entries[0].items[0].spaces?.find((s) => s.name === "Work");
    const personal = entries[0].items[0].spaces?.find((s) => s.name === "Personal");
    expect(work?.isDefault).toBe(true);
    expect(personal?.isDefault).toBe(false);
  });

  it("renders a Profile Groups member's group only once, even when a second member is also its own separately-listed toolkit profile", async () => {
    setFile(
      "/home/user/.mozilla/firefox/profiles.ini",
      profilesIni([
        { name: "default", path: "abc.default", isDefault: true },
        { name: "second", path: "xyz.second" },
      ]),
    );
    setDir("/home/user/.mozilla/firefox/Profile Groups", ["group.sqlite"]);
    setFile(
      "/home/user/.mozilla/firefox/Profile Groups/group.sqlite",
      JSON.stringify([
        { path: "abc.default", name: "Work", avatar: "star" },
        { path: "xyz.second", name: "Personal", avatar: "book" },
      ]),
    );

    const entries = await resolveFirefoxBrowsers(
      [
        {
          type: BrowserType.Firefox,
          label: "Firefox",
          path: "/home/user/.mozilla/firefox/profiles.ini",
          pkg,
        },
      ],
      { enabledSpaces: new Set(), profileGroupsMode: "profiles" },
    );

    // Both toolkit profiles (abc.default AND xyz.second) map to the SAME
    // selectable group — it must render once (2 items total), not once per
    // toolkit profile that happens to belong to it (which would be 4).
    expect(entries[0].items.map((i) => i.label).sort()).toEqual(["Personal", "Work"]);
  });

  it("deterministically picks the alphabetically-first Profile Groups database when two conflict over the same toolkit profile", async () => {
    setFile(
      "/home/user/.mozilla/firefox/profiles.ini",
      profilesIni([{ name: "default", path: "abc.default", isDefault: true }]),
    );
    setDir("/home/user/.mozilla/firefox/Profile Groups", ["a.sqlite", "b.sqlite"]);
    setFile(
      "/home/user/.mozilla/firefox/Profile Groups/a.sqlite",
      JSON.stringify([
        { path: "abc.default", name: "FromA1", avatar: "star" },
        { path: "xyz.other-a", name: "FromA2", avatar: "book" },
      ]),
    );
    setFile(
      "/home/user/.mozilla/firefox/Profile Groups/b.sqlite",
      JSON.stringify([
        { path: "abc.default", name: "FromB1", avatar: "star" },
        { path: "xyz.other-b", name: "FromB2", avatar: "book" },
      ]),
    );

    const entries = await resolveFirefoxBrowsers(
      [
        {
          type: BrowserType.Firefox,
          label: "Firefox",
          path: "/home/user/.mozilla/firefox/profiles.ini",
          pkg,
        },
      ],
      { enabledSpaces: new Set(), profileGroupsMode: "profiles" },
    );

    // "a.sqlite" sorts before "b.sqlite" — its group wins deterministically,
    // regardless of which db file's read happened to settle first.
    expect(entries[0].items.map((i) => i.label).sort()).toEqual(["FromA1", "FromA2"]);
  });

  it("only reads the first 50 .sqlite files (sorted) in a Profile Groups directory", async () => {
    setFile(
      "/home/user/.mozilla/firefox/profiles.ini",
      profilesIni([{ name: "default", path: "abc.default", isDefault: true }]),
    );
    // 51 files, sorted alphabetically "file00.sqlite".."file50.sqlite" — only
    // the last one (excluded by the cap) gets real content, so its group
    // showing up in the result would mean the cap didn't apply.
    const names = Array.from({ length: 51 }, (_, i) => `file${String(i).padStart(2, "0")}.sqlite`);
    setDir("/home/user/.mozilla/firefox/Profile Groups", names);
    setFile(
      "/home/user/.mozilla/firefox/Profile Groups/file50.sqlite",
      JSON.stringify([
        { path: "abc.default", name: "ShouldBeSkipped", avatar: "star" },
        { path: "xyz.other", name: "AlsoSkipped", avatar: "book" },
      ]),
    );

    const entries = await resolveFirefoxBrowsers(
      [
        {
          type: BrowserType.Firefox,
          label: "Firefox",
          path: "/home/user/.mozilla/firefox/profiles.ini",
          pkg,
        },
      ],
      { enabledSpaces: new Set(), profileGroupsMode: "profiles" },
    );

    expect(entries[0].items.map((i) => i.label)).not.toContain("ShouldBeSkipped");
    expect(entries[0].items.map((i) => i.label)).toEqual(["default"]);
  });

  it("ignores Profile Groups entirely when profileGroupsMode is 'off'", async () => {
    setFile(
      "/home/user/.mozilla/firefox/profiles.ini",
      profilesIni([{ name: "default", path: "abc.default", isDefault: true }]),
    );
    setDir("/home/user/.mozilla/firefox/Profile Groups", ["group.sqlite"]);
    setFile(
      "/home/user/.mozilla/firefox/Profile Groups/group.sqlite",
      JSON.stringify([
        { path: "abc.default", name: "Work", avatar: "star" },
        { path: "xyz.second", name: "Personal", avatar: "book" },
      ]),
    );

    const entries = await resolveFirefoxBrowsers(
      [
        {
          type: BrowserType.Firefox,
          label: "Firefox",
          path: "/home/user/.mozilla/firefox/profiles.ini",
          pkg,
        },
      ],
      { enabledSpaces: new Set(), profileGroupsMode: "off" },
    );

    expect(entries[0].items).toEqual([
      {
        label: "default",
        command: ["firefox", "-P", "default", "-no-remote"],
        isDefault: true,
        icon: undefined,
      },
    ]);
  });

  it("CURRENT BEHAVIOR (locked down, not necessarily desired): Profile Groups shadows Zen workspaces entirely when a profile has both", async () => {
    setFile(
      "/home/user/.zen/profiles.ini",
      profilesIni([{ name: "default", path: "abc.default", isDefault: true }]),
    );
    setFile(
      "/home/user/.zen/abc.default/zen-sessions.jsonlz4",
      JSON.stringify({ spaces: [{ uuid: "u1", name: "Work", icon: "briefcase" }] }),
    );
    setDir("/home/user/.zen/Profile Groups", ["group.sqlite"]);
    setFile(
      "/home/user/.zen/Profile Groups/group.sqlite",
      // readFirefoxSelectableProfiles ignores a group DB with <= 1 row (not a
      // real "group" yet) — needs a second member for the match to register.
      JSON.stringify([
        { path: "abc.default", name: "Work Profile", avatar: "star" },
        { path: "xyz.second", name: "Personal Profile", avatar: "book" },
      ]),
    );

    const entries = await resolveFirefoxBrowsers(
      [
        {
          type: BrowserType.Firefox,
          label: "Zen",
          path: "/home/user/.zen/profiles.ini",
          pkg: { manager: PackageManager.Native, binary: "zen-browser" },
          spaceType: SpaceType.ZenWorkspaces,
        },
      ],
      { enabledSpaces: new Set([SpaceType.ZenWorkspaces]), profileGroupsMode: "profiles" },
    );

    // Zen's "Work" workspace (zen-sessions.jsonlz4) never appears — Profile
    // Groups' flattened items win instead. See Phase 3 of the rework plan:
    // this precedence becomes an explicit, logged decision.
    expect(entries[0].items.map((i) => i.label).sort()).toEqual([
      "Personal Profile",
      "Work Profile",
    ]);
    expect(entries[0].items.some((i) => i.label === "Work")).toBe(false);
  });
});

describe("resolveChromiumBrowsers", () => {
  it("marks the last_used profile as default, sorts default-first-then-alphabetical, and flags the color dot", async () => {
    setFile(
      "/home/user/.config/chromium/Local State",
      JSON.stringify({
        profile: {
          info_cache: {
            Default: { name: "Zeta", background_color: 0xff112233 },
            "Profile 1": { name: "Alpha" },
          },
          last_used: "Default",
        },
      }),
    );

    const entries = await resolveChromiumBrowsers([
      {
        type: BrowserType.Chromium,
        label: "Chromium",
        path: "/home/user/.config/chromium/Local State",
        pkg: { manager: PackageManager.Native, binary: "chromium" },
      },
    ]);

    expect(entries[0].items).toEqual([
      expect.objectContaining({
        label: "Zeta",
        isDefault: true,
        color: { mode: "dot", bgColor: "rgb(17,34,51)" },
      }),
      expect.objectContaining({ label: "Alpha", isDefault: false }),
    ]);
  });

  it("returns nothing for a browser whose Local State file is absent", async () => {
    const entries = await resolveChromiumBrowsers([
      {
        type: BrowserType.Chromium,
        label: "Chromium",
        path: "/home/user/.config/chromium/Local State",
        pkg: { manager: PackageManager.Native, binary: "chromium" },
      },
    ]);
    expect(entries).toEqual([]);
  });

  it("attaches the browser's real icon to the entry, never to a profile item", async () => {
    setFile(
      "/home/user/.config/chromium/Local State",
      JSON.stringify({ profile: { info_cache: { Default: { name: "Default" } } } }),
    );

    const entries = await resolveChromiumBrowsers([
      {
        type: BrowserType.Chromium,
        label: "Chromium",
        path: "/home/user/.config/chromium/Local State",
        pkg: { manager: PackageManager.Native, binary: "iconbrowser" },
      },
    ]);

    expect(entries[0].icon).toBe(FAKE_ICON);
    expect(entries[0].items[0].icon).toBeUndefined();
  });
});

describe("resolveFalkonBrowsers", () => {
  it("lists profile directories as items", async () => {
    setDir("/home/user/.config/falkon/profiles", ["default", "work"]);

    const entries = await resolveFalkonBrowsers([
      {
        type: BrowserType.Falkon,
        label: "Falkon",
        path: "/home/user/.config/falkon/profiles",
        pkg: { manager: PackageManager.Native, binary: "falkon" },
      },
    ]);

    expect(entries[0].items.map((i) => i.label).sort()).toEqual(["default", "work"]);
  });

  it("attaches the browser's real icon to the entry, never to a profile item", async () => {
    setDir("/home/user/.config/falkon/profiles", ["default"]);

    const entries = await resolveFalkonBrowsers([
      {
        type: BrowserType.Falkon,
        label: "Falkon",
        path: "/home/user/.config/falkon/profiles",
        pkg: { manager: PackageManager.Native, binary: "iconbrowser" },
      },
    ]);

    expect(entries[0].icon).toBe(FAKE_ICON);
    expect(entries[0].items[0].icon).toBeUndefined();
  });
});

describe("Browsers row (getBrowserEntries)", () => {
  // The "Browsers" row combines every installed browser — Firefox/Chrome-family
  // AND profile-less ones — into a single flat, alphabetically-sorted entry,
  // in addition to (not instead of) the detailed per-family sections above.
  // Flatpak-packaged simple browsers never resolve here: resolvePkg checks
  // real flatpak install dirs via GLib.file_test, which the virtual fs mock
  // always reports as absent unless explicitly set up.

  it("isolates one failing browser within the Browsers row instead of discarding the whole row", async () => {
    setFile(
      "/home/user/.mozilla/firefox/profiles.ini",
      "[Profile0]\nName=default\nIsRelative=1\nPath=abc.default\nDefault=1",
    );

    // showSimpleBrowsers pulls GNOME Web (Epiphany) into resolveBrowsersRow,
    // where its icon lookup is rigged to throw (see the Gio mock above).
    epiphanyIconThrows = true;
    const { entries, errors } = await getBrowserEntries({
      showFirefoxFamily: true,
      showChromeFamily: false,
      showSimpleBrowsers: true,
      showProfiledBrowsers: true,
      collapseSingleProfileBrowsers: false,
      enabledSpaces: new Set(),
      profileGroupsMode: "off",
    });

    expect(entries.some((e) => e.label === "Firefox (classic)")).toBe(true);
    const browsersRow = entries.find((e) => e.label === "Browsers");
    const labels = browsersRow?.items.map((i) => i.label) ?? [];
    expect(labels).not.toContain("GNOME Web");
    expect(labels.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.includes("GNOME Web"))).toBe(true);
  });

  it("still lists an installed-but-never-launched profiled browser in the Browsers row", async () => {
    // No profiles.ini set up at all — resolveBrowsersRow must list Firefox by
    // package presence alone (filterAvailable), not by requiring its profile
    // file to already exist (filterPresent) the way its detailed section
    // does. A freshly-installed browser that's never been launched has no
    // such file yet, but is still very much "installed".
    const { entries } = await getBrowserEntries({
      showFirefoxFamily: true,
      showChromeFamily: false,
      showSimpleBrowsers: false,
      showProfiledBrowsers: true,
      collapseSingleProfileBrowsers: false,
      enabledSpaces: new Set(),
      profileGroupsMode: "off",
    });

    // "Firefox" and "Firefox (classic)" both resolve to the same native
    // firefox package — the Browsers row shows one identity once (see
    // resolve-all.ts's dedupeByPkg()), keeping the plain, unsuffixed label.
    const browsersRow = entries.find((e) => e.label === "Browsers");
    expect(browsersRow?.items.map((i) => i.label)).toContain("Firefox");
  });

  it("shows Firefox exactly once in the Browsers row even though both its XDG and classic profile paths resolve to the same package", async () => {
    const { entries } = await getBrowserEntries({
      showFirefoxFamily: true,
      showChromeFamily: false,
      showSimpleBrowsers: false,
      showProfiledBrowsers: true,
      collapseSingleProfileBrowsers: false,
      enabledSpaces: new Set(),
      profileGroupsMode: "off",
    });

    const browsersRow = entries.find((e) => e.label === "Browsers");
    const labels = browsersRow?.items.map((i) => i.label) ?? [];
    expect(labels.filter((l) => l === "Firefox" || l === "Firefox (classic)")).toEqual(["Firefox"]);
  });

  it("combines firefox-family and profile-less browsers into one sorted 'Browsers' entry", async () => {
    setFile(
      "/home/user/.mozilla/firefox/profiles.ini",
      "[Profile0]\nName=default\nIsRelative=1\nPath=abc.default\nDefault=1",
    );

    const { entries } = await getBrowserEntries({
      showFirefoxFamily: true,
      showChromeFamily: false,
      showSimpleBrowsers: true,
      showProfiledBrowsers: true,
      collapseSingleProfileBrowsers: false,
      enabledSpaces: new Set(),
      profileGroupsMode: "off",
    });

    const browsersRow = entries.find((e) => e.label === "Browsers");
    expect(browsersRow?.group).toBe("simple");

    const labels = browsersRow?.items.map((i) => i.label) ?? [];
    expect(labels).toContain("Firefox");
    expect(labels).toContain("GNOME Web");
    expect(labels).toContain("qutebrowser");
    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b)));
  });

  it("omits simple browsers from the row when their toggle is off, keeping firefox-family entries", async () => {
    setFile(
      "/home/user/.mozilla/firefox/profiles.ini",
      "[Profile0]\nName=default\nIsRelative=1\nPath=abc.default\nDefault=1",
    );

    const { entries } = await getBrowserEntries({
      showFirefoxFamily: true,
      showChromeFamily: false,
      showSimpleBrowsers: false,
      showProfiledBrowsers: true,
      collapseSingleProfileBrowsers: false,
      enabledSpaces: new Set(),
      profileGroupsMode: "off",
    });

    const browsersRow = entries.find((e) => e.label === "Browsers");
    const labels = browsersRow?.items.map((i) => i.label) ?? [];
    expect(labels).toContain("Firefox");
    expect(labels).not.toContain("GNOME Web");
  });

  it("omits firefox-family entries from the row when their toggle is off, keeping simple browsers", async () => {
    setFile(
      "/home/user/.mozilla/firefox/profiles.ini",
      "[Profile0]\nName=default\nIsRelative=1\nPath=abc.default\nDefault=1",
    );

    const { entries } = await getBrowserEntries({
      showFirefoxFamily: false,
      showChromeFamily: false,
      showSimpleBrowsers: true,
      showProfiledBrowsers: true,
      collapseSingleProfileBrowsers: false,
      enabledSpaces: new Set(),
      profileGroupsMode: "off",
    });

    const browsersRow = entries.find((e) => e.label === "Browsers");
    const labels = browsersRow?.items.map((i) => i.label) ?? [];
    expect(labels).not.toContain("Firefox (classic)");
    expect(labels).toContain("GNOME Web");
  });
});

describe("getBrowserEntries", () => {
  // getBrowserEntries always resolves against the real FIREFOX_BROWSERS/
  // CHROMIUM_BROWSERS/etc. constants (not an injectable list), so these tests
  // target real entries from those constants (e.g. "Firefox (classic)" at
  // HOME_DIR + "/.mozilla/firefox/profiles.ini") rather than arbitrary paths.

  it("skips every family when all settings flags are off, without touching the filesystem", async () => {
    // No files set up at all — if getBrowserEntries tried to resolve any
    // family despite the flags being off, readTextFileAsync would throw on
    // a path with no matching virtual filesystem entry and the settle()
    // call would report it as rejected, still leaving entries === [].
    const { entries } = await getBrowserEntries({
      showFirefoxFamily: false,
      showChromeFamily: false,
      showSimpleBrowsers: false,
      showProfiledBrowsers: false,
      collapseSingleProfileBrowsers: false,
      enabledSpaces: new Set(),
      profileGroupsMode: "off",
    });

    expect(entries).toEqual([]);
  });

  it("resolves a family's real entries when its settings flag is on", async () => {
    setFile(
      "/home/user/.mozilla/firefox/profiles.ini",
      "[Profile0]\nName=default\nIsRelative=1\nPath=abc.default\nDefault=1",
    );

    const { entries } = await getBrowserEntries({
      showFirefoxFamily: true,
      showChromeFamily: false,
      showSimpleBrowsers: false,
      showProfiledBrowsers: true,
      collapseSingleProfileBrowsers: false,
      enabledSpaces: new Set(),
      profileGroupsMode: "off",
    });

    expect(entries.some((e) => e.label === "Firefox (classic)")).toBe(true);
  });

  it("collapses a single-profile browser's detailed section into the Browsers row when both settings are on", async () => {
    setFile(
      "/home/user/.mozilla/firefox/profiles.ini",
      "[Profile0]\nName=default\nIsRelative=1\nPath=abc.default\nDefault=1",
    );

    const { entries } = await getBrowserEntries({
      showFirefoxFamily: true,
      showChromeFamily: false,
      showSimpleBrowsers: false,
      showProfiledBrowsers: true,
      collapseSingleProfileBrowsers: true,
      enabledSpaces: new Set(),
      profileGroupsMode: "off",
    });

    expect(entries.some((e) => e.label === "Firefox (classic)")).toBe(false);
    const browsersRow = entries.find((e) => e.label === "Browsers");
    expect(browsersRow?.items.map((i) => i.label)).toContain("Firefox");
  });

  it("collapses a single-profile browser even when showProfiledBrowsers is off — collapseSingleProfileBrowsers is independent of it", async () => {
    setFile(
      "/home/user/.mozilla/firefox/profiles.ini",
      "[Profile0]\nName=default\nIsRelative=1\nPath=abc.default\nDefault=1",
    );

    const { entries } = await getBrowserEntries({
      showFirefoxFamily: true,
      showChromeFamily: false,
      showSimpleBrowsers: false,
      showProfiledBrowsers: false,
      collapseSingleProfileBrowsers: true,
      enabledSpaces: new Set(),
      profileGroupsMode: "off",
    });

    // With showProfiledBrowsers off, the Browsers row doesn't list it either
    // — collapsing it here means this single-profile browser has no way to
    // be launched from the menu at all. A known, accepted tradeoff of
    // keeping collapseSingleProfileBrowsers independent of showProfiledBrowsers.
    expect(entries).toEqual([]);
  });

  it("does not collapse a browser with multiple profiles even when both settings are on", async () => {
    setFile(
      "/home/user/.mozilla/firefox/profiles.ini",
      "[Profile0]\nName=default\nIsRelative=1\nPath=abc.default\nDefault=1\n" +
        "[Profile1]\nName=work\nIsRelative=1\nPath=abc.work\nDefault=0",
    );

    const { entries } = await getBrowserEntries({
      showFirefoxFamily: true,
      showChromeFamily: false,
      showSimpleBrowsers: false,
      showProfiledBrowsers: true,
      collapseSingleProfileBrowsers: true,
      enabledSpaces: new Set(),
      profileGroupsMode: "off",
    });

    const firefoxEntry = entries.find((e) => e.label === "Firefox (classic)");
    expect(firefoxEntry?.items.map((i) => i.label).sort()).toEqual(["default", "work"]);
  });

  it("does not collapse a single Zen profile that has exactly one active workspace", async () => {
    // Regression test: isSingleProfileEntry used to accept `spaces.length <= 1`
    // (should be `=== 0` per its own "no active spaces" docstring), so a
    // profile with exactly one workspace was wrongly treated as collapsible.
    setFile(
      "/home/user/.zen/profiles.ini",
      "[Profile0]\nName=default\nIsRelative=1\nPath=abc.default\nDefault=1",
    );
    setFile(
      "/home/user/.zen/abc.default/zen-sessions.jsonlz4",
      JSON.stringify({ spaces: [{ uuid: "u1", name: "Work", icon: "briefcase" }] }),
    );

    const { entries } = await getBrowserEntries({
      showFirefoxFamily: true,
      showChromeFamily: false,
      showSimpleBrowsers: false,
      showProfiledBrowsers: true,
      collapseSingleProfileBrowsers: true,
      enabledSpaces: new Set([SpaceType.ZenWorkspaces]),
      profileGroupsMode: "off",
    });

    const zenEntry = entries.find((e) => e.label === "Zen (classic)");
    expect(zenEntry).toBeDefined();
    expect(zenEntry?.items[0].spaces).toHaveLength(1);
  });
});
