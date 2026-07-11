import { describe, it, expect, vi } from "vitest";

// Maps desktop id -> fake Gio.Icon (or absent = "no app installed under that id").
const installedApps = new Map<string, object>();
const desktopAppInfoNew = vi.fn((id: string) => {
  const icon = installedApps.get(id);
  return icon ? { get_icon: () => icon, get_string: () => null } : null;
});

vi.mock("gi://Gio", () => ({
  default: { DesktopAppInfo: { new: desktopAppInfoNew } },
}));

// internal/gio.ts (imported transitively via ./gio) also references GLib —
// unused by anything these tests exercise, but the import itself must resolve.
vi.mock("gi://GLib", () => ({ default: { PRIORITY_DEFAULT: 0 } }));

const { resolveDesktopIcon, clearDesktopIconCache } = await import("../src/internal/desktop-icon");
const { PackageManager } = await import("../src/taxonomy/package-manager.enum");

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

  it("guesses '<name>.desktop' for a Snap package", () => {
    const icon = {};
    installedApps.set("brave.desktop", icon);
    const pkg = { manager: PackageManager.Snap, name: "brave" } as const;

    expect(resolveDesktopIcon(pkg)).toBe(icon);
    expect(desktopAppInfoNew).toHaveBeenCalledWith("brave.desktop");
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
