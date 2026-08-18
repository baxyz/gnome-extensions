import Gio from "gi://Gio";
import type * as Main from "resource:///org/gnome/shell/ui/main.js";

/** Returns the launched Gio.Subprocess, or null if launching failed. */
export function launchBrowser({
  command,
  title,
  notify,
}: {
  command: string[];
  title: string;
  notify: typeof Main.notify;
}): Gio.Subprocess | null {
  try {
    // argv form — no shell involved, so profile names/paths never need escaping.
    return Gio.Subprocess.new(command, Gio.SubprocessFlags.NONE);
  } catch (e: unknown) {
    logError(e as object, `[${title}] Failed to launch browser.`);
    notify(title, "Failed to launch browser.");
    return null;
  }
}
