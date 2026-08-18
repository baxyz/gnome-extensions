import GLib from "gi://GLib";
import Gio from "gi://Gio";
import type * as Main from "resource:///org/gnome/shell/ui/main.js";
import { PackageManager } from "./taxonomy";
import type { ResolvedBrowserItem, ResolvedBrowserPkg } from "./taxonomy";
import type { DefaultBrowserInfo } from "./default-browser";
import { snapCommonDir } from "./constants/paths.constant";
import { launchBrowser, pkgKey, writeTextFileAsync } from "./internal";

// Ordered by preference when the current default browser isn't itself
// eligible (see findDonutBrowser). Real Mozilla Gecko builds only — deliberately
// excludes:
// - Tor Browser: already routes through Tor with its own, much heavier
//   anti-fingerprinting; launching it in "quick incognito" mode doesn't fit.
// - Basilisk/Palemoon: run the Goanna engine, a pre-privacy.resistFingerprinting
//   Gecko fork — offering them here would risk a false sense of protection.
export const DONUT_PRIORITY: readonly string[] = [
  "Firefox",
  "Zen",
  "Floorp",
  "LibreWolf",
  "Mullvad Browser",
  "Waterfox",
  "Firedragon",
];

// Eligible, but not specifically prioritized — only reached as a last
// resort, in whatever order they appear in the "Browsers" row.
const DONUT_ALSO_ELIGIBLE: readonly string[] = ["Firefox ESR", "Ghostery Dawn", "IceCat"];

const DONUT_ELIGIBLE = new Set([...DONUT_PRIORITY, ...DONUT_ALSO_ELIGIBLE]);

// Strips the "Browsers" row's packaging-variant suffixes to get back the
// underlying browser identity a label was generated from (see
// expandFirefoxVariants in constants/firefox-browsers.constant.ts) —
// "Firefox (flatpak)" and "Firefox (classic)" are both still just Firefox.
function baseLabel(label: string): string {
  return label.replace(/\s\((?:flatpak|snap|classic)\)$/, "");
}

function samePkg(a: ResolvedBrowserPkg, b: ResolvedBrowserPkg): boolean {
  return pkgKey(a) === pkgKey(b);
}

/**
 * Browsers eligible for a Donut session, from the "Browsers" row's own
 * items. Snap-packaged browsers are included: strict confinement blocks a
 * Snap browser from opening a profile directory outside $HOME entirely
 * (confirmed — a snap can't see anything under $XDG_RUNTIME_DIR the way
 * every other Donut profile lives), so createDonutProfile() gives Snap
 * packages a profile dir under their own ~/snap/<name>/common instead —
 * always writable regardless of which interfaces are connected, since it's
 * the snap's own private data dir, not part of the confined "home" grant.
 * That dir isn't tmpfs-backed like the others, so launchDonutBrowser()
 * explicitly deletes it once the browser process exits.
 */
export function filterDonutEligible(
  browsers: readonly ResolvedBrowserItem[],
): (ResolvedBrowserItem & { pkg: ResolvedBrowserPkg })[] {
  return browsers.filter(
    (b): b is ResolvedBrowserItem & { pkg: ResolvedBrowserPkg } =>
      b.pkg !== undefined && DONUT_ELIGIBLE.has(baseLabel(b.label)),
  );
}

/**
 * Picks which installed browser a Donut (disposable, anti-fingerprint)
 * session should launch: the current default if it qualifies, else the
 * first `DONUT_PRIORITY` match, else whatever eligible browser comes first.
 */
export function findDonutBrowser(
  browsers: readonly ResolvedBrowserItem[],
  defaultBrowser: DefaultBrowserInfo | null,
): (ResolvedBrowserItem & { pkg: ResolvedBrowserPkg }) | null {
  const eligible = filterDonutEligible(browsers);
  if (eligible.length === 0) return null;

  if (defaultBrowser) {
    const match = eligible.find((b) => samePkg(b.pkg, defaultBrowser.pkg));
    if (match) return match;
  }

  for (const preferred of DONUT_PRIORITY) {
    const match = eligible.find((b) => baseLabel(b.label) === preferred);
    if (match) return match;
  }

  return eligible[0];
}

