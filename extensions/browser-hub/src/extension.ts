import Gio from "gi://Gio";
import GLib from "gi://GLib";
import GObject from "gi://GObject";
import St from "gi://St";
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import { Button } from "resource:///org/gnome/shell/ui/panelMenu.js";
import { clearPkgResolutionCache, fillMenu, getBrowserEntries } from "./helper";
import type { BrowserSettings, ProfileGroupsMode } from "./helper/digging.helper";
import { getDefaultBrowser } from "./helper/default-browser.helper";
import { SpaceType } from "./types/space-type.enum";
import type { ResolvedBrowserEntry } from "./types";

const SPACE_TYPE_VALUES = Object.values(SpaceType);

// Keys that change the actual set of resolved browsers/profiles and therefore
// need a full re-scan. "show-default-browser-edit" deliberately isn't here —
// it only toggles a toolbar button, so it's handled as a cheap redraw instead.
const ENTRY_AFFECTING_KEYS = new Set<string>([
  "show-firefox-family",
  "show-chrome-family",
  "show-simple-browsers",
  "firefox-profile-groups-mode",
  ...SPACE_TYPE_VALUES,
]);

// -- Extension ----------------------------------------------------------------

export default class BrowserProfilesExtension extends Extension {
  private _indicator: BrowserProfilesIndicator | null = null;
  private _settings: Gio.Settings | null = null;
  private _settingsChangedId = 0;
  private _refreshDebounceId = 0;

  enable() {
    const settings = this.getSettings();
    this._settings = settings;

    const readSettings = (): BrowserSettings => ({
      showFirefoxFamily: settings.get_boolean("show-firefox-family"),
      showChromeFamily: settings.get_boolean("show-chrome-family"),
      showSimpleBrowsers: settings.get_boolean("show-simple-browsers"),
      enabledSpaces: new Set(SPACE_TYPE_VALUES.filter((key) => settings.get_boolean(key))),
      profileGroupsMode: settings.get_string("firefox-profile-groups-mode") as ProfileGroupsMode,
    });

    this._indicator = new GBrowserProfilesIndicator(
      this.metadata.name,
      () => this.openPreferences(),
      readSettings,
      () => settings.get_boolean("show-default-browser-edit"),
    );

    this._settingsChangedId = settings.connect("changed", (_settings, key: string) => {
      if (this._refreshDebounceId) {
        GLib.source_remove(this._refreshDebounceId);
        this._refreshDebounceId = 0;
      }
      const needsRescan = ENTRY_AFFECTING_KEYS.has(key);
      this._refreshDebounceId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 50, () => {
        this._refreshDebounceId = 0;
        if (needsRescan) {
          this._indicator?.refreshEntries();
        } else {
          this._indicator?.redrawMenu();
        }
        return GLib.SOURCE_REMOVE;
      });
    });

    Main.panel.addToStatusArea(this.uuid, this._indicator);
  }

  disable() {
    if (this._refreshDebounceId) {
      GLib.source_remove(this._refreshDebounceId);
      this._refreshDebounceId = 0;
    }
    if (this._settingsChangedId && this._settings) {
      this._settings.disconnect(this._settingsChangedId);
      this._settingsChangedId = 0;
    }
    this._settings = null;
    if (this._indicator) {
      this._indicator.destroy();
      this._indicator = null;
    }
  }
}

// -- Indicator ----------------------------------------------------------------

class BrowserProfilesIndicator extends Button {
  private _title: string;
  private _alive = true;
  private _onSettings: () => void;
  private _readSettings: () => BrowserSettings;
  private _readShowEditBtn: () => boolean;
  // Bumped on every refreshEntries() call so a slow, older scan can't clobber
  // the menu after a newer one has already resolved (out-of-order settling).
  private _refreshSeq = 0;
  private _lastEntries: ResolvedBrowserEntry[] = [];

  constructor(
    title: string,
    onSettings: () => void,
    readSettings: () => BrowserSettings,
    readShowEditBtn: () => boolean,
  ) {
    super(0.0, title);

    this._title = title;
    this._onSettings = onSettings;
    this._readSettings = readSettings;
    this._readShowEditBtn = readShowEditBtn;

    this.connect("destroy", () => {
      this._alive = false;
    });

    this.add_child(
      new St.Icon({
        icon_name: "web-browser-symbolic",
        style_class: "system-status-icon",
      }),
    );

    this.refreshEntries();
  }

  refreshEntries(): void {
    if (!this._alive) return;
    const seq = ++this._refreshSeq;
    getBrowserEntries(this._readSettings())
      .then((entries) => {
        if (!this._alive || seq !== this._refreshSeq) return;
        this._lastEntries = entries;
        this._draw();
      })
      .catch((e: unknown) => logError(e as object, "[browser-hub] refreshEntries failed"));
  }

  /** Redraws the menu from the last resolved entries — no filesystem re-scan. */
  redrawMenu(): void {
    if (!this._alive) return;
    this._draw();
  }

  private _draw(): void {
    fillMenu({
      title: this._title,
      menu: this.menu,
      entries: this._lastEntries,
      notify: Main.notify,
      onSettings: this._onSettings,
      onRefresh: () => {
        // Manual refresh is the user's explicit way to pick up a browser
        // installed/removed since the last scan — bust the cache first.
        clearPkgResolutionCache();
        this.refreshEntries();
      },
      defaultBrowser: getDefaultBrowser(),
      showDefaultBrowserEdit: this._readShowEditBtn(),
    });
  }
}

const GBrowserProfilesIndicator = GObject.registerClass(BrowserProfilesIndicator);
