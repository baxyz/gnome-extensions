import { SpaceType } from "./taxonomy/space-type.enum";

const SPACE_TYPE_VALUES = Object.values(SpaceType);

/**
 * Keys that need a rescan. The others only redraw the menu. Every schema
 * key must be in this list or in COSMETIC_KEYS (checked by a test).
 */
export const ENTRY_AFFECTING_KEYS = new Set<string>([
  "show-firefox-family",
  "show-chrome-family",
  "show-simple-browsers",
  "show-profiled-browsers",
  "show-single-profile-detail",
  "firefox-profile-groups-mode",
  ...SPACE_TYPE_VALUES,
]);

/** Keys that only change how the menu looks. */
export const COSMETIC_KEYS = new Set<string>([
  "show-toolbar",
  "show-default-browser-edit",
  "show-default-browser-panel-icon",
  "show-donut-browser",
]);

/** Sub-setting key -> parent key. A sub-setting only applies while its parent is on. */
export const SUB_SETTING_PARENTS: Readonly<Record<string, string>> = {
  "show-default-browser-edit": "show-toolbar",
  "show-donut-browser": "show-toolbar",
};
