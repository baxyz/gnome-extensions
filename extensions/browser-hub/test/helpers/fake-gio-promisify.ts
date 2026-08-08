// Mirrors GJS's real Gio._promisify (see src/internal/gio.ts) — strips a
// leading boolean from an array-shaped finish() result, passes through
// anything else unchanged. Shared by every test that mocks gi://Gio with a
// Gio.File class, since internal/gio.ts calls the real Gio._promisify on
// Gio.File.prototype at import time and needs a working mock of it.
export function fakeGioPromisify(
  proto: Record<string, (...args: unknown[]) => unknown>,
  asyncFn: string,
  finishFn: string,
): void {
  const original = proto[asyncFn];
  proto[asyncFn] = function (this: Record<string, (...args: unknown[]) => unknown>, ...args) {
    if (typeof args.at(-1) === "function") return original.apply(this, args);
    return new Promise((resolve, reject) => {
      original.call(this, ...args, (_source: unknown, result: unknown) => {
        try {
          const ret = this[finishFn](result);
          resolve(Array.isArray(ret) && typeof ret[0] === "boolean" ? ret.slice(1) : ret);
        } catch (e) {
          reject(e);
        }
      });
    });
  };
}
