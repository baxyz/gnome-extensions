import GObject from "gi://GObject";
import St from "gi://St";
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import { Button } from "resource:///org/gnome/shell/ui/panelMenu.js";
import { fillMenu, getBrowserEntries } from "./helper";

// -- Extension ----------------------------------------------------------------

export default class BrowserProfilesExtension extends Extension {
  private _indicator: BrowserProfilesIndicator | null = null;

  enable() {
    this._indicator = new GBrowserProfilesIndicator(
      this.metadata.name,
      () => this.openPreferences(),
    );
    Main.panel.addToStatusArea(this.uuid, this._indicator);
  }

  disable() {
    if (this._indicator) {
      this._indicator.destroy();
      this._indicator = null;
    }
  }
}

// -- Indicator ----------------------------------------------------------------

class BrowserProfilesIndicator extends Button {
  private title: string;
  private _alive = true;
  private _onSettings: () => void;

  constructor(title: string, onSettings: () => void) {
    super(0.0, title);

    this.title = title;
    this._onSettings = onSettings;

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

  private refreshEntries(): void {
    getBrowserEntries().then((entries) => {
      if (!this._alive) return;
      fillMenu({
        title: this.title,
        menu: this.menu,
        entries,
        notify: Main.notify,
        onSettings: this._onSettings,
        onRefresh: () => this.refreshEntries(),
      });
    });
  }
}

const GBrowserProfilesIndicator = GObject.registerClass(BrowserProfilesIndicator);
