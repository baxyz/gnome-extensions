import { describe, it, expect, vi, beforeEach } from "vitest";
import { fakeGioPromisify } from "./helpers/fake-gio-promisify";

// internal/gio.ts (imported transitively via launch.ts's resolveDesktopId/
// getDesktopAppInfo imports) calls Gio._promisify(Gio.File.prototype, ...)
// at module scope, needing an actual prototype to patch even though nothing
// here exercises the promisified methods themselves.
class FakeGioFile {}

let subprocessShouldThrow = false;
const subprocessNew = vi.fn();

// Maps desktop id -> a fake DesktopAppInfo-shaped object with its own
// `launch` mock (or absent = "no app installed under that id", the guess
// doesn't resolve).
const installedApps = new Map<string, { launch: (...args: unknown[]) => boolean }>();
const desktopAppInfoNew = vi.fn((id: string) => installedApps.get(id) ?? null);

vi.mock("gi://Gio", () => ({
  default: {
    File: FakeGioFile,
    _promisify: fakeGioPromisify,
    IOErrorEnum: { NOT_FOUND: 1, PERMISSION_DENIED: 2 },
    Subprocess: {
      new: (...args: unknown[]) => {
        if (subprocessShouldThrow) throw new Error("spawn failed");
        subprocessNew(...args);
        return { fakeSubprocess: true };
      },
    },
    SubprocessFlags: { NONE: 0 },
    // findDesktopIdByExecutable()'s/findDesktopIdByDesktopKey()'s fallback
    // source (internal/gio.ts) — no registered browser in these fixtures,
    // so a guess that doesn't resolve falls through to null exactly once,
    // never masking a real fallback match.
    AppInfo: { get_all_for_type: () => [] },
  },
}));

// DesktopAppInfo lives on GioUnix, not Gio — see internal/gio.ts.
vi.mock("gi://GioUnix", () => ({
  default: { DesktopAppInfo: { new: (id: string) => desktopAppInfoNew(id) } },
}));

// internal/gio.ts also references GLib's path_get_basename (used by the
// by-executable fallback) — the import itself must resolve regardless.
vi.mock("gi://GLib", () => ({
  default: { path_get_basename: (p: string) => p.split("/").filter(Boolean).pop() ?? "" },
}));

// internal/desktop-icon.ts (transitively imported via resolveDesktopId) also
// imports "gi://GdkPixbuf" to validate .desktop icons before use, and
// "../icons" imports "gi://St" for its symbolic-icon fallback — both
// irrelevant to what this file tests (launch never resolves an
// icon), so stubs that always "succeed"/"don't match" are enough for the
// modules to load under Node.
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

const { buildArgv, launch, launchAppInfo } = await import("../src/internal/launch");
const { PackageManager } = await import("../src/taxonomy/package-manager.enum");

const notify = vi.fn();

const NATIVE = { manager: PackageManager.Native, binary: "firefox" } as const;
const FLATPAK = { manager: PackageManager.Flatpak, appId: "org.mozilla.firefox" } as const;
const SNAP = { manager: PackageManager.Snap, name: "firefox" } as const;

