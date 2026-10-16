import Gio from "gi://Gio";
import type * as Main from "resource:///org/gnome/shell/ui/main.js";
import { PackageManager } from "../taxonomy";
import type { LaunchTarget, ResolvedBrowserPkg } from "../taxonomy";
import { getDesktopAppInfo } from "./gio";
import { resolveDesktopId } from "./desktop-icon";

// Every command this extension can spawn is spelled out below, one literal
// array per (launch kind, package manager). The only variable parts are:
// - the browser itself (binary, Flatpak app id, Snap name), always taken
//   from the constants/*-browsers.constant.ts lists;
// - profile names, profile paths and Zen workspace names, read from the
//   browsers' own files and checked by hasSafeValues() before use.

function browserArgv(pkg: ResolvedBrowserPkg): string[] {
  switch (pkg.manager) {
    case PackageManager.Native:
      return [pkg.binary];
    case PackageManager.Flatpak:
      return ["flatpak", "run", pkg.appId];
    case PackageManager.Snap:
      return ["snap", "run", pkg.name];
  }
}

function firefoxProfileArgv(pkg: ResolvedBrowserPkg, profile: string): string[] {
  switch (pkg.manager) {
    case PackageManager.Native:
      return [pkg.binary, "-P", profile, "-no-remote"];
    case PackageManager.Flatpak:
      return ["flatpak", "run", pkg.appId, "-P", profile, "-no-remote"];
    case PackageManager.Snap:
      return ["snap", "run", pkg.name, "-P", profile, "-no-remote"];
  }
}

function firefoxProfileDirArgv(pkg: ResolvedBrowserPkg, dir: string): string[] {
  switch (pkg.manager) {
    case PackageManager.Native:
      return [pkg.binary, "--profile", dir, "-no-remote"];
    case PackageManager.Flatpak:
      return ["flatpak", "run", pkg.appId, "--profile", dir, "-no-remote"];
    case PackageManager.Snap:
      return ["snap", "run", pkg.name, "--profile", dir, "-no-remote"];
  }
}

function zenWorkspaceArgv(pkg: ResolvedBrowserPkg, profile: string, workspace: string): string[] {
  switch (pkg.manager) {
    case PackageManager.Native:
      return [pkg.binary, "-P", profile, "--zen-workspace", workspace, "-no-remote"];
    case PackageManager.Flatpak:
      return [
        "flatpak",
        "run",
        pkg.appId,
        "-P",
        profile,
        "--zen-workspace",
        workspace,
        "-no-remote",
      ];
    case PackageManager.Snap:
      return ["snap", "run", pkg.name, "-P", profile, "--zen-workspace", workspace, "-no-remote"];
  }
}

function chromiumProfileArgv(pkg: ResolvedBrowserPkg, dir: string): string[] {
  switch (pkg.manager) {
    case PackageManager.Native:
      return [pkg.binary, `--profile-directory=${dir}`];
    case PackageManager.Flatpak:
      return ["flatpak", "run", pkg.appId, `--profile-directory=${dir}`];
    case PackageManager.Snap:
      return ["snap", "run", pkg.name, `--profile-directory=${dir}`];
  }
}

function falkonProfileArgv(pkg: ResolvedBrowserPkg, profile: string): string[] {
  switch (pkg.manager) {
    case PackageManager.Native:
      return [pkg.binary, "--profile", profile];
    case PackageManager.Flatpak:
      return ["flatpak", "run", pkg.appId, "--profile", profile];
    case PackageManager.Snap:
      return ["snap", "run", pkg.name, "--profile", profile];
  }
}

