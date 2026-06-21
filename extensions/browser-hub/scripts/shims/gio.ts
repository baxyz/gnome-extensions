import * as fs from "fs";
import * as nodepath from "path";

const FileQueryInfoFlags = { NONE: 0 };
const FileType = { DIRECTORY: "directory" as const };

function makeEnumerator(dirPath: string) {
  let entries: fs.Dirent[] = [];
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    /* missing or unreadable */
  }
  let i = 0;
  return {
    next_file: (_cancel: null) => {
      const e = entries[i++];
      if (!e) return null;
      return {
        get_name: () => e.name,
        get_file_type: () => (e.isDirectory() ? FileType.DIRECTORY : ("file" as const)),
      };
    },
    close: (_cancel: null) => {},
  };
}

function newFile(filePath: string) {
  let _contents: Uint8Array | null = null;

  return {
    get_parent: () => ({
      get_path: (): string => nodepath.dirname(filePath),
    }),

    enumerate_children: (_attrs: string, _flags: number, _cancel: null) => {
      return makeEnumerator(filePath);
    },

    enumerate_children_async: (
      _attrs: string,
      _flags: number,
      _priority: number,
      _cancel: null,
      cb: (src: null, res: { filePath: string }) => void,
    ) => {
      cb(null, { filePath });
    },

    enumerate_children_finish: (res: { filePath: string }) => {
      return makeEnumerator(res.filePath);
    },

    load_contents_async: (_cancel: null, cb: (src: null, res: unknown) => void) => {
      try {
        _contents = new Uint8Array(fs.readFileSync(filePath));
      } catch {
        _contents = null;
      }
      cb(null, {});
    },

    load_contents_finish: (_res: unknown): [boolean, Uint8Array] => {
      if (!_contents) throw new Error(`Cannot read: ${filePath}`);
      return [true, _contents];
    },
  };
}

export default {
  File: { new_for_path: newFile },
  FileQueryInfoFlags,
  FileType,
};