// Deleted along with the profile directory, so this only needs to cover one
// disposable session — not a full hardening profile. resistFingerprinting is
// Mozilla's own fingerprint-resistance mechanism (also what Tor Browser
// uses): it alone already covers canvas randomization, WebGL vendor/renderer
// spoofing, timezone spoofing (as Atlantic/Reykjavik), and MediaDevices
// spoofing — the letterboxing/spoof_english lines are companions arkenfox
// recommends alongside it to avoid known side effects (window-size and
// language-based fingerprinting RFP doesn't itself cover).
// Reference: https://github.com/arkenfox/user.js (sections 4501/4504/4506)
// A brand-new profile directory reads to Firefox as a genuine first launch,
// so without these it greets a Donut session with the full about:welcome
// tour, the "import from another browser" migration wizard, and the
// set-as-default-browser prompt — the opposite of "disposable and instant".
// Internal prefs, not a documented stable API — Mozilla has renamed a couple
// of these across major versions before, so a future Firefox update could
// silently bring one of these screens back; confirmed current as of Firefox
// ESR 128/stable 130-era. All Donut-eligible browsers are Firefox forks that
// still read prefs.js/user.js the same way, so one shared list covers them,
// though a hardened fork (e.g. LibreWolf) may already set some of these
// itself — redundant, not conflicting.
const DONUT_USER_JS = `// Generated by browser-hub's Donut profile feature.
user_pref("privacy.resistFingerprinting", true);
user_pref("privacy.resistFingerprinting.letterboxing", true);
user_pref("privacy.spoof_english", 1);
// Belt-and-suspenders alongside the profile itself being disposable: nothing
// persists to disk even during this session's own lifetime.
user_pref("browser.privatebrowsing.autostart", true);
// Skip the first-run onboarding tour, the browser-migration import wizard,
// and the "make default browser" prompt, so the profile opens ready to use.
user_pref("browser.aboutwelcome.enabled", false);
user_pref("browser.startup.homepage_override.mstone", "ignore");
user_pref("startup.homepage_welcome_url", "");
user_pref("startup.homepage_welcome_url.additional", "");
user_pref("browser.migration.version", 9999);
user_pref("browser.shell.checkDefaultBrowser", false);
user_pref("browser.uitour.enabled", false);
user_pref("trailhead.firstrun.didSeeAboutWelcome", true);
// Zen Browser (a Donut-eligible fork) has its own separate first-run
// screen on top of Firefox's about:welcome, gated by this Zen-specific
// pref — confirmed against zen-browser/desktop's own prefs/zen/welcome.yaml
// and test fixtures, which set exactly this to suppress it in their CI.
// No-op on every other Donut-eligible browser, same as the rest of this file.
user_pref("zen.welcome-screen.seen", true);
`;

function donutProfilesRoot(pkg: ResolvedBrowserPkg): string {
  // Snap: nothing under XDG_RUNTIME_DIR is visible inside strict confinement
  // at all (confirmed — it's remapped to a private per-snap location), but
  // the snap's own ~/snap/<name>/common always is, regardless of which
  // interfaces are connected. Not tmpfs-backed, so this one *is* cleaned up
  // explicitly — see launchDonutBrowser.
  if (pkg.manager === PackageManager.Snap) {
    return GLib.build_filenamev([snapCommonDir(pkg.name), "browser-hub-donut"]);
  }
  // Falls back to the system tmp dir on the (very unlikely) chance
  // XDG_RUNTIME_DIR is unset or empty — still cleaned up eventually, just not
  // guaranteed to be gone by the next login the way /run/user/<uid> is.
  // `||`, not `??`: some systems export XDG_RUNTIME_DIR as an empty string
  // rather than leaving it unset, which `??` wouldn't catch.
  const runtimeDir = GLib.getenv("XDG_RUNTIME_DIR") || GLib.get_tmp_dir();
  return GLib.build_filenamev([runtimeDir, "browser-hub", "donut"]);
}

/** Creates a fresh, empty profile directory with a minimal RFP user.js, and returns its path. */
export async function createDonutProfile(pkg: ResolvedBrowserPkg): Promise<string> {
  const dir = GLib.build_filenamev([donutProfilesRoot(pkg), GLib.uuid_string_random()]);
  Gio.File.new_for_path(dir).make_directory_with_parents(null);
  await writeTextFileAsync(GLib.build_filenamev([dir, "user.js"]), DONUT_USER_JS);
  return dir;
}

function buildDonutCommand(pkg: ResolvedBrowserPkg, profileDir: string): string[] {
  // -no-remote (not --no-remote): matches the dash style already used for
  // this same flag elsewhere in this codebase (see browser/firefox.ts).
  const profileArgs = ["--profile", profileDir, "-no-remote"];
  switch (pkg.manager) {
    case PackageManager.Native:
      return [pkg.binary, ...profileArgs];
    case PackageManager.Flatpak:
      // profileDir lives under XDG_RUNTIME_DIR, outside the Flatpak sandbox's
      // normal visibility — --filesystem grants access for this one launch
      // only, no change to the browser's own installed manifest.
      return ["flatpak", "run", `--filesystem=${profileDir}`, pkg.appId, ...profileArgs];
    case PackageManager.Snap:
      // profileDir is under this snap's own ~/snap/<name>/common (see
      // donutProfilesRoot), already inside its confinement — no ad-hoc
      // grant needed, unlike Flatpak above.
      return ["snap", "run", pkg.name, ...profileArgs];
  }
}

// Best-effort — a leftover directory under ~/snap/<name>/common/browser-hub-donut
// is orphaned junk, not a privacy leak (still gets a fresh uuid next launch),
// so a failure here is logged, not surfaced to the user.
function cleanupSnapDonutProfile(profileDir: string): void {
  try {
    Gio.Subprocess.new(["rm", "-rf", profileDir], Gio.SubprocessFlags.NONE);
  } catch (e: unknown) {
    logError(e as object, `[browser-hub] failed to clean up Donut profile ${profileDir}`);
  }
}

/** Creates a fresh Donut profile and launches `item` with it. */
export async function launchDonutBrowser(
  item: ResolvedBrowserItem & { pkg: ResolvedBrowserPkg },
  title: string,
  notify: typeof Main.notify,
): Promise<void> {
  const profileDir = await createDonutProfile(item.pkg);
  const subprocess = launchBrowser({
    command: buildDonutCommand(item.pkg, profileDir),
    title,
    notify,
  });
  // Only Snap's profile dir lives outside tmpfs (see donutProfilesRoot) and
  // so is the only one that needs an explicit delete once the browser exits.
  if (item.pkg.manager === PackageManager.Snap && subprocess) {
    subprocess.wait_async(null, () => cleanupSnapDonutProfile(profileDir));
  }
}
