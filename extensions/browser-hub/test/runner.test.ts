import { describe, it, expect, vi, beforeEach } from "vitest";
import { fakeGioPromisify } from "./helpers/fake-gio-promisify";

// internal/gio.ts (imported transitively via runner.ts's resolveDesktopId/
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
// irrelevant to what this file tests (launchBrowser never resolves an
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

const { launchBrowser } = await import("../src/internal/runner");
const { PackageManager } = await import("../src/taxonomy/package-manager.enum");

const notify = vi.fn();

beforeEach(() => {
  subprocessNew.mockClear();
  subprocessShouldThrow = false;
  installedApps.clear();
  desktopAppInfoNew.mockClear();
  notify.mockClear();
});

describe("launchBrowser", () => {
  it("spawns the command via Gio.Subprocess when no pkg is given", () => {
    const result = launchBrowser({ command: ["firefox"], title: "Test", notify });

    expect(subprocessNew).toHaveBeenCalledWith(["firefox"], 0);
    expect(desktopAppInfoNew).not.toHaveBeenCalled();
    expect(result).toEqual({ fakeSubprocess: true });
  });

  it("launches via the resolved .desktop file when pkg's guess resolves and launch() succeeds", () => {
    const launch = vi.fn(() => true);
    installedApps.set("firefox.desktop", { launch });
    const pkg = { manager: PackageManager.Native, binary: "firefox" } as const;

    const result = launchBrowser({ command: ["firefox"], title: "Test", notify, pkg });

    expect(launch).toHaveBeenCalledWith(null, null);
    expect(subprocessNew).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it("falls back to Gio.Subprocess when launch() returns false", () => {
    installedApps.set("firefox.desktop", { launch: vi.fn(() => false) });
    const pkg = { manager: PackageManager.Native, binary: "firefox" } as const;

    launchBrowser({ command: ["firefox"], title: "Test", notify, pkg });

    expect(subprocessNew).toHaveBeenCalledWith(["firefox"], 0);
  });

  it("falls back to Gio.Subprocess when launch() throws", () => {
    installedApps.set("firefox.desktop", {
      launch: vi.fn(() => {
        throw new Error("dbus timeout");
      }),
    });
    const pkg = { manager: PackageManager.Native, binary: "firefox" } as const;

    launchBrowser({ command: ["firefox"], title: "Test", notify, pkg });

    expect(subprocessNew).toHaveBeenCalledWith(["firefox"], 0);
  });

  it("falls back to Gio.Subprocess without ever calling launch() when pkg's desktop id doesn't resolve at all", () => {
    // installedApps stays empty — the guess and the by-executable fallback
    // both come up empty, e.g. Fedora's epiphany-runtime: a binary on PATH
    // with no .desktop file at all.
    const pkg = { manager: PackageManager.Native, binary: "totally-unknown" } as const;

    const result = launchBrowser({ command: ["totally-unknown"], title: "Test", notify, pkg });

    expect(subprocessNew).toHaveBeenCalledWith(["totally-unknown"], 0);
    expect(result).toEqual({ fakeSubprocess: true });
  });

  it("notifies once, and returns null, when both the AppInfo launch and the Subprocess fallback fail", () => {
    globalThis.logError = vi.fn();
    installedApps.set("firefox.desktop", { launch: vi.fn(() => false) });
    subprocessShouldThrow = true;
    const pkg = { manager: PackageManager.Native, binary: "firefox" } as const;

    const result = launchBrowser({ command: ["firefox"], title: "Test", notify, pkg });

    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith("Test", "Failed to launch browser.");
    expect(result).toBeNull();
  });

  it("launches a Flatpak package via its resolved desktop id", () => {
    const launch = vi.fn(() => true);
    installedApps.set("org.mozilla.firefox.desktop", { launch });
    const pkg = { manager: PackageManager.Flatpak, appId: "org.mozilla.firefox" } as const;

    launchBrowser({
      command: ["flatpak", "run", "org.mozilla.firefox"],
      title: "Test",
      notify,
      pkg,
    });

    expect(launch).toHaveBeenCalledWith(null, null);
    expect(subprocessNew).not.toHaveBeenCalled();
  });

  it("launches a Snap package via its resolved desktop id", () => {
    const launch = vi.fn(() => true);
    installedApps.set("firefox_firefox.desktop", { launch });
    const pkg = { manager: PackageManager.Snap, name: "firefox" } as const;

    launchBrowser({ command: ["snap", "run", "firefox"], title: "Test", notify, pkg });

    expect(launch).toHaveBeenCalledWith(null, null);
    expect(subprocessNew).not.toHaveBeenCalled();
  });
});
