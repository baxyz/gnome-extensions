import GObject from "gi://GObject";
import St from "gi://St";
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import { Button } from "resource:///org/gnome/shell/ui/panelMenu.js";
import { fillMenu, getBrowserEntries } from "./helper";
import type { BrowserSettings } from "./helper/digging.helper";
import { getDefaultBrowser } from "./helper/default-browser.helper";
import { SpaceType } from "./types/space-type.enum";

// -- Extension ----------------------------------------------------------------

export default class BrowserProfilesExtension extends Extension {
  private _indicator: BrowserProfilesIndicator | null = null;
  private _settingsChangedId = 0;

  enable() {
    const settings = this.getSettings();

    const readSettings = (): BrowserSettings => ({
      showFirefoxFamily: settings.get_boolean("show-firefox-family"),
      showChromeFamily: settings.get_boolean("show-chrome-family"),
      showSimpleBrowsers: settings.get_boolean("show-simple-browsers"),
      enabledSpaces: new Set(
        Object.values(SpaceType).filter((key) => settings.get_boolean(key)),
      ),
    });

    this._indicator = new GBrowserProfilesIndicator(
      this.metadata.name,
      () => this.openPreferences(),
      readSettings,
    );

    this._settingsChangedId = settings.connect("changed", () => {
      this._indicator?.refreshEntries();
    });

    Main.panel.addToStatusArea(this.uuid, this._indicator);
  }

  disable() {
    if (this._settingsChangedId) {
      this.getSettings().disconnect(this._settingsChangedId);
      this._settingsChangedId = 0;
    }
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

  constructor(title: string, onSettings: () => void, readSettings: () => BrowserSettings) {
    super(0.0, title);

    this._title = title;
    this._onSettings = onSettings;
    this._readSettings = readSettings;

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
    getBrowserEntries(this._readSettings()).then((entries) => {
      if (!this._alive) return;
      fillMenu({
        title: this._title,
        menu: this.menu,
        entries,
        notify: Main.notify,
        onSettings: this._onSettings,
        onRefresh: () => this.refreshEntries(),
        defaultBrowser: getDefaultBrowser(),
      });
    });
  }
}

const GBrowserProfilesIndicator = GObject.registerClass(BrowserProfilesIndicator);
