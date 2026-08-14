import { describe, it, expect, vi, beforeEach } from "vitest";

// Maps desktop id -> fake Gio.Icon (or absent = "no app installed under that id").
const installedApps = new Map<string, object>();
const desktopAppInfoNew = vi.fn((id: string) => {
  const icon = installedApps.get(id);
  return icon ? { get_icon: () => icon, get_string: () => null } : null;
});

// internal/gio.ts (imported transitively via ./gio) calls
// Gio._promisify(Gio.File.prototype, ...) at module scope, needing an actual
// prototype to patch even though nothing here exercises the promisified
// methods themselves, and references Gio.IOErrorEnum via logIfUnexpected()
// — none of our fake errors carry a real .matches(), so the exact values
// here never actually match, only need to exist.
class FakeGioFile {}

vi.mock("gi://Gio", () => ({
  default: {
    File: FakeGioFile,
    _promisify: () => {},
    IOErrorEnum: { NOT_FOUND: 1, PERMISSION_DENIED: 2 },
  },
}));

// DesktopAppInfo lives on GioUnix, not Gio — see internal/gio.ts.
vi.mock("gi://GioUnix", () => ({
  default: { DesktopAppInfo: { new: desktopAppInfoNew } },
}));

// internal/gio.ts also references GLib — unused by anything these tests
// exercise, but the import itself must resolve.
vi.mock("gi://GLib", () => ({ default: { PRIORITY_DEFAULT: 0 } }));

// Controls the outcome of the decode probe for the "validation" describe
// block below — defaults to a fake that always throws, so any test that
// forgets to configure it fails loudly instead of silently passing.
let pixbufOutcome: () => { get_width(): number; get_height(): number } = () => {
  throw new Error("gdk-pixbuf-mock: no outcome configured");
};
const newFromFileAtSize = vi.fn((_path: string, _w: number, _h: number) => pixbufOutcome());

vi.mock("gi://GdkPixbuf", () => ({
  default: { Pixbuf: { new_from_file_at_size: newFromFileAtSize } },
}));

// Controls which symbolic icon names "exist" in the current theme, for the
// symbolic-fallback describe block below — resolveDesktopIcon() imports
// iconExists() (icons/resolve-icon.ts), which reaches St.IconTheme.has_icon().
const existingIconNames = new Set<string>();
vi.mock("gi://St", () => ({
  default: {
    IconTheme: class {
      has_icon(name: string): boolean {
        return existingIconNames.has(name);
      }
    },
  },
}));

/** A Gio.FileIcon-shaped fake — real GJS exposes FileIcon.file as a plain property. */
function fakeFileIcon(path: string): { file: { get_path(): string } } {
  return { file: { get_path: () => path } };
}

