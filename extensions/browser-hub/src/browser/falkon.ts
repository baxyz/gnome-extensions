import { settle } from "@helpers4/promise";
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import type { FalkonBrowserConfig, ResolvedBrowserEntry } from "../taxonomy";
import {
  buildBaseCommand,
  filterPresent,
  listDirEntries,
  resolveDesktopIcon,
  tagError,
} from "../internal";

async function listProfileDirs(dirPath: string): Promise<string[]> {
  const entries = await listDirEntries(
    dirPath,
    `[browser-hub] failed to list Falkon profiles directory ${dirPath}`,
  );
  return entries.filter((e) => e.type === Gio.FileType.DIRECTORY).map((e) => e.name);
}

export async function resolveFalkonBrowsers(
  browsers: FalkonBrowserConfig[],
): Promise<ResolvedBrowserEntry[]> {
  const { fulfilled, rejected } = await settle(
    filterPresent(browsers, GLib.FileTest.IS_DIR).map(async (b) => {
      try {
        return {
          label: b.label,
          items: (await listProfileDirs(b.path)).map((name) => ({
            label: name,
            command: [...buildBaseCommand(b.pkg), "--profile", name],
          })),
          icon: resolveDesktopIcon(b.pkg),
        };
      } catch (e) {
        tagError(b.label, e);
      }
    }),
  );
  for (const reason of rejected) {
    logError(reason as object, "[browser-hub] a Falkon browser failed to resolve");
  }
  return fulfilled.filter((e) => e.items.length > 0);
}
