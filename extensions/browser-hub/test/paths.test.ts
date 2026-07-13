import { describe, it, expect, vi } from "vitest";

const fileReadLink = vi.fn();
vi.mock("gi://GLib", () => ({
  default: {
    get_home_dir: () => "/home/user",
    getenv: () => null,
    file_read_link: fileReadLink,
  },
}));

const { snapDataDir } = await import("../src/constants/paths.constant");

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
