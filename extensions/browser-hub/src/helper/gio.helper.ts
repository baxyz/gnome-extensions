import Gio from "gi://Gio";

export function readFileAsync(path: string): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const file = Gio.File.new_for_path(path);
    file.load_contents_async(null, (_source, result) => {
      try {
        const [, contents] = file.load_contents_finish(result);
        resolve(contents);
      } catch (e) {
        reject(e);
      }
    });
  });
}
