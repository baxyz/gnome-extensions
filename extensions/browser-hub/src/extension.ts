import Gio from "gi://Gio";
import GLib from "gi://GLib";
import GObject from "gi://GObject";
import St from "gi://St";
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import { Button } from "resource:///org/gnome/shell/ui/panelMenu.js";
import { getBrowserEntries } from "./browser";
import type { BrowserSettings, ProfileGroupsMode } from "./browser";
import { fillMenu } from "./menu";
import { clearDesktopIconCache, clearPathPresenceCache, clearPkgResolutionCache } from "./internal";
import { clearDefaultBrowserCache, getDefaultBrowser } from "./default-browser";
import { SpaceType } from "./taxonomy/space-type.enum";
import type { ResolvedBrowserEntry } from "./taxonomy";
import { ENTRY_AFFECTING_KEYS } from "./settings-keys";

// this.menu is typed as PopupMenu | PopupDummyMenu — a union whose two
// `connect`/`disconnect` overloads don't unify for an ad-hoc signal name, so
// it's accessed through this minimal cast (same pattern as menu.ts's tooltip()).
type MenuSignals = {
  connect(sig: "open-state-changed", cb: (menu: unknown, isOpen: boolean) => void): number;
  disconnect(id: number): void;
};

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
      showProfiledBrowsers: settings.get_boolean("show-profiled-browsers"),
      // Gschema key is the positive/"show" framing (consistent with every
      // other switch, default off); BrowserSettings/resolve-all.ts keep the
      // "collapse" framing since that's what the resolution logic actually
      // does — inverted right here, at the one boundary between the two.
      collapseSingleProfileBrowsers: !settings.get_boolean("show-single-profile-detail"),
      enabledSpaces: new Set(SPACE_TYPE_VALUES.filter((key) => settings.get_boolean(key))),
      profileGroupsMode: settings.get_string("firefox-profile-groups-mode") as ProfileGroupsMode,
    });

    this._indicator = new GBrowserProfilesIndicator(
      this.metadata.name,
      () => this.openPreferences(),
      readSettings,
      () => ({
        showToolbar: settings.get_boolean("show-toolbar"),
        showDefaultBrowserEdit: settings.get_boolean("show-default-browser-edit"),
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
    if (this._indicator) {
      this._indicator.destroy();
      this._indicator = null;
    }
    // GNOME Shell doesn't re-import this module on a plain disable→enable
    // (only on unload/update/Shell restart), so the module-level pkg/icon
    // caches would otherwise survive with pre-disable data — bust them so a
    // browser installed/removed while disabled is picked up on next enable().
    clearPkgResolutionCache();
    clearPathPresenceCache();
    clearDesktopIconCache();
    clearDefaultBrowserCache();
  }
}

// -- Indicator ----------------------------------------------------------------

class BrowserProfilesIndicator extends Button {
  private _title: string;
  private _alive = true;
  private _onSettings: () => void;
  private _readSettings: () => BrowserSettings;
  private _readToolbarSettings: () => { showToolbar: boolean; showDefaultBrowserEdit: boolean };
  // Bumped on every refreshEntries() call so a slow, older scan can't clobber
  // the menu after a newer one has already resolved (out-of-order settling).
  private _refreshSeq = 0;
  private _lastEntries: ResolvedBrowserEntry[] = [];
  private _menuOpenStateId: number | null = null;
  private _menuSignals!: MenuSignals;

  constructor(
    title: string,
    onSettings: () => void,
    readSettings: () => BrowserSettings,
    readToolbarSettings: () => { showToolbar: boolean; showDefaultBrowserEdit: boolean },
  ) {
    super(0.0, title);

    this._title = title;
    this._onSettings = onSettings;
    this._readSettings = readSettings;
    this._readToolbarSettings = readToolbarSettings;

    // getDefaultBrowser() is cached (see default-browser.ts) for the
    // extension's lifetime — otherwise correct, but the OS default-browser
    // association can change via this menu's own "change default browser"
    // button, which just opens gnome-control-center with no callback when it
    // closes. Bust the cache on every menu open so the toolbar never shows a
    // default browser that's gone stale since the last time it was shown.
    // Disconnected in this.destroy() below, not via a "destroy" signal
    // handler — that indirection (connect to the signal now, disconnect
    // whenever it happens to fire later) isn't statically traceable back to
    // disable() the way overriding destroy() directly is, which is what
    // GNOME's extension review tooling actually checks for.
    this._menuSignals = this.menu as unknown as MenuSignals;
    this._menuOpenStateId = this._menuSignals.connect("open-state-changed", (_menu, isOpen) => {
      if (isOpen) {
        clearDefaultBrowserCache();
        this.redrawMenu();
      }
    });

    this.add_child(
      new St.Icon({
        icon_name: "web-browser-symbolic",
        style_class: "system-status-icon",
      }),
    );

    this.refreshEntries();
  }

  // Called by disable() via this._indicator.destroy() — disconnect our own
  // signal before handing off to the base class's own teardown.
  override destroy(): void {
    this._alive = false;
    if (this._menuOpenStateId !== null) {
      this._menuSignals.disconnect(this._menuOpenStateId);
      this._menuOpenStateId = null;
    }
    super.destroy();
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
    const { showToolbar, showDefaultBrowserEdit } = this._readToolbarSettings();
    fillMenu({
      title: this._title,
      menu: this.menu,
      entries: this._lastEntries,
      notify: Main.notify,
      onSettings: this._onSettings,
      onRefresh: () => {
        // Manual refresh is the user's explicit way to pick up a browser
        // installed/removed since the last scan — bust the caches first.
        clearPkgResolutionCache();
        clearPathPresenceCache();
        clearDesktopIconCache();
        clearDefaultBrowserCache();
        this.refreshEntries();
      },
      defaultBrowser: getDefaultBrowser(),
      showToolbar,
      showDefaultBrowserEdit,
    });
  }
}

const GBrowserProfilesIndicator = GObject.registerClass(BrowserProfilesIndicator);
