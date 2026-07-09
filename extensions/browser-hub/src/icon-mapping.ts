/**
 * Maps known Firefox Profile Groups avatar ids and Zen Browser workspace
 * icon ids to real GNOME/Adwaita symbolic icon names, so they render as an
 * actual (recolorable) icon instead of literal text or a wrong glyph.
 *
 * Every entry below was checked against the real icon file list shipped in
 * Debian's `adwaita-icon-theme` 48.1-1 package (the base icon theme GNOME
 * Shell falls back to — gnome-shell itself bundles no icons of its own).
 * "Verified" means the icon file exists AND its SVG path data was inspected
 * to confirm it's a plausible visual match, not just a plausible-sounding
 * name. Entries with real ambiguity are marked "(approximate)".
 *
 * Names NOT in these tables have no adwaita-icon-theme equivalent at all —
 * verified absent, not just unresearched. resolveIconName() falls back to a
 * generic browser icon for these instead of guessing. If you confirm a real
 * match for one of these, move it into the table above this comment.
 *
 * Resolution happens once, where each profile/space is built (firefox.ts) —
 * not in the menu renderer, which just displays whatever icon name it's
 * given.
 *
 * Unmapped Firefox avatars (browser/components/profiles/SelectableProfile.sys.mjs):
 *   barbell, bike, briefcase, canvas, craft, diamond, flower, hammer,
 *   heart-rate, leaf, lightbulb, makeup, paw-print, present, shopping,
 *   soccer, sparkle-single
 *
 * Unmapped Zen workspace icons (zen-browser/desktop zen-icons/common/selectable):
 *   airplane, american-football, baseball, basket, bed, bell, briefcase,
 *   brush, bug, cafe, card, circle, cloud, coins, cutlery, egg,
 *   extension-puzzle, fast-food, fish, flag, flame, globe, globe-1,
 *   ice-cream, inbox, key, layers, logo-github, logo-usd, map, megaphone,
 *   nuclear, paw, pizza, planet, present, rocket, school, shapes, shirt,
 *   skull, square, stats-chart, tada, ticket, triangle, wallet, water, weight
 */

// Firefox's 28 standard avatars — see SelectableProfile.sys.mjs STANDARD_AVATARS.
export const FIREFOX_AVATAR_ICONS: Readonly<Record<string, string>> = {
  book: "accessories-dictionary-symbolic",
  folder: "folder-symbolic",
  heart: "emote-love-symbolic",
  history: "document-open-recent-symbolic", // approximate
  message: "chat-message-new-symbolic",
  "musical-note": "audio-x-generic-symbolic", // approximate
  palette: "applications-graphics-symbolic", // approximate
  plane: "airplane-mode-symbolic", // approximate
  star: "starred-symbolic",
  "video-game-controller": "input-gaming-symbolic",
  "default-favicon": "avatar-default-symbolic",
};

// Zen workspace icons — see zen-browser/desktop's zen-icons/common/selectable/*.svg.
export const ZEN_WORKSPACE_ICONS: Readonly<Record<string, string>> = {
  book: "accessories-dictionary-symbolic",
  bookmark: "bookmark-new-symbolic",
  build: "applications-engineering-symbolic", // approximate
  call: "call-start-symbolic",
  chat: "chat-message-new-symbolic",
  checkbox: "checkbox-symbolic",
  code: "utilities-terminal-symbolic", // approximate
  construct: "applications-engineering-symbolic", // approximate
  eye: "view-reveal-symbolic", // approximate
  flask: "applications-science-symbolic",
  folder: "folder-symbolic",
  "game-controller": "input-gaming-symbolic",
  "grid-2x2": "view-grid-symbolic", // approximate
  "grid-3x3": "view-grid-symbolic", // approximate
  heart: "emote-love-symbolic",
  image: "image-x-generic-symbolic",
  leaf: "emoji-nature-symbolic", // approximate, broad category icon
  lightning: "weather-storm-symbolic", // approximate
  location: "mark-location-symbolic",
  "lock-closed": "changes-prevent-symbolic", // approximate
  "logo-rss": "application-rss+xml-symbolic",
  mail: "mail-unread-symbolic",
  moon: "weather-clear-night-symbolic",
  music: "audio-x-generic-symbolic", // approximate
  navigate: "mark-location-symbolic", // approximate
  page: "text-x-generic-symbolic", // approximate
  palette: "applications-graphics-symbolic", // approximate
  people: "system-users-symbolic",
  "star-1": "starred-symbolic",
  star: "starred-symbolic",
  sun: "weather-clear-symbolic",
  terminal: "utilities-terminal-symbolic",
  time: "preferences-system-time-symbolic",
  trash: "user-trash-symbolic",
  video: "video-x-generic-symbolic", // approximate
  "volume-high": "audio-volume-high-symbolic",
  warning: "dialog-warning-symbolic",
  squares: "view-grid-symbolic", // approximate
};

// No icon is better than a wrong one, but a browser-shaped placeholder
// beats an empty slot for a raw id neither table recognizes.
export const FALLBACK_ICON_NAME = "web-browser-symbolic";

/**
 * Resolves a raw Firefox avatar id or Zen workspace icon id to a real,
 * ready-to-render GNOME icon name. Call this once, where the profile/space
 * is built — the menu renderer should never need to look these tables up
 * itself, just display whatever name it's given.
 */
export function resolveIconName(rawIcon: string | undefined): string {
  if (!rawIcon) return FALLBACK_ICON_NAME;
  return FIREFOX_AVATAR_ICONS[rawIcon] ?? ZEN_WORKSPACE_ICONS[rawIcon] ?? FALLBACK_ICON_NAME;
}
