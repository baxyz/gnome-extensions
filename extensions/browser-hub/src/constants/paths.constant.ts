import GLib from "gi://GLib";

export const HOME_DIR = GLib.get_home_dir();
export const XDG_CONFIG_HOME = GLib.getenv("XDG_CONFIG_HOME") || HOME_DIR + "/.config";

/**
 * The snap's active revision dir, read from /snap/<name>/current: the
 * per-user ~/snap/<name>/current link doesn't always exist.
 */
export function snapDataDir(name: string): string {
  let revision = "current";
  try {
    revision = GLib.file_read_link(`/snap/${name}/current`);
  } catch {
    // Fall back to the per-user "current" link.
  }
  return `${HOME_DIR}/snap/${name}/${revision}`;
}

/** $SNAP_USER_COMMON: kept across revisions, unlike snapDataDir(). */
export function snapCommonDir(name: string): string {
  return `${HOME_DIR}/snap/${name}/common`;
}
