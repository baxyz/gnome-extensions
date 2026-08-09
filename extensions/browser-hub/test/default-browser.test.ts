import { describe, it, expect, vi, beforeEach } from "vitest";
import { fakeGioPromisify } from "./helpers/fake-gio-promisify";

// internal/gio.ts (loaded transitively via "./internal") calls
// Gio._promisify(Gio.File.prototype, ...) at import time, patching this
// class's prototype — every instance needs to share it. Nothing here
// exercises the promisified methods themselves.
class FakeGioFile {}

globalThis.logError = () => {};

let defaultAppInfo: {
  get_name: () => string;
  get_id: () => string;
  get_executable: () => string;
} | null = null;
const getDefaultForUriScheme = vi.fn(() => defaultAppInfo);

type FakeDesktopAppInfo = {
  get_string: (key: string) => string | null;
  set_as_default_for_type: (contentType: string) => void;
};
const desktopAppInfos = new Map<string, Record<string, string>>();
const setAsDefaultForType = vi.fn<(contentType: string) => void>();
let setAsDefaultForTypeShouldThrowOn: string | null = null;

function desktopAppInfoNew(id: string): FakeDesktopAppInfo | null {
  const fields = desktopAppInfos.get(id);
  if (!fields) return null;
  return {
    get_string: (key: string) => fields[key] ?? null,
    set_as_default_for_type: (contentType: string) => {
      setAsDefaultForType(contentType);
      if (contentType === setAsDefaultForTypeShouldThrowOn) {
        throw new Error(`refused ${contentType}`);
      }
    },
  };
}

vi.mock("gi://Gio", () => ({
  default: {
    File: Object.assign(FakeGioFile, { new_for_path: () => new FakeGioFile() }),
    _promisify: fakeGioPromisify,
    AppInfo: { get_default_for_uri_scheme: getDefaultForUriScheme },
  },
}));

// DesktopAppInfo lives on GioUnix, not Gio — see internal/gio.ts.
vi.mock("gi://GioUnix", () => ({
  default: { DesktopAppInfo: { new: desktopAppInfoNew } },
}));

vi.mock("gi://GLib", () => ({
  default: {
    find_program_in_path: () => null,
    get_home_dir: () => "/home/user",
    getenv: () => null,
  },
}));

const { getDefaultBrowser, setDefaultBrowser, clearDefaultBrowserCache } =
  await import("../src/default-browser");
const { PackageManager } = await import("../src/taxonomy/package-manager.enum");

beforeEach(() => {
  defaultAppInfo = null;
  desktopAppInfos.clear();
  setAsDefaultForTypeShouldThrowOn = null;
  getDefaultForUriScheme.mockClear();
  setAsDefaultForType.mockClear();
  clearDefaultBrowserCache();
});

describe("getDefaultBrowser", () => {
  it("returns null when there's no default browser association", () => {
    expect(getDefaultBrowser()).toBeNull();
  });

  it("resolves a Native package, keeping the already-known desktopId", () => {
    defaultAppInfo = {
      get_name: () => "Firefox",
      get_id: () => "firefox.desktop",
      get_executable: () => "firefox",
    };
    desktopAppInfos.set("firefox.desktop", {});

    expect(getDefaultBrowser()).toEqual({
      name: "Firefox",
      command: ["firefox"],
      pkg: { manager: PackageManager.Native, binary: "firefox", desktopId: "firefox.desktop" },
    });
  });

  it("resolves a Flatpak package via the desktop file's X-Flatpak key", () => {
    defaultAppInfo = {
      get_name: () => "Firefox",
      get_id: () => "org.mozilla.firefox.desktop",
      get_executable: () => "/usr/bin/flatpak",
    };
    desktopAppInfos.set("org.mozilla.firefox.desktop", { "X-Flatpak": "org.mozilla.firefox" });

    expect(getDefaultBrowser()?.pkg).toEqual({
      manager: PackageManager.Flatpak,
      appId: "org.mozilla.firefox",
    });
  });

  it("resolves a Snap package via the desktop file's X-SnapInstanceName key", () => {
    defaultAppInfo = {
      get_name: () => "Firefox",
      get_id: () => "firefox_firefox.desktop",
      get_executable: () => "/snap/bin/firefox",
    };
    desktopAppInfos.set("firefox_firefox.desktop", { "X-SnapInstanceName": "firefox" });

    expect(getDefaultBrowser()?.pkg).toEqual({ manager: PackageManager.Snap, name: "firefox" });
  });

  it("caches the result until clearDefaultBrowserCache() is called", () => {
    defaultAppInfo = {
      get_name: () => "Firefox",
      get_id: () => "firefox.desktop",
      get_executable: () => "firefox",
    };
    desktopAppInfos.set("firefox.desktop", {});

    getDefaultBrowser();
    getDefaultBrowser();
    expect(getDefaultForUriScheme).toHaveBeenCalledTimes(1);

    clearDefaultBrowserCache();
    getDefaultBrowser();
    expect(getDefaultForUriScheme).toHaveBeenCalledTimes(2);
  });
});

describe("setDefaultBrowser", () => {
  const pkg = {
    manager: PackageManager.Native,
    binary: "firefox",
    desktopId: "firefox.desktop",
  } as const;

  it("returns false when the package's desktop file can't be resolved", () => {
    expect(setDefaultBrowser(pkg)).toBe(false);
    expect(setAsDefaultForType).not.toHaveBeenCalled();
  });

  it("sets all three browser content types and returns true on success", () => {
    desktopAppInfos.set("firefox.desktop", {});

    expect(setDefaultBrowser(pkg)).toBe(true);
    expect(setAsDefaultForType).toHaveBeenCalledTimes(3);
    expect(setAsDefaultForType).toHaveBeenCalledWith("x-scheme-handler/http");
    expect(setAsDefaultForType).toHaveBeenCalledWith("x-scheme-handler/https");
    expect(setAsDefaultForType).toHaveBeenCalledWith("text/html");
  });

  it("returns false and still busts the cache when a content type throws partway through", () => {
    desktopAppInfos.set("firefox.desktop", {});
    defaultAppInfo = {
      get_name: () => "Old Default",
      get_id: () => "old.desktop",
      get_executable: () => "old",
    };
    desktopAppInfos.set("old.desktop", {});
    getDefaultBrowser(); // populate the cache with the pre-call default
    setAsDefaultForTypeShouldThrowOn = "x-scheme-handler/https";

    expect(setDefaultBrowser(pkg)).toBe(false);
    // http succeeded before https threw — the OS state may already differ
    // from what's cached, so the stale pre-call value must not be served.
    getDefaultForUriScheme.mockClear();
    getDefaultBrowser();
    expect(getDefaultForUriScheme).toHaveBeenCalledTimes(1);
  });
});
