import GLib from "gi://GLib";

export const HOME_DIR = GLib.get_home_dir();
export const XDG_CONFIG_HOME = GLib.getenv("XDG_CONFIG_HOME") || HOME_DIR + "/.config";
