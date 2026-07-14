import GLib from "gi://GLib";

export const HOME_DIR = GLib.get_home_dir();
export const XDG_CONFIG_HOME = GLib.getenv("XDG_CONFIG_HOME") || HOME_DIR + "/.config";

/**
 * A snap's system-wide /snap/<name>/current symlink always exists once it's
 * installed, but the per-user ~/snap/<name>/current mirror isn't guaranteed
 * to — confirmed on a real system where it was simply absent (both "current"
 * and "common" — the two conventions snaps use) even though the snap was
 * installed and had been run; the actual data lived directly under the
 * revision number (~/snap/<name>/652/...). Read the real active revision
 * from the reliable system-wide symlink instead of guessing a per-user
 * subdirectory name.
 */
export function snapDataDir(name: string): string {
  let revision = "current";
  try {
    revision = GLib.file_read_link(`/snap/${name}/current`);
  } catch {
    // Symlink missing/unreadable — fall back to the "current" alias some
    // snaps do create per-user; harmless if that's also absent, the
    // resolver's own file-existence check just filters the entry out.
  }
  return `${HOME_DIR}/snap/${name}/${revision}`;
}

/**
 * $SNAP_USER_COMMON — a fixed, unversioned per-user directory (unlike the
 * numbered revision dirs snapDataDir() resolves) that some snaps use
 * specifically so their data survives a revision upgrade instead of being
 * left behind in the old revision's directory. Confirmed for Mozilla's
 * Firefox snap: its actual profiles.ini lives under
 * ~/snap/firefox/common/.mozilla/firefox/, not under ~/snap/firefox/<rev>/ —
 * the per-revision path silently went stale after the very first snap
 * refresh past whatever revision was current when the profile was created.
 */
export function snapCommonDir(name: string): string {
  return `${HOME_DIR}/snap/${name}/common`;
}
