import GLib from "gi://GLib";
import type * as Main from "resource:///org/gnome/shell/ui/main.js";

/**
 * Open a browser with a specific profile.
 *
 * It will call `<command> -P <profile> -no-remote`.
 *
 * @param {string} profile name of the profile
 */
export function openBrowserProfile({
  command,
  profile,
  title,
  notify,
}: {
  command: string;
  profile: string;
  title: string;
  notify: typeof Main.notify;
}): void {
  const fullCommand = `${command} -P ${profile} -no-remote`;

  try {
    const success = GLib.spawn_command_line_async(fullCommand);

    if (!success) {
      notify(title, `Failed to start browser with the "${profile}" profile.`);
    }
  } catch (e: unknown) {
    const message = `An error occurred while launching browser with the "${profile}" profile.`;
    logError(e as object, `[${title}] ${message}`);
    notify(title, message);
  }
}
