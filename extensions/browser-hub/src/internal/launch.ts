import Gio from "gi://Gio";
import type * as Main from "resource:///org/gnome/shell/ui/main.js";
import { PackageManager } from "../taxonomy";
import type { LaunchTarget, ResolvedBrowserPkg } from "../taxonomy";
import { getDesktopAppInfo } from "./gio";
import { resolveDesktopId } from "./desktop-icon";

// Every spawned command is a literal array below. Only the browser (from
// constants/) and values read from its files (checked by hasSafeValues())
// vary.

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

function zenWorkspaceArgv(pkg: ResolvedBrowserPkg, profile: string, spaceUuid: string): string[] {
  switch (pkg.manager) {
    case PackageManager.Native:
      return [pkg.binary, "-P", profile, "--space", spaceUuid, "-no-remote"];
    case PackageManager.Flatpak:
      return ["flatpak", "run", pkg.appId, "-P", profile, "--space", spaceUuid, "-no-remote"];
    case PackageManager.Snap:
      return ["snap", "run", pkg.name, "-P", profile, "--space", spaceUuid, "-no-remote"];
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
      // The profile is outside the sandbox: grant access to it for this launch.
      return ["flatpak", "run", `--filesystem=${dir}`, pkg.appId, "--profile", dir, "-no-remote"];
    case PackageManager.Snap:
      // Already in the snap's own directory.
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
      return isSafeName(target.profile) && isSafeName(target.spaceUuid);
    case "chromiumProfile":
      return isSafeName(target.dir);
    case "firefoxProfileDir":
    case "donut":
      return isAbsolutePath(target.dir);
  }
}

/** The argv for `target`, or null when one of its values is unsafe. */
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
      return zenWorkspaceArgv(target.pkg, target.profile, target.spaceUuid);
    case "chromiumProfile":
      return chromiumProfileArgv(target.pkg, target.dir);
    case "falkonProfile":
      return falkonProfileArgv(target.pkg, target.profile);
    case "donut":
      return donutArgv(target.pkg, target.dir);
  }
}

/** Launches `pkg` through its .desktop file. False if that's not possible. */
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
 * Launches `target`. A plain browser goes through its .desktop file first;
 * other targets need arguments, so they are spawned from buildArgv().
 * Returns the spawned process, if any.
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
    return Gio.Subprocess.new(argv, Gio.SubprocessFlags.NONE);
  } catch (e: unknown) {
    logError(e as object, `[${title}] Failed to launch browser.`);
    notifyFailure(title, notify);
    return null;
  }
}

/** Launches an app through its .desktop entry. */
export function launchAppInfo(info: Gio.AppInfo, title: string, notify: typeof Main.notify): void {
  try {
    info.launch(null, null);
  } catch (e: unknown) {
    logError(e as object, `[${title}] Failed to launch browser.`);
    notifyFailure(title, notify);
  }
}
