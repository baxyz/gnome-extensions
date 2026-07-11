import St from "gi://St";
import type Gio from "gi://Gio";
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
 * mappable-and-present avatar icon falls back to the browser's own real icon
 * (see internal/desktop-icon.ts), or nothing at all — while a space falls
 * back to a neutral dot (matching Zen's own space fallback, since both
 * render as small buttons in the same row).
 */
export function resolveFirefoxIcon(avatar: string | undefined, context: "space"): string;
export function resolveFirefoxIcon(
  avatar: string | undefined,
  context: "profile",
  browserIcon?: Gio.Icon,
): string | Gio.Icon | undefined;
export function resolveFirefoxIcon(
  avatar: string | undefined,
  context: IconContext,
  browserIcon?: Gio.Icon,
): string | Gio.Icon | undefined {
  const mapped = avatar ? FIREFOX_AVATAR_ICONS[avatar] : undefined;
  if (context === "space") {
    return firstExistingIcon(mapped) ?? SPACE_FALLBACK_ICON;
  }
  return firstExistingIcon(mapped) ?? browserIcon;
}

/**
 * Resolves a Zen Browser workspace icon id to a real, present GNOME icon name.
 * Zen icons are only ever used for spaces, so there's a single fallback:
 * the same neutral dot used for unmapped Firefox spaces.
 */
export function resolveZenIcon(icon: string | undefined): string {
  const mapped = icon ? ZEN_WORKSPACE_ICONS[icon] : undefined;
  return firstExistingIcon(mapped) ?? SPACE_FALLBACK_ICON;
}
