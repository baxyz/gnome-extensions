import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
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
const fileIconNew = vi.fn((file: { get_path(): string }) => ({ __fileIcon: file.get_path() }));
const emblemNew = vi.fn((icon: unknown) => ({ __emblem: icon }));
const emblemedIconNew = vi.fn((icon: unknown, emblem: unknown) => ({ __emblemed: icon, emblem }));

// internal/desktop-icon.ts imports from "./gio" — its Gio._promisify(Gio.File.prototype, ...)
// call at module scope needs an actual prototype to patch even though
// nothing here exercises the promisified methods themselves.
class FakeGioFile {}

vi.mock("gi://Gio", () => ({
  default: {
    FileIcon: { new: fileIconNew },
    Emblem: { new: emblemNew },
    EmblemedIcon: { new: emblemedIconNew },
    File: FakeGioFile,
    _promisify: () => {},
    // logIfUnexpected() (used by the decode-validation tests below) checks
    // these — none of our fake errors carry a real .matches(), so the exact
    // values here never actually match, only need to exist.
    IOErrorEnum: { NOT_FOUND: 1, PERMISSION_DENIED: 2 },
  },
}));

// DesktopAppInfo lives on GioUnix, not Gio — see internal/gio.ts.
vi.mock("gi://GioUnix", () => ({
  default: { DesktopAppInfo: { new: desktopAppInfoNew } },
}));

// internal/gio.ts (imported transitively via ./gio) also references GLib —
// unused by anything these tests exercise, but the import itself must resolve.
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

/** A Gio.FileIcon-shaped fake — real GJS exposes FileIcon.file as a plain property. */
function fakeFileIcon(path: string): { file: { get_path(): string } } {
  return { file: { get_path: () => path } };
}

const { resolveDesktopIcon, clearDesktopIconCache, setBadgeIconsDir, ICON_DECODE_PROBE_SIZES } =
  await import("../src/internal/desktop-icon");
const { PackageManager } = await import("../src/taxonomy/package-manager.enum");

