import Gio from "gi://Gio";
import GLib from "gi://GLib";
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import type { BrowserSettings, ProfileGroupsMode } from "./browser";
import {
  cancelPauses,
  clearDesktopIconCache,
  clearPathPresenceCache,
  clearPkgResolutionCache,
} from "./internal";
import { clearDefaultBrowserCache } from "./default-browser";
import { cancelDonutCleanups } from "./donut-browser";
import { clearIconThemeCache } from "./icons";
import { SpaceType } from "./taxonomy/space-type.enum";
import { ENTRY_AFFECTING_KEYS } from "./settings-keys";
import { BrowserProfilesIndicator } from "./indicator";

const SPACE_TYPE_VALUES = Object.values(SpaceType);
// Groups quick successive settings changes into one menu rebuild.
const SETTINGS_DEBOUNCE_MS = 50;

export default class BrowserProfilesExtension extends Extension {
  private _indicator: BrowserProfilesIndicator | null = null;
  private _settings: Gio.Settings | null = null;
  private _settingsChangedId = 0;
  private _refreshDebounceId = 0;
  // True if any change in the current debounce window needs a rescan.
  private _pendingNeedsRescan = false;

  enable() {
    const settings = this.getSettings();
    this._settings = settings;

    const readSettings = (): BrowserSettings => ({
      showFirefoxFamily: settings.get_boolean("show-firefox-family"),
      showChromeFamily: settings.get_boolean("show-chrome-family"),
      showSimpleBrowsers: settings.get_boolean("show-simple-browsers"),
      showProfiledBrowsers: settings.get_boolean("show-profiled-browsers"),
      // The setting is "show", the code uses "collapse".
      collapseSingleProfileBrowsers: !settings.get_boolean("show-single-profile-detail"),
      enabledSpaces: new Set(SPACE_TYPE_VALUES.filter((key) => settings.get_boolean(key))),
      profileGroupsMode: settings.get_string("firefox-profile-groups-mode") as ProfileGroupsMode,
    });

    this._indicator = new BrowserProfilesIndicator(
      this.metadata.name,
      () => this.openPreferences(),
      readSettings,
      () => ({
        showToolbar: settings.get_boolean("show-toolbar"),
        showDefaultBrowserEdit: settings.get_boolean("show-default-browser-edit"),
        showDefaultBrowserPanelIcon: settings.get_boolean("show-default-browser-panel-icon"),
        showDonutBrowser: settings.get_boolean("show-donut-browser"),
      }),
    );

    this._settingsChangedId = settings.connect("changed", (_settings, key: string) => {
      this._pendingNeedsRescan ||= ENTRY_AFFECTING_KEYS.has(key);
      if (this._refreshDebounceId) {
        GLib.source_remove(this._refreshDebounceId);
        this._refreshDebounceId = 0;
      }
      this._refreshDebounceId = GLib.timeout_add(
        GLib.PRIORITY_DEFAULT,
        SETTINGS_DEBOUNCE_MS,
        () => {
          this._refreshDebounceId = 0;
          const needsRescan = this._pendingNeedsRescan;
          this._pendingNeedsRescan = false;
          if (needsRescan) {
            this._indicator?.refreshEntries();
          } else {
            this._indicator?.redrawMenu();
          }
          return GLib.SOURCE_REMOVE;
        },
      );
    });

    Main.panel.addToStatusArea(this.uuid, this._indicator);
  }

  disable() {
    if (this._refreshDebounceId) {
      GLib.source_remove(this._refreshDebounceId);
      this._refreshDebounceId = 0;
    }
    this._pendingNeedsRescan = false;
    if (this._settingsChangedId && this._settings) {
      this._settings.disconnect(this._settingsChangedId);
      this._settingsChangedId = 0;
    }
    this._settings = null;
    cancelPauses();
    if (this._indicator) {
      this._indicator.destroy();
      this._indicator = null;
    }
    cancelDonutCleanups();
    // Module caches survive disable/enable, so clear them.
    clearPkgResolutionCache();
    clearPathPresenceCache();
    clearDesktopIconCache();
    clearDefaultBrowserCache();
    clearIconThemeCache();
  }
}
