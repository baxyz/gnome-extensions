import GObject from "gi://GObject";
import St from "gi://St";
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import { Button } from "resource:///org/gnome/shell/ui/panelMenu.js";
import { fillMenu, getBrowserProfiles } from "./helper";

// -- Extension ----------------------------------------------------------------

export default class BrowserProfilesExtension extends Extension {
  private _indicator: BrowserProfilesIndicator | null = null;

  enable() {
    this._indicator = new GBrowserProfilesIndicator(this.metadata.name);
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

  constructor(title: string) {
    super(0.0, title);

    this.title = title;

    this.add_child(
      new St.Icon({
        icon_name: "firefox-symbolic",
        style_class: "system-status-icon",
      }),
    );

    this.refreshProfiles();
  }

  private refreshProfiles(): void {
    getBrowserProfiles().then((profiles) =>
      fillMenu({
        title: this.title,
        menu: this.menu,
        profiles,
        notify: Main.notify,
      }),
    );
  }
}

const GBrowserProfilesIndicator = GObject.registerClass(BrowserProfilesIndicator);
