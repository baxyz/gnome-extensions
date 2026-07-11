import { SpaceType } from "./taxonomy/space-type.enum";

const SPACE_TYPE_VALUES = Object.values(SpaceType);

/**
 * Settings keys whose change requires a full browser/profile re-scan
 * (extension.ts routes these to refreshEntries(), everything else to the
 * cheaper redrawMenu()). Every key in the gschema must be listed here or in
 * COSMETIC_KEYS — see test/settings-keys.test.ts, which fails the build if
 * a new key is added to the schema without being classified here.
 */
export const ENTRY_AFFECTING_KEYS = new Set<string>([
  "show-firefox-family",
  "show-chrome-family",
  "show-simple-browsers",
  "firefox-profile-groups-mode",
  ...SPACE_TYPE_VALUES,
]);

/** Settings keys that only affect how the menu is drawn, not what it contains. */
export const COSMETIC_KEYS = new Set<string>(["show-default-browser-edit"]);
