// @girs/gnome-shell-46's typings for extensions/extension.js don't declare
// InjectionManager (@girs only started typing it from the 47 package on),
// even though gnome-shell 46 itself exports it — confirmed against
// js/extensions/extension.js on the gnome-46 branch. Backfilling it here so
// type-checking against the 46 typings package doesn't fail on an export
// that's genuinely present at runtime. TypeScript merges this with @girs's
// own ambient declaration for the same module specifier.
declare module "resource:///org/gnome/shell/extensions/extension.js" {
  class InjectionManager {
    overrideMethod<
      T,
      M extends keyof T,
      F extends (T[M] extends (...args: any[]) => any ? T[M] : never),
    >(
      prototype: T,
      methodName: M,
      createOverrideFunc: (
        this: T,
        originalMethod: F,
      ) => (this: T, ...args: Parameters<F>) => ReturnType<F>,
    ): void;
    restoreMethod<T, M extends keyof T>(prototype: T, methodName: M): void;
    clear(): void;
  }
  export { InjectionManager };
}
