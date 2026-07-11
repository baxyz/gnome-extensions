import Gio from "gi://Gio";
import GLib from "gi://GLib";
import GObject from "gi://GObject";
import St from "gi://St";
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import { Button } from "resource:///org/gnome/shell/ui/panelMenu.js";
import { clearPkgResolutionCache, fillMenu, getBrowserEntries } from "./helper";
import type { BrowserSettings, ProfileGroupsMode } from "./helper/browser-resolution.helper";
import { getDefaultBrowser } from "./helper/default-browser.helper";
import { SpaceType } from "./taxonomy/space-type.enum";
import type { ResolvedBrowserEntry } from "./taxonomy";
import { ENTRY_AFFECTING_KEYS } from "./settings-keys";

const SPACE_TYPE_VALUES = Object.values(SpaceType);
// Debounce delay for settings changes (ms) — batch rapid setting changes to avoid
// redundant menu rebuilds while the user is still adjusting preferences.
const SETTINGS_DEBOUNCE_MS = 50;

// -- Extension ----------------------------------------------------------------

export default class BrowserProfilesExtension extends Extension {
  private _indicator: BrowserProfilesIndicator | null = null;
  private _settings: Gio.Settings | null = null;
  private _settingsChangedId = 0;
  private _refreshDebounceId = 0;
  // Accumulated (OR'd) across every "changed" event coalesced into the
  // current debounce window, so an entry-affecting key isn't forgotten just
  // because a later, cosmetic-only key change re-armed the timer after it.
  private _pendingNeedsRescan = false;

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
    if (this._indicator) {
      this._indicator.destroy();
      this._indicator = null;
    }
    // GNOME Shell doesn't re-import this module on a plain disable→enable
    // (only on unload/update/Shell restart), so the module-level pkg cache
    // would otherwise survive with pre-disable data — bust it so a browser
    // installed/removed while disabled is picked up on the next enable().
    clearPkgResolutionCache();
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
