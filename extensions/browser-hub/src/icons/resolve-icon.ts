import St from "gi://St";
import GLib from "gi://GLib";
import { FIREFOX_AVATAR_ICONS, ZEN_WORKSPACE_ICONS } from "./icon-catalog";

/** Shown for a space without a usable icon. */
export const SPACE_FALLBACK_ICON = "media-record-symbolic";

export type IconContext = "profile" | "space";

// Created once; St.IconTheme follows theme changes on its own.
let iconTheme: St.IconTheme | undefined;

function theme(): St.IconTheme {
  iconTheme ??= new St.IconTheme();
  return iconTheme;
}

export function clearIconThemeCache(): void {
  iconTheme = undefined;
}

export function iconExists(name: string): boolean {
  return theme().has_icon(name);
}

function firstExistingIcon(...candidates: (string | undefined)[]): string | undefined {
  return candidates.find((name): name is string => name != null && iconExists(name));
}

/**
 * Icon for a Firefox avatar. With no match, a profile gets no icon and a
 * space gets the dot.
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

/** "chrome://browser/skin/zen-icons/selectable/<name>.svg" -> "<name>". Emojis pass through. */
function zenIconName(icon: string): string {
  return icon.endsWith(".svg") ? GLib.path_get_basename(icon).replace(/\.svg$/, "") : icon;
}

/** Icon for a Zen workspace, or the dot. */
export function resolveZenIcon(icon: string | undefined): string {
  const mapped = icon ? ZEN_WORKSPACE_ICONS[zenIconName(icon)] : undefined;
  return firstExistingIcon(mapped) ?? SPACE_FALLBACK_ICON;
}
