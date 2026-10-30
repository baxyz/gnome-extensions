import { describe, it, expect, vi, beforeEach } from "vitest";

const fileReadLink = vi.fn();
vi.mock("gi://GLib", () => ({
  default: {
    get_home_dir: () => "/home/user",
    getenv: () => null,
    file_read_link: fileReadLink,
  },
}));

beforeEach(() => {
  fileReadLink.mockClear();
});

const { snapDataDir, snapCommonDir } = await import("../src/constants/paths.constant");

describe("snapDataDir", () => {
  it("resolves the real per-user data dir from the system-wide /snap/<name>/current symlink", () => {
    // Confirmed on a real system: /snap/<name>/current is a reliable
    // system-wide symlink to the active revision, but the per-user
    // ~/snap/<name>/current mirror some snaps create isn't guaranteed to
    // exist — the actual data lives directly under the revision number.
    fileReadLink.mockReturnValueOnce("652");
    expect(snapDataDir("brave")).toBe("/home/user/snap/brave/652");
  });

  it("falls back to the 'current' alias when the symlink can't be read", () => {
    fileReadLink.mockImplementationOnce(() => {
      throw new Error("no such file");
    });
    expect(snapDataDir("made-up-snap")).toBe("/home/user/snap/made-up-snap/current");
  });
});

describe("snapCommonDir", () => {
  it("points at the fixed $SNAP_USER_COMMON dir, no revision symlink involved", () => {
    // Confirmed on a real system: Firefox's snap keeps its actual
    // profiles.ini under ~/snap/firefox/common/, not under the per-revision
    // dir snapDataDir() resolves — that dir goes stale after every update.
    expect(snapCommonDir("firefox")).toBe("/home/user/snap/firefox/common");
    expect(fileReadLink).not.toHaveBeenCalled();
  });
});

describe("FIREFOX_BROWSERS snap variant", () => {
  it("resolves its path via snapCommonDir, not the per-revision snapDataDir", async () => {
    const { FIREFOX_BROWSERS } = await import("../src/constants/firefox-browsers.constant");
    const snapEntry = FIREFOX_BROWSERS.find((b) => b.label === "Firefox (snap)");
    expect(snapEntry?.path).toBe("/home/user/snap/firefox/common/.mozilla/firefox/profiles.ini");
    // Other entries in this module (e.g. Zen's snap variant) legitimately use
    // the per-revision snapDataDir and do call file_read_link — only assert
    // Firefox's own resolution never reads the "firefox" revision symlink.
    expect(fileReadLink).not.toHaveBeenCalledWith("/snap/firefox/current");
  });
});

describe("LibreWolf and Tor Browser entries", () => {
  it("finds LibreWolf's profiles.ini in the nested librewolf/librewolf dir, native and Flatpak", async () => {
    const { FIREFOX_BROWSERS } = await import("../src/constants/firefox-browsers.constant");
    const paths = FIREFOX_BROWSERS.filter((b) => b.label.startsWith("LibreWolf")).map(
      (b) => b.path,
    );
    expect(paths).toContain("/home/user/.config/librewolf/librewolf/profiles.ini");
    expect(paths).toContain(
      "/home/user/.var/app/io.gitlab.librewolf-community/config/librewolf/librewolf/profiles.ini",
    );
  });

  it("lists Tor Browser as a simple browser, never as a profile family", async () => {
    const { FIREFOX_BROWSERS } = await import("../src/constants/firefox-browsers.constant");
    const { SIMPLE_BROWSERS } = await import("../src/constants/simple-browsers.constant");
    expect(FIREFOX_BROWSERS.some((b) => b.label.startsWith("Tor Browser"))).toBe(false);
    expect(SIMPLE_BROWSERS.filter((b) => b.label.startsWith("Tor Browser"))).toHaveLength(2);
  });
});

describe("IceCat Flatpak entry", () => {
  it("reads the profile from ~/.mozilla/icecat, where the Fedora Flatpak keeps it", async () => {
    const { FIREFOX_BROWSERS } = await import("../src/constants/firefox-browsers.constant");
    const entry = FIREFOX_BROWSERS.find((b) => b.label === "IceCat (flatpak)");
    expect(entry?.path).toBe("/home/user/.mozilla/icecat/profiles.ini");
  });
});
