import St from "gi://St";
import GLib from "gi://GLib";
import { FIREFOX_AVATAR_ICONS, ZEN_WORKSPACE_ICONS } from "./icon-catalog";

/** Plain filled dot — used when a space/workspace has no mappable, present icon. */
export const SPACE_FALLBACK_ICON = "media-record-symbolic";

export type IconContext = "profile" | "space";

// Icon presence depends on the icon theme installed on this machine, not on
// anything we can know in advance — St.IconTheme reads it once and rescans
// itself when the user switches theme, so one lazily-created instance can be
// reused for the extension's lifetime instead of rebuilt per lookup.
let iconTheme: St.IconTheme | undefined;

function theme(): St.IconTheme {
  iconTheme ??= new St.IconTheme();
  return iconTheme;
}

/** True if the current icon theme actually provides this icon name. */
export function iconExists(name: string): boolean {
  return theme().has_icon(name);
}

/** Returns the first candidate the current icon theme actually provides, or undefined if none are. */
function firstExistingIcon(...candidates: (string | undefined)[]): string | undefined {
  return candidates.find((name): name is string => name != null && iconExists(name));
}

/**
 * Resolves a Firefox Profile Groups avatar id to a real, present GNOME icon name.
 *
 * The same avatar vocabulary is used for two different UI contexts —
 * flattened top-level profiles ("profiles" mode) and nested space buttons
 * ("spaces" mode) — and they don't share a fallback: a profile with no
 * mappable-and-present avatar icon shows nothing (the browser's own icon is
 * shown once on the section header instead — see ResolvedBrowserEntry.icon),
 * while a space falls back to a neutral dot (matching Zen's own space
 * fallback, since both render as small buttons in the same row).
 */
export function resolveFirefoxIcon(avatar: string | undefined, context: "space"): string;
export function resolveFirefoxIcon(
  avatar: string | undefined,
  context: "profile",
): string | undefined;
export function resolveFirefoxIcon(
  avatar: string | undefined,
  context: IconContext,
): string | undefined {
  const mapped = avatar ? FIREFOX_AVATAR_ICONS[avatar] : undefined;
  return firstExistingIcon(mapped) ?? (context === "space" ? SPACE_FALLBACK_ICON : undefined);
}

/**
 * Zen stores a workspace's curated icon as a full URI —
 * "chrome://browser/skin/zen-icons/selectable/<name>.svg" — not the bare
 * <name> our mapping table is keyed by. Custom workspace icons (Zen's own
 * "ZenEmojiPicker" also lets users pick a plain emoji/text character, not
 * just a curated icon) never match this pattern and pass through unchanged,
 * which correctly still misses the mapping table and falls back below.
 */
function zenIconName(icon: string): string {
  return icon.endsWith(".svg") ? GLib.path_get_basename(icon).replace(/\.svg$/, "") : icon;
}

/**
 * Resolves a Zen Browser workspace icon id to a real, present GNOME icon name.
 * Zen icons are only ever used for spaces, so there's a single fallback:
 * the same neutral dot used for unmapped Firefox spaces.
 */
export function resolveZenIcon(icon: string | undefined): string {
  const mapped = icon ? ZEN_WORKSPACE_ICONS[zenIconName(icon)] : undefined;
  return firstExistingIcon(mapped) ?? SPACE_FALLBACK_ICON;
}
