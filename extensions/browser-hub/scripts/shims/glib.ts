import * as fs from "fs";
import * as os from "os";
import { execSync } from "child_process";

export enum FileTest {
  EXISTS = 16,
  IS_DIR = 4,
  IS_REGULAR = 8,
}

class KeyFile {
  private _groups: Record<string, Record<string, string>> = {};

  load_from_file(path: string, _flags: number): void {
    const content = fs.readFileSync(path, "utf8");
    let group = "";
    for (const raw of content.split("\n")) {
      const line = raw.trim();
      const grpMatch = line.match(/^\[(.+)\]$/);
      if (grpMatch) {
        group = grpMatch[1];
        this._groups[group] ??= {};
        continue;
      }
      const eq = line.indexOf("=");
      if (eq === -1 || !group) continue;
      this._groups[group][line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
    }
  }

  get_string(group: string, key: string): string {
    const val = this._groups[group]?.[key];
    if (val === undefined) throw new Error(`[${group}] ${key}: not found`);
    return val;
  }
}

export default {
  FileTest,
  KeyFile,
  KeyFileFlags: { NONE: 0 },
  PRIORITY_DEFAULT: 0,

  get_home_dir: (): string => os.homedir(),

  getenv: (key: string): string | null => process.env[key] ?? null,

  file_test: (path: string, test: FileTest): boolean => {
    try {
      const stat = fs.statSync(path);
      if (test === FileTest.IS_DIR) return stat.isDirectory();
      if (test === FileTest.IS_REGULAR) return stat.isFile();
      return true;
    } catch {
      return false;
    }
  },

  find_program_in_path: (binary: string): string | null => {
    try {
      return (
        execSync(`which "${binary}"`, {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
        }).trim() || null
      );
    } catch {
      return null;
    }
  },

  path_get_basename: (path: string): string => path.split("/").at(-1) ?? path,

  path_get_dirname: (path: string): string => {
    const parts = path.split("/");
    return parts.length > 1 ? parts.slice(0, -1).join("/") || "/" : ".";
  },

  spawn_command_line_async: (_cmd: string): boolean => true,
};
