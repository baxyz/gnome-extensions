import Gio from "gi://Gio";
import GLib from "gi://GLib";
import { BrowserInfo, CONFIG_PATHS } from "../constants";

/**
 * Type definition for the browser profiles.
 */
export type BrowserProfiles = Pick<BrowserInfo, "label" | "command"> & {
  /**
   * List of profile names found in the configuration file.
   */
  profiles: string[];
};

/**
 * Get Firefox profiles
 * @returns {Promise<Array<BrowserProfiles>>} - Resolves with an array of Firefox profiles (empty if none found)
 */
export async function getFirefoxProfiles(): Promise<Array<BrowserProfiles>> {
  return Promise.all(
    CONFIG_PATHS.filter((browser) => isInstalled(browser)).map(async (browser) => ({
      ...browser,
      profiles: await getProfilesFromConfigFile(browser.path),
    })),
  );
}

/**
 * The profiles file exists and the command's program is in PATH. Some
 * browsers share a profiles file (Firefox and Firefox ESR): only the
 * installed one is listed.
 */
function isInstalled(browser: BrowserInfo): boolean {
  const program = browser.command.split(" ")[0];
  return (
    GLib.file_test(browser.path, GLib.FileTest.EXISTS) &&
    GLib.find_program_in_path(program) !== null
  );
}

function getProfilesFromConfigFile(path: string): Promise<string[]> {
  return new Promise((resolve) => {
    const file = Gio.File.new_for_path(path);
    file.load_contents_async(null, (_source, result) => {
      try {
        const [, contents] = file.load_contents_finish(result);
        const content = new TextDecoder().decode(contents);
        resolve([...content.matchAll(/Name=(.*)/g)].map((m) => m[1]));
      } catch {
        resolve([]);
      }
    });
  });
}
