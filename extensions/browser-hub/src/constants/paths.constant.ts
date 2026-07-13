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