beforeEach(() => {
  subprocessNew.mockClear();
  subprocessShouldThrow = false;
  installedApps.clear();
  desktopAppInfoNew.mockClear();
  notify.mockClear();
  globalThis.logError = vi.fn();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("buildArgv", () => {
  it.each([
    [{ kind: "browser", pkg: NATIVE }, ["firefox"]],
    [{ kind: "browser", pkg: FLATPAK }, ["flatpak", "run", "org.mozilla.firefox"]],
    [{ kind: "browser", pkg: SNAP }, ["snap", "run", "firefox"]],
    [
      { kind: "firefoxProfile", pkg: NATIVE, profile: "work" },
      ["firefox", "-P", "work", "-no-remote"],
    ],
    [
      { kind: "firefoxProfile", pkg: FLATPAK, profile: "work" },
      ["flatpak", "run", "org.mozilla.firefox", "-P", "work", "-no-remote"],
    ],
    [
      { kind: "firefoxProfile", pkg: SNAP, profile: "work" },
      ["snap", "run", "firefox", "-P", "work", "-no-remote"],
    ],
    [
      { kind: "firefoxProfileDir", pkg: NATIVE, dir: "/home/u/.mozilla/firefox/x.work" },
      ["firefox", "--profile", "/home/u/.mozilla/firefox/x.work", "-no-remote"],
    ],
    [
      { kind: "zenWorkspace", pkg: FLATPAK, profile: "Default", workspace: "Work" },
      [
        "flatpak",
        "run",
        "org.mozilla.firefox",
        "-P",
        "Default",
        "--zen-workspace",
        "Work",
        "-no-remote",
      ],
    ],
    [
      { kind: "chromiumProfile", pkg: NATIVE, dir: "Profile 1" },
      ["firefox", "--profile-directory=Profile 1"],
    ],
    [
      { kind: "falkonProfile", pkg: SNAP, profile: "default" },
      ["snap", "run", "firefox", "--profile", "default"],
    ],
    [
      { kind: "donut", pkg: FLATPAK, dir: "/run/user/1000/browser-hub/donut/u" },
      [
        "flatpak",
        "run",
        "--filesystem=/run/user/1000/browser-hub/donut/u",
        "org.mozilla.firefox",
        "--profile",
        "/run/user/1000/browser-hub/donut/u",
        "-no-remote",
      ],
    ],
  ] as const)("%o -> %o", (target, argv) => {
    expect(buildArgv(target)).toEqual(argv);
  });

  it.each([
    { kind: "firefoxProfile", pkg: NATIVE, profile: "--headless" },
    { kind: "firefoxProfile", pkg: NATIVE, profile: "" },
    { kind: "zenWorkspace", pkg: NATIVE, profile: "Default", workspace: "-url" },
    { kind: "chromiumProfile", pkg: NATIVE, dir: "--user-data-dir=/tmp" },
    { kind: "falkonProfile", pkg: NATIVE, profile: "-x" },
    { kind: "firefoxProfileDir", pkg: NATIVE, dir: "relative/dir" },
    { kind: "donut", pkg: NATIVE, dir: "-profile" },
  ] as const)("refuses an unsafe value: %o", (target) => {
    expect(buildArgv(target)).toBeNull();
  });
});

describe("launch", () => {
  it("spawns a profile target from its argv, without trying the .desktop file", () => {
    const result = launch({ kind: "firefoxProfile", pkg: NATIVE, profile: "work" }, "Test", notify);

    expect(subprocessNew).toHaveBeenCalledWith(["firefox", "-P", "work", "-no-remote"], 0);
    expect(desktopAppInfoNew).not.toHaveBeenCalled();
    expect(result).toEqual({ fakeSubprocess: true });
  });

  it("refuses an unsafe target and notifies, without spawning", () => {
    const result = launch({ kind: "firefoxProfile", pkg: NATIVE, profile: "-x" }, "Test", notify);

    expect(subprocessNew).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith("Test", "Failed to launch browser.");
    expect(result).toBeNull();
  });

  it("launches a browser target via its resolved .desktop file when launch() succeeds", () => {
    const appLaunch = vi.fn(() => true);
    installedApps.set("firefox.desktop", { launch: appLaunch });

    const result = launch({ kind: "browser", pkg: NATIVE }, "Test", notify);

    expect(appLaunch).toHaveBeenCalledWith(null, null);
    expect(subprocessNew).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it("falls back to the argv when the .desktop launch() returns false", () => {
    installedApps.set("firefox.desktop", { launch: vi.fn(() => false) });

    launch({ kind: "browser", pkg: NATIVE }, "Test", notify);

    expect(subprocessNew).toHaveBeenCalledWith(["firefox"], 0);
  });

  it("falls back to the argv when the .desktop launch() throws", () => {
    installedApps.set("firefox.desktop", {
      launch: vi.fn(() => {
        throw new Error("dbus timeout");
      }),
    });

    launch({ kind: "browser", pkg: NATIVE }, "Test", notify);

    expect(subprocessNew).toHaveBeenCalledWith(["firefox"], 0);
  });

  it("falls back to the argv when the desktop id doesn't resolve at all", () => {
    const pkg = { manager: PackageManager.Native, binary: "totally-unknown" } as const;

    const result = launch({ kind: "browser", pkg }, "Test", notify);

    expect(subprocessNew).toHaveBeenCalledWith(["totally-unknown"], 0);
    expect(result).toEqual({ fakeSubprocess: true });
  });

  it("notifies once, and returns null, when both the .desktop launch and the spawn fail", () => {
    installedApps.set("firefox.desktop", { launch: vi.fn(() => false) });
    subprocessShouldThrow = true;

    const result = launch({ kind: "browser", pkg: NATIVE }, "Test", notify);

    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith("Test", "Failed to launch browser.");
    expect(result).toBeNull();
  });

  it.each([
    [FLATPAK, "org.mozilla.firefox.desktop"],
    [SNAP, "firefox_firefox.desktop"],
  ] as const)("launches a %o browser via its resolved desktop id", (pkg, desktopId) => {
    const appLaunch = vi.fn(() => true);
    installedApps.set(desktopId, { launch: appLaunch });

    launch({ kind: "browser", pkg }, "Test", notify);

    expect(appLaunch).toHaveBeenCalledWith(null, null);
    expect(subprocessNew).not.toHaveBeenCalled();
  });
});

describe("launchAppInfo", () => {
  it("launches the AppInfo as-is", () => {
    const info = { launch: vi.fn(() => true) };

    launchAppInfo(info as never, "Test", notify);

    expect(info.launch).toHaveBeenCalledWith(null, null);
    expect(notify).not.toHaveBeenCalled();
  });

  it("notifies when the AppInfo fails to launch", () => {
    const info = {
      launch: vi.fn(() => {
        throw new Error("boom");
      }),
    };

    launchAppInfo(info as never, "Test", notify);

    expect(notify).toHaveBeenCalledWith("Test", "Failed to launch browser.");
  });
});
