import { FIREFOX_AVATAR_ICONS, ZEN_WORKSPACE_ICONS } from "./icon-catalog";

/** Generic browser placeholder — used when a top-level profile has no mappable icon. */
export const BROWSER_FALLBACK_ICON = "web-browser-symbolic";

/** Plain filled dot — used when a space/workspace has no mappable icon. */
export const SPACE_FALLBACK_ICON = "media-record-symbolic";

export type IconContext = "profile" | "space";

/**
 * Resolves a Firefox Profile Groups avatar id to a real GNOME icon name.
 *
 * The same avatar vocabulary is used for two different UI contexts —
 * flattened top-level profiles ("profiles" mode) and nested space buttons
 * ("spaces" mode) — and they don't share a fallback: a profile with an
 * unmapped avatar falls back to a generic browser icon (it has no other
 * visual), while a space with an unmapped icon falls back to a neutral dot
 * (matching Zen's own space fallback, since both render as small buttons in
 * the same row).
 */
export function resolveFirefoxIcon(avatar: string | undefined, context: IconContext): string {
  const mapped = avatar ? FIREFOX_AVATAR_ICONS[avatar] : undefined;
  if (mapped) return mapped;
  return context === "space" ? SPACE_FALLBACK_ICON : BROWSER_FALLBACK_ICON;
}

/**
 * Resolves a Zen Browser workspace icon id to a real GNOME icon name.
 * Zen icons are only ever used for spaces, so there's a single fallback:
 * the same neutral dot used for unmapped Firefox spaces.
 */
export function resolveZenIcon(icon: string | undefined): string {
  return (icon ? ZEN_WORKSPACE_ICONS[icon] : undefined) ?? SPACE_FALLBACK_ICON;
}
