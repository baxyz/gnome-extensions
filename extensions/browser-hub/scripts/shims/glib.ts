import * as fs from "fs";
import * as os from "os";
import { execSync } from "child_process";

export enum FileTest {
  EXISTS = 16,
  IS_DIR = 4,
  IS_REGULAR = 8,
}

export default {
  FileTest,
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

  spawn_command_line_async: (_cmd: string): boolean => true,
};