// A minimal fake Gio.File — only get_child()/get_path() are exercised,
// mirroring the real Gio.File API (a get_path() method, not a plain
// property) since badgeIconResolver now calls it to validate the badge.
function fakeDir(path: string): Gio.File {
  return {
    get_child: (name: string) => ({ get_path: () => `${path}/${name}` }),
  } as unknown as Gio.File;
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
    // Badge files now go through the same decode validation as a browser's
    // own .desktop icon (see desktop-icon.ts's badgeIconResolver) — default
    // to a clean decode so these pre-existing "does it badge at all" tests
    // aren't about validation. See the dedicated "badge decode validation"
    // describe block below for the failure-path coverage.
    pixbufOutcome = () => ({ get_width: () => 16, get_height: () => 16 });
  });

  it("wraps a Flatpak package's icon in an EmblemedIcon carrying the flatpak badge", () => {
    const icon = {};
    installedApps.set("org.badged.Flatpak.desktop", icon);
    const pkg = { manager: PackageManager.Flatpak, appId: "org.badged.Flatpak" } as const;

    const result = resolveDesktopIcon(pkg);
    expect(fileIconNew.mock.calls.at(-1)?.[0]?.get_path()).toBe(
      "/ext/assets/badges/flatpak-badge.svg",
    );
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
    expect(fileIconNew.mock.calls.at(-1)?.[0]?.get_path()).toBe(
      "/ext/assets/badges/snap-badge.svg",
    );
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

// A Gio.FileIcon whose file fails to decode must never reach St.Icon — it
// aborts GNOME Shell natively (see desktop-icon.ts's isFileIcon/
// isDecodableIconFile). These tests never exercise resolveDesktopIcon()'s
// badge step (setBadgeIconsDir() is only called in the describe block
// above), so results are asserted directly against the raw icon, same as
// the unbadged tests earlier in this file.
describe("resolveDesktopIcon — icon decode validation", () => {
  beforeEach(() => {
    globalThis.logError = vi.fn();
    newFromFileAtSize.mockClear();
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

// Reproduces the real production gap found via journalctl on 2026-08-13: the
// original decode-validation fix (a single-size probe) only ever covered a
// browser's own .desktop icon, never the package-manager badge — but the
// badge is rendered as a GEmblemedIcon's *emblem*, at a fraction of icon_size
// this module can't observe, and it kept crashing the shell after that fix
// had already shipped and was confirmed active. See ROADMAP.md's "Icon
// -loading crash hardening" section for the full timeline.
describe("resolveDesktopIcon — badge decode validation", () => {
  beforeEach(() => {
    setBadgeIconsDir(fakeDir("/ext/assets/badges"));
    globalThis.logError = vi.fn();
    newFromFileAtSize.mockClear();
    // Badge validation is cached per filename (only 2 ever exist) — clear
    // it every test so "good" and "bad" scenarios for the same filename
    // don't leak into each other via a stale cached verdict.
    clearDesktopIconCache();
  });

  // Base icons here are plain objects (like the "package manager badge"
  // describe block above), not fakeFileIcon() — isFileIcon() only matches
  // objects with a "file" property, so these never enter the base-icon
  // decode path and every newFromFileAtSize call below is attributable
  // solely to badge validation. Using a FileIcon-shaped base instead would
  // make it decode through the *same* isDecodableIconFile probe, confounding
  // whatever failure/count each test is trying to isolate on the badge.

  it("badges a Flatpak icon when the badge file decodes cleanly at every probed size", () => {
    const icon = {};
    installedApps.set("good.flatpak.desktop", icon);
    pixbufOutcome = () => ({ get_width: () => 16, get_height: () => 16 });

    const result = resolveDesktopIcon({ manager: PackageManager.Flatpak, appId: "good.flatpak" });

    expect(result).toEqual({ __emblemed: icon, emblem: expect.anything() });
  });

  it("drops the badge (keeps the base icon) when the badge file throws on decode", () => {
    const icon = {};
    installedApps.set("degraded.flatpak.desktop", icon);
    pixbufOutcome = () => {
      throw new Error("Could not load a pixbuf from icon theme.");
    };

    const result = resolveDesktopIcon({
      manager: PackageManager.Flatpak,
      appId: "degraded.flatpak",
    });

    expect(result).toBe(icon);
  });

  it("drops the badge when it decodes to a degenerate size at only the smallest probed size", () => {
    const icon = {};
    installedApps.set("tiny.flatpak.desktop", icon);
    let calls = 0;
    // Fails only on the first (smallest) probed size — the exact shape that
    // slipped through the original single-64px probe in production: fine at
    // 64px, degenerate at whatever tiny size St actually renders the emblem.
    pixbufOutcome = () => {
      calls += 1;
      return calls === 1
        ? { get_width: () => 0, get_height: () => 0 }
        : { get_width: () => 16, get_height: () => 16 };
    };

    const result = resolveDesktopIcon({ manager: PackageManager.Flatpak, appId: "tiny.flatpak" });

    expect(result).toBe(icon);
    expect(newFromFileAtSize).toHaveBeenCalledTimes(1);
  });

  it("logs a warning naming the badge path when its decode fails", () => {
    installedApps.set("noisy.flatpak.desktop", {});
    pixbufOutcome = () => {
      throw new Error("bad svg");
    };

    resolveDesktopIcon({ manager: PackageManager.Flatpak, appId: "noisy.flatpak" });

    expect(globalThis.logError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.stringContaining("flatpak-badge.svg"),
    );
  });

  it("validates a badge at most once, shared across every browser using that package manager", () => {
    pixbufOutcome = () => ({ get_width: () => 16, get_height: () => 16 });
    installedApps.set("first.flatpak.desktop", {});
    installedApps.set("second.flatpak.desktop", {});

    resolveDesktopIcon({ manager: PackageManager.Flatpak, appId: "first.flatpak" });
    const callsAfterFirst = newFromFileAtSize.mock.calls.length;
    resolveDesktopIcon({ manager: PackageManager.Flatpak, appId: "second.flatpak" });

    expect(newFromFileAtSize.mock.calls.length).toBe(callsAfterFirst);
  });

  it("re-validates the badge after clearDesktopIconCache()", () => {
    pixbufOutcome = () => ({ get_width: () => 16, get_height: () => 16 });
    installedApps.set("refreshed.flatpak.desktop", {});
    const pkg = { manager: PackageManager.Flatpak, appId: "refreshed.flatpak" } as const;

    resolveDesktopIcon(pkg);
    const callsAfterFirst = newFromFileAtSize.mock.calls.length;
    clearDesktopIconCache();
    resolveDesktopIcon(pkg);

    expect(newFromFileAtSize.mock.calls.length).toBe(callsAfterFirst * 2);
  });
});
