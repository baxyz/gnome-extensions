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
  "show-profiled-browsers",
  "show-single-profile-detail",
  "firefox-profile-groups-mode",
  ...SPACE_TYPE_VALUES,
]);

/** Settings keys that only affect how the menu is drawn, not what it contains. */
export const COSMETIC_KEYS = new Set<string>(["show-toolbar", "show-default-browser-edit"]);

/**
 * Sub-setting gschema key -> its parent key. A sub-setting only takes effect
 * when its parent is also on (see BrowserSettings's shouldCollapseSingle-
 * ProfileBrowsers in browser/resolve-all.ts for the corresponding runtime
 * check on the parsed settings, and prefs.ts for the UI sensitivity bind) —
 * this table is the single place recording WHICH keys are paired this way,
 * so adding a new sub-setting means updating one table instead of hand-
 * duplicating the relationship in both resolve-all.ts and prefs.ts.
 */
export const SUB_SETTING_PARENTS: Readonly<Record<string, string>> = {
  "show-single-profile-detail": "show-profiled-browsers",
  "show-default-browser-edit": "show-toolbar",
};
