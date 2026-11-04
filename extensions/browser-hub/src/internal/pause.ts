import GLib from "gi://GLib";

// Pending pause() timeouts, by source id, with the resolver to call if removed early.
const pending = new Map<number, (elapsed: boolean) => void>();

/** Resolves true after `ms`, or false if cancelPauses() removed the timeout first. */
export function pause(ms: number): Promise<boolean> {
  return new Promise((resolve) => {
    const id = GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => {
      pending.delete(id);
      resolve(true);
      return GLib.SOURCE_REMOVE;
    });
    pending.set(id, resolve);
  });
}

/** Removes every pending pause() timeout. Called on each menu rebuild and on disable(). */
export function cancelPauses(): void {
  for (const [id, resolve] of pending) {
    GLib.source_remove(id);
    resolve(false);
  }
  pending.clear();
}