function donutArgv(pkg: ResolvedBrowserPkg, dir: string): string[] {
  switch (pkg.manager) {
    case PackageManager.Native:
      return [pkg.binary, "--profile", dir, "-no-remote"];
    case PackageManager.Flatpak:
      // The profile lives under $XDG_RUNTIME_DIR, outside the sandbox:
      // --filesystem grants access to that one directory for this launch only.
      return ["flatpak", "run", `--filesystem=${dir}`, pkg.appId, "--profile", dir, "-no-remote"];
    case PackageManager.Snap:
      // Already inside the snap's own ~/snap/<name>/common, no grant needed.
      return ["snap", "run", pkg.name, "--profile", dir, "-no-remote"];
  }
}

// A value read from a browser's files must never be taken as an option.
function isSafeName(value: string): boolean {
  return value !== "" && !value.startsWith("-");
}

function isAbsolutePath(value: string): boolean {
  return value.startsWith("/");
}

function hasSafeValues(target: LaunchTarget): boolean {
  switch (target.kind) {
    case "browser":
      return true;
    case "firefoxProfile":
    case "falkonProfile":
      return isSafeName(target.profile);
    case "zenWorkspace":
      return isSafeName(target.profile) && isSafeName(target.workspace);
    case "chromiumProfile":
      return isSafeName(target.dir);
    case "firefoxProfileDir":
    case "donut":
      return isAbsolutePath(target.dir);
  }
}

/** The argv `target` launches with, or null when one of its values is unsafe. */
export function buildArgv(target: LaunchTarget): string[] | null {
  if (!hasSafeValues(target)) return null;
  switch (target.kind) {
    case "browser":
      return browserArgv(target.pkg);
    case "firefoxProfile":
      return firefoxProfileArgv(target.pkg, target.profile);
    case "firefoxProfileDir":
      return firefoxProfileDirArgv(target.pkg, target.dir);
    case "zenWorkspace":
      return zenWorkspaceArgv(target.pkg, target.profile, target.workspace);
    case "chromiumProfile":
      return chromiumProfileArgv(target.pkg, target.dir);
    case "falkonProfile":
      return falkonProfileArgv(target.pkg, target.profile);
    case "donut":
      return donutArgv(target.pkg, target.dir);
  }
}

/**
 * Launches `pkg` through its own .desktop file, which handles Flatpak
 * portals, DBus activation and startup notification. False (never throws)
 * when the desktop id doesn't resolve or launch() fails, so the caller can
 * fall back to the argv path.
 */
function launchViaDesktopAppInfo(pkg: ResolvedBrowserPkg): boolean {
  const info = getDesktopAppInfo(resolveDesktopId(pkg));
  if (info === null) return false;
  try {
    return info.launch(null, null);
  } catch {
    return false;
  }
}

function notifyFailure(title: string, notify: typeof Main.notify): void {
  notify(title, "Failed to launch browser.");
}

/**
 * Launches `target`. A plain "browser" target goes through its .desktop file
 * first; everything else needs arguments a .desktop launch can't carry, so it
 * is spawned from buildArgv(). Returns the spawned process, or null if
 * nothing was spawned (launched via .desktop, or failed).
 */
export function launch(
  target: LaunchTarget,
  title: string,
  notify: typeof Main.notify,
): Gio.Subprocess | null {
  if (target.kind === "browser" && launchViaDesktopAppInfo(target.pkg)) return null;

  const argv = buildArgv(target);
  if (argv === null) {
    console.warn(`[browser-hub] refusing to launch a ${target.kind} with an unsafe value`);
    notifyFailure(title, notify);
    return null;
  }
  try {
    // argv form: no shell is involved.
    return Gio.Subprocess.new(argv, Gio.SubprocessFlags.NONE);
  } catch (e: unknown) {
    logError(e as object, `[${title}] Failed to launch browser.`);
    notifyFailure(title, notify);
    return null;
  }
}

/** Launches an already-resolved app through its .desktop entry, with no argv involved. */
export function launchAppInfo(info: Gio.AppInfo, title: string, notify: typeof Main.notify): void {
  try {
    info.launch(null, null);
  } catch (e: unknown) {
    logError(e as object, `[${title}] Failed to launch browser.`);
    notifyFailure(title, notify);
  }
}
