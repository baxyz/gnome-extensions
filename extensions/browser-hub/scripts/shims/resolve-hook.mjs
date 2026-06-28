const SHIMS = new Map([
  ["gi://GLib", new URL("./glib.ts", import.meta.url).href],
  ["gi://Gio", new URL("./gio.ts", import.meta.url).href],
  ["gi://GObject", new URL("./gnome-shell.ts", import.meta.url).href],
  ["gi://St", new URL("./gnome-shell.ts", import.meta.url).href],
  ["gi://Clutter", new URL("./gnome-shell.ts", import.meta.url).href],
]);

export function resolve(specifier, context, nextResolve) {
  if (SHIMS.has(specifier)) {
    return { url: SHIMS.get(specifier), shortCircuit: true };
  }
  if (specifier.startsWith("resource:///")) {
    return {
      url: new URL("./gnome-shell.ts", import.meta.url).href,
      shortCircuit: true,
    };
  }
  return nextResolve(specifier, context);
}
