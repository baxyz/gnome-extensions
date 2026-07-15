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
 * verified absent, not just unresearched. See resolve-icon.ts for how the
 * fallback is chosen for these. If you confirm a real match for one of
 * these, move it into the table above this comment.
 *
 * Unmapped Firefox avatars (browser/components/profiles/SelectableProfile.sys.mjs):
 *   barbell, bike, briefcase, canvas, craft, diamond, flower, hammer,
 *   heart-rate, lightbulb, makeup, paw-print, present, shopping, soccer
 *
 * Unmapped Zen workspace icons (zen-browser/desktop zen-icons/common/selectable):
 *   airplane, american-football, baseball, basket, bed, briefcase,
 *   brush, bug, cafe, card, circle, cloud, coins, cutlery, egg,
 *   extension-puzzle, fast-food, fish, flag, flame, globe, globe-1,
 *   ice-cream, inbox, layers, logo-github, logo-usd, map, megaphone,
 *   nuclear, paw, pizza, planet, present, rocket, school, shapes, shirt,
 *   skull, square, stats-chart, tada, ticket, triangle, wallet, water, weight
 */

// Firefox's 28 standard avatars — see SelectableProfile.sys.mjs STANDARD_AVATARS.
export const FIREFOX_AVATAR_ICONS: Readonly<Record<string, string>> = {
  book: "accessories-dictionary-symbolic",
  folder: "folder-symbolic",
  heart: "emote-love-symbolic",
  history: "document-open-recent-symbolic", // approximate
  leaf: "emoji-nature-symbolic", // approximate, broad category icon
  message: "chat-message-new-symbolic",
  "musical-note": "audio-x-generic-symbolic", // approximate
  palette: "applications-graphics-symbolic", // approximate
  plane: "airplane-mode-symbolic", // approximate
  "sparkle-single": "starred-symbolic", // approximate
  star: "starred-symbolic",
  "video-game-controller": "input-gaming-symbolic",
  "default-favicon": "avatar-default-symbolic",
};

// Zen workspace icons — see zen-browser/desktop's zen-icons/common/selectable/*.svg.
export const ZEN_WORKSPACE_ICONS: Readonly<Record<string, string>> = {
  bell: "alarm-symbolic", // approximate
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
  key: "dialog-password-symbolic", // approximate
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
