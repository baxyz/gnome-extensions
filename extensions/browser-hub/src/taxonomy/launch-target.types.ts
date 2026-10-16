import type { ResolvedBrowserPkg } from "./browser-package.types";

/**
 * What a menu entry launches. Never an argv: internal/launch.ts is the only
 * place that turns one of these into a command.
 */
export type LaunchTarget =
  /** The browser itself, no arguments. */
  | { kind: "browser"; pkg: ResolvedBrowserPkg }
  /** A Firefox-family profile by name (`-P <profile>`). */
  | { kind: "firefoxProfile"; pkg: ResolvedBrowserPkg; profile: string }
  /** A Firefox-family profile by absolute path (`--profile <dir>`). */
  | { kind: "firefoxProfileDir"; pkg: ResolvedBrowserPkg; dir: string }
  /** A Zen workspace inside a profile (`-P <profile> --zen-workspace <workspace>`). */
  | { kind: "zenWorkspace"; pkg: ResolvedBrowserPkg; profile: string; workspace: string }
  /** A Chromium-family profile by its folder name under the user data dir. */
  | { kind: "chromiumProfile"; pkg: ResolvedBrowserPkg; dir: string }
  /** A Falkon profile by name. */
  | { kind: "falkonProfile"; pkg: ResolvedBrowserPkg; profile: string }
  /** A throwaway Firefox-family profile at an absolute path (see donut-browser.ts). */
  | { kind: "donut"; pkg: ResolvedBrowserPkg; dir: string };
