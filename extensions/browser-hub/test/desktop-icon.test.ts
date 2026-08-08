import { describe, it, expect, vi, beforeAll } from "vitest";
import type Gio from "gi://Gio";

// Maps desktop id -> fake Gio.Icon (or absent = "no app installed under that id").
const installedApps = new Map<string, object>();
const desktopAppInfoNew = vi.fn((id: string) => {
  const icon = installedApps.get(id);
  return icon ? { get_icon: () => icon, get_string: () => null } : null;
});

// Fakes for the emblem-wrapping path — only exercised once a test calls
// setBadgeIconsDir(); every test above that point never does, so these are
// never invoked there (see resolveDesktopIcon's badgeIconsDir-null guard).
const fileIconNew = vi.fn((file: { path: string }) => ({ __fileIcon: file.path }));
const emblemNew = vi.fn((icon: unknown) => ({ __emblem: icon }));
const emblemedIconNew = vi.fn((icon: unknown, emblem: unknown) => ({ __emblemed: icon, emblem }));

// A class, not a plain object: internal/gio.ts calls Gio._promisify(Gio.File.prototype,
// ...) at module scope on import (internal/desktop-icon.ts imports from
// "./gio"), which needs an actual prototype to patch even though nothing
// here exercises the promisified methods themselves.
class FakeGioFile {}

vi.mock("gi://Gio", () => ({
  default: {
    DesktopAppInfo: { new: desktopAppInfoNew },
    FileIcon: { new: fileIconNew },
    Emblem: { new: emblemNew },
    EmblemedIcon: { new: emblemedIconNew },
    File: FakeGioFile,
    _promisify: () => {},
  },
}));

// internal/gio.ts (imported transitively via ./gio) also references GLib —
// unused by anything these tests exercise, but the import itself must resolve.
vi.mock("gi://GLib", () => ({ default: { PRIORITY_DEFAULT: 0 } }));

const { resolveDesktopIcon, clearDesktopIconCache, setBadgeIconsDir } =
  await import("../src/internal/desktop-icon");
const { PackageManager } = await import("../src/taxonomy/package-manager.enum");

// A minimal fake Gio.File — only get_child() is exercised.
function fakeDir(path: string): Gio.File {
  return { get_child: (name: string) => ({ path: `${path}/${name}` }) } as unknown as Gio.File;
}

describe("resolveDesktopIcon", () => {
  it("guesses '<binary>.desktop' for a Native package", () => {
    const icon = {};
    installedApps.set("firefox.desktop", icon);
    const pkg = { manager: PackageManager.Native, binary: "firefox" } as const;

    expect(resolveDesktopIcon(pkg)).toBe(icon);
    expect(desktopAppInfoNew).toHaveBeenCalledWith("firefox.desktop");
  });

  it("guesses '<appId>.desktop' for a Flatpak package (always correct, not a guess)", () => {
    const icon = {};
    installedApps.set("org.mozilla.firefox.desktop", icon);
    const pkg = { manager: PackageManager.Flatpak, appId: "org.mozilla.firefox" } as const;

    expect(resolveDesktopIcon(pkg)).toBe(icon);
    expect(desktopAppInfoNew).toHaveBeenCalledWith("org.mozilla.firefox.desktop");
  });

  it("guesses '<name>_<name>.desktop' for a Snap package (snapd's real naming, e.g. brave_brave.desktop)", () => {
    const icon = {};
    installedApps.set("brave_brave.desktop", icon);
    const pkg = { manager: PackageManager.Snap, name: "brave" } as const;

    expect(resolveDesktopIcon(pkg)).toBe(icon);
    expect(desktopAppInfoNew).toHaveBeenCalledWith("brave_brave.desktop");
  });

  it("uses the explicit desktopId override for a Native package instead of guessing from the binary", () => {
    const icon = {};
    installedApps.set("org.gnome.Epiphany.desktop", icon);
    const pkg = {
      manager: PackageManager.Native,
      binary: "epiphany",
      desktopId: "org.gnome.Epiphany.desktop",
    } as const;

    expect(resolveDesktopIcon(pkg)).toBe(icon);
    expect(desktopAppInfoNew).toHaveBeenCalledWith("org.gnome.Epiphany.desktop");
  });

  it("returns undefined when the guessed desktop id matches no installed app", () => {
    const pkg = { manager: PackageManager.Native, binary: "totally-made-up-binary" } as const;
    expect(resolveDesktopIcon(pkg)).toBeUndefined();
  });

  it("caches the result per package object, without re-querying Gio.AppInfo", () => {
    const icon = {};
    installedApps.set("cached-browser.desktop", icon);
    const pkg = { manager: PackageManager.Native, binary: "cached-browser" } as const;

    desktopAppInfoNew.mockClear();
    expect(resolveDesktopIcon(pkg)).toBe(icon);
    expect(resolveDesktopIcon(pkg)).toBe(icon);
    expect(desktopAppInfoNew).toHaveBeenCalledTimes(1);
  });

  it("clearDesktopIconCache() forces a fresh lookup for the same package", () => {
    const icon = {};
    installedApps.set("refreshed-browser.desktop", icon);
    const pkg = { manager: PackageManager.Native, binary: "refreshed-browser" } as const;

    desktopAppInfoNew.mockClear();
    expect(resolveDesktopIcon(pkg)).toBe(icon);
    clearDesktopIconCache();
    expect(resolveDesktopIcon(pkg)).toBe(icon);
    expect(desktopAppInfoNew).toHaveBeenCalledTimes(2);
  });
});

describe("resolveDesktopIcon — package manager badge", () => {
  beforeAll(() => {
    setBadgeIconsDir(fakeDir("/ext/assets/badges"));
  });

  it("wraps a Flatpak package's icon in an EmblemedIcon carrying the flatpak badge", () => {
    const icon = {};
    installedApps.set("org.badged.Flatpak.desktop", icon);
    const pkg = { manager: PackageManager.Flatpak, appId: "org.badged.Flatpak" } as const;

    const result = resolveDesktopIcon(pkg);
    expect(fileIconNew).toHaveBeenCalledWith({ path: "/ext/assets/badges/flatpak-badge.svg" });
    expect(emblemedIconNew).toHaveBeenCalledWith(icon, {
      __emblem: { __fileIcon: expect.any(String) },
    });
    expect(result).toEqual({ __emblemed: icon, emblem: expect.anything() });
  });

  it("wraps a Snap package's icon with the snap badge, not the flatpak one", () => {
    const icon = {};
    installedApps.set("badged-snap_badged-snap.desktop", icon);
    const pkg = { manager: PackageManager.Snap, name: "badged-snap" } as const;

    resolveDesktopIcon(pkg);
    expect(fileIconNew).toHaveBeenCalledWith({ path: "/ext/assets/badges/snap-badge.svg" });
  });

  it("does not badge a Native package's icon — native is the unmarked default", () => {
    const icon = {};
    installedApps.set("badged-native.desktop", icon);
    const pkg = { manager: PackageManager.Native, binary: "badged-native" } as const;

    fileIconNew.mockClear();
    expect(resolveDesktopIcon(pkg)).toBe(icon);
    expect(fileIconNew).not.toHaveBeenCalled();
  });

  it("does not badge when there's no icon to badge (app not installed)", () => {
    const pkg = { manager: PackageManager.Flatpak, appId: "org.not.Installed" } as const;

    fileIconNew.mockClear();
    expect(resolveDesktopIcon(pkg)).toBeUndefined();
    expect(fileIconNew).not.toHaveBeenCalled();
  });
});
