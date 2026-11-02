/**
 * Firefox avatar and Zen workspace icon ids mapped to Adwaita symbolic
 * icons. Ids without an Adwaita equivalent are left out:
 *
 * Firefox: barbell, bike, briefcase, canvas, craft, diamond, flower, hammer,
 *   heart-rate, lightbulb, makeup, paw-print, present, shopping, soccer
 *
 * Zen: airplane, american-football, baseball, basket, bed, briefcase,
 *   brush, bug, cafe, card, circle, cloud, coins, cutlery, egg,
 *   extension-puzzle, fast-food, fish, flag, flame, globe, globe-1,
 *   ice-cream, inbox, layers, logo-github, logo-usd, map, megaphone,
 *   nuclear, paw, pizza, planet, present, rocket, school, shapes, shirt,
 *   skull, square, stats-chart, tada, ticket, triangle, wallet, water, weight
 */

// Firefox: SelectableProfile.sys.mjs, STANDARD_AVATARS.
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

// Zen: zen-icons/common/selectable/*.svg.
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
