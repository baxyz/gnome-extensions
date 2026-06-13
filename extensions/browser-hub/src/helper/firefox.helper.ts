import Gio from "gi://Gio";
import GLib from "gi://GLib";
import type { FirefoxBrowserConfig } from "../types";
import type { ResolvedBrowserEntry } from "../types";

function parseProfiles(content: string): string[] {
  return [...content.matchAll(/^Name=(.+)/gm)].map((m) => m[1]);
}

function buildCommand(baseCommand: string, profileName: string): string {
  return `${baseCommand} -P "${profileName}" -no-remote`;
}

function readProfiles(path: string): Promise<string[]> {
  return new Promise((resolve) => {
    const file = Gio.File.new_for_path(path);
    file.load_contents_async(null, (_source, result) => {
      try {
        const [, contents] = file.load_contents_finish(result);
        resolve(parseProfiles(new TextDecoder().decode(contents)));
      } catch {
        resolve([]);
      }
    });
  });
}

export async function resolveFirefoxBrowsers(
  browsers: FirefoxBrowserConfig[],
): Promise<ResolvedBrowserEntry[]> {
  const entries = await Promise.all(
    browsers
      .filter((b) => GLib.file_test(b.path, GLib.FileTest.EXISTS))
      .map(async (b) => {
        const profiles = await readProfiles(b.path);
        return {
          label: b.label,
          items: profiles.map((name) => ({
            label: name,
            command: buildCommand(b.command, name),
          })),
        };
      }),
  );
  return entries.filter((e) => e.items.length > 0);
}