const { resolveDesktopIcon, clearDesktopIconCache, ICON_DECODE_PROBE_SIZES } =
  await import("../src/internal/desktop-icon");
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

  it("returns undefined when the guessed desktop id matches no installed app and no symbolic fallback exists", () => {
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

// A Gio.FileIcon whose file fails to decode must never reach St.Icon — it
// aborts GNOME Shell natively (see desktop-icon.ts's isFileIcon/
// isDecodableIconFile).
describe("resolveDesktopIcon — icon decode validation", () => {
  beforeEach(() => {
    globalThis.logError = vi.fn();
    newFromFileAtSize.mockClear();
    existingIconNames.clear();
  });

  it("keeps a Gio.FileIcon whose file decodes to a real size", () => {
    const icon = fakeFileIcon("/apps/good.png");
    installedApps.set("decodable.desktop", icon);
    pixbufOutcome = () => ({ get_width: () => 32, get_height: () => 32 });

    expect(resolveDesktopIcon({ manager: PackageManager.Native, binary: "decodable" })).toBe(icon);
  });

  it("drops a Gio.FileIcon whose file throws on decode, falling back to no icon", () => {
    const icon = fakeFileIcon("/apps/corrupt.png");
    installedApps.set("corrupt.desktop", icon);
    pixbufOutcome = () => {
      throw new Error("Could not load a pixbuf from icon theme.");
    };

    expect(
      resolveDesktopIcon({ manager: PackageManager.Native, binary: "corrupt" }),
    ).toBeUndefined();
  });

  it("drops a Gio.FileIcon that decodes to a degenerate (0×0) size", () => {
    const icon = fakeFileIcon("/apps/degenerate.png");
    installedApps.set("degenerate.desktop", icon);
    pixbufOutcome = () => ({ get_width: () => 0, get_height: () => 32 });

    expect(
      resolveDesktopIcon({ manager: PackageManager.Native, binary: "degenerate" }),
    ).toBeUndefined();
  });

  it("logs a warning naming the desktopId and path when a decode fails", () => {
    installedApps.set("noisy.desktop", fakeFileIcon("/apps/noisy.png"));
    pixbufOutcome = () => {
      throw new Error("bad image");
    };

    resolveDesktopIcon({ manager: PackageManager.Native, binary: "noisy" });

    expect(globalThis.logError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.stringContaining("noisy.png"),
    );
  });

  it("only decodes once per desktopId, even across repeated resolves", () => {
    installedApps.set("cached-icon.desktop", fakeFileIcon("/apps/cached.png"));
    pixbufOutcome = () => ({ get_width: () => 16, get_height: () => 16 });

    const pkg = { manager: PackageManager.Native, binary: "cached-icon" } as const;
    resolveDesktopIcon(pkg);
    resolveDesktopIcon(pkg);

    // One decode call per probed size (a clean file never short-circuits
    // the loop), then nothing more once the result is cached.
    expect(newFromFileAtSize).toHaveBeenCalledTimes(ICON_DECODE_PROBE_SIZES.length);
  });

  it("re-probes after clearDesktopIconCache()", () => {
    installedApps.set("refreshed-icon.desktop", fakeFileIcon("/apps/refreshed.png"));
    pixbufOutcome = () => ({ get_width: () => 16, get_height: () => 16 });

    const pkg = { manager: PackageManager.Native, binary: "refreshed-icon" } as const;
    resolveDesktopIcon(pkg);
    clearDesktopIconCache();
    resolveDesktopIcon(pkg);

    expect(newFromFileAtSize).toHaveBeenCalledTimes(ICON_DECODE_PROBE_SIZES.length * 2);
  });

  it("stops at the first size that fails, instead of probing every size", () => {
    installedApps.set("fails-fast.desktop", fakeFileIcon("/apps/fails-fast.png"));
    pixbufOutcome = () => {
      throw new Error("bad image");
    };

    resolveDesktopIcon({ manager: PackageManager.Native, binary: "fails-fast" });

    expect(newFromFileAtSize).toHaveBeenCalledTimes(1);
  });

  it("passes a Gio.ThemedIcon-shaped result through unvalidated", () => {
    const icon = { names: ["some-icon"] };
    installedApps.set("themed.desktop", icon);

    expect(resolveDesktopIcon({ manager: PackageManager.Native, binary: "themed" })).toBe(icon);
    expect(newFromFileAtSize).not.toHaveBeenCalled();
  });
});

describe("resolveDesktopIcon — symbolic icon fallback", () => {
  beforeEach(() => {
    existingIconNames.clear();
  });

  it("falls back to '<binary>-symbolic' when no .desktop match exists and the theme has that icon", () => {
    existingIconNames.add("nomatch-symbolic");
    const pkg = { manager: PackageManager.Native, binary: "nomatch" } as const;

    expect(resolveDesktopIcon(pkg)).toBe("nomatch-symbolic");
  });

  it("prefers '<desktopId>-symbolic' over '<binary>-symbolic' for a Native package with an explicit desktopId", () => {
    existingIconNames.add("org.symtest.App-symbolic");
    const pkg = {
      manager: PackageManager.Native,
      binary: "symtest-app",
      desktopId: "org.symtest.App.desktop",
    } as const;

    expect(resolveDesktopIcon(pkg)).toBe("org.symtest.App-symbolic");
  });

  it("falls back to '<appId>-symbolic' for a Flatpak package", () => {
    existingIconNames.add("org.symtest.Flatpak-symbolic");
    const pkg = { manager: PackageManager.Flatpak, appId: "org.symtest.Flatpak" } as const;

    expect(resolveDesktopIcon(pkg)).toBe("org.symtest.Flatpak-symbolic");
  });

  it("falls back to '<name>-symbolic' for a Snap package", () => {
    existingIconNames.add("symtest-snap-symbolic");
    const pkg = { manager: PackageManager.Snap, name: "symtest-snap" } as const;

    expect(resolveDesktopIcon(pkg)).toBe("symtest-snap-symbolic");
  });

  it("returns undefined when neither a real icon nor a symbolic fallback is available", () => {
    const pkg = { manager: PackageManager.Native, binary: "totally-unknown" } as const;
    expect(resolveDesktopIcon(pkg)).toBeUndefined();
  });

  it("prefers the real .desktop icon over the symbolic fallback when both are available", () => {
    const icon = {};
    installedApps.set("has-both.desktop", icon);
    existingIconNames.add("has-both-symbolic");

    expect(resolveDesktopIcon({ manager: PackageManager.Native, binary: "has-both" })).toBe(icon);
  });

  it("still tries the symbolic fallback when the real icon exists but fails decode validation", () => {
    installedApps.set("corrupt-but-symbolic.desktop", fakeFileIcon("/apps/corrupt.png"));
    existingIconNames.add("corrupt-but-symbolic-symbolic");
    globalThis.logError = vi.fn();
    newFromFileAtSize.mockClear();
    pixbufOutcome = () => {
      throw new Error("bad image");
    };

    const pkg = { manager: PackageManager.Native, binary: "corrupt-but-symbolic" } as const;
    expect(resolveDesktopIcon(pkg)).toBe("corrupt-but-symbolic-symbolic");
  });
});
