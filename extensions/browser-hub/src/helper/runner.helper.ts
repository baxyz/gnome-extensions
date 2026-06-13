import GLib from "gi://GLib";
import type * as Main from "resource:///org/gnome/shell/ui/main.js";

export function launchBrowser({
  command,
  title,
  notify,
}: {
  command: string;
  title: string;
  notify: typeof Main.notify;
}): void {
  try {
    const success = GLib.spawn_command_line_async(command);
    if (!success) {
      notify(title, "Failed to launch browser.");
    }
  } catch (e: unknown) {
    logError(e as object, `[${title}] Failed to launch browser.`);
    notify(title, "Failed to launch browser.");
  }
}
