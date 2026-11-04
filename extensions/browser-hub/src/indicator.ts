import GObject from "gi://GObject";
import St from "gi://St";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import { Button } from "resource:///org/gnome/shell/ui/panelMenu.js";
import { getBrowserEntries } from "./browser";
import type { BrowserSettings } from "./browser";
import { fillMenu } from "./menu";
import type { MenuPage } from "./menu";
import {
  clearDesktopIconCache,
  clearPathPresenceCache,
  cancelPauses,
  clearPkgResolutionCache,
  resolveDesktopIcon,
} from "./internal";
import { clearDefaultBrowserCache, getDefaultBrowser, setDefaultBrowser } from "./default-browser";
import type { DefaultBrowserInfo } from "./default-browser";
import { launchDonutBrowser } from "./donut-browser";
import type { ResolvedBrowserEntry, ResolvedBrowserItem, ResolvedBrowserPkg } from "./taxonomy";

// this.menu's union type has no usable connect() for this signal name.
type MenuSignals = {
  connect(sig: "open-state-changed", cb: (menu: unknown, isOpen: boolean) => void): number;
  disconnect(id: number): void;
};

const GENERIC_PANEL_ICON_NAME = "web-browser-symbolic";

export type ToolbarSettings = {
  showToolbar: boolean;
  showDefaultBrowserEdit: boolean;
  showDefaultBrowserPanelIcon: boolean;
  showDonutBrowser: boolean;
};

export class BrowserProfilesIndicator extends Button {
  static {
    GObject.registerClass(this);
  }

  private _title: string;
  private _alive = true;
  private _onSettings: () => void;
  private _readSettings: () => BrowserSettings;
  private _readToolbarSettings: () => ToolbarSettings;
  // Lets an older scan that finishes late be ignored.
  private _refreshSeq = 0;
  // Lets a menu build still in progress notice a newer one has started.
  private _drawSeq = 0;
  // null while the scan is running.
  private _lastEntries: ResolvedBrowserEntry[] | null = null;
  // What failed during the last scan, shown as a banner.
  private _lastErrors: string[] = [];
  private _menuOpenStateId: number | null = null;
  private _menuSignals!: MenuSignals;
  // Current sub-page, reset to "main" when the popup closes.
  private _page: MenuPage = "main";
  private _panelIcon: St.Icon;
  // Kept here, not on the button: the menu is rebuilt on every redraw.
  private _donutLaunching = false;

  constructor(
    title: string,
    onSettings: () => void,
    readSettings: () => BrowserSettings,
    readToolbarSettings: () => ToolbarSettings,
  ) {
    super(0.0, title);

    this._title = title;
    this._onSettings = onSettings;
    this._readSettings = readSettings;
    this._readToolbarSettings = readToolbarSettings;

    // Return to the main page once the popup is closed. Disconnected in destroy().
    this._menuSignals = this.menu as unknown as MenuSignals;
    this._menuOpenStateId = this._menuSignals.connect("open-state-changed", (_menu, isOpen) => {
      if (!isOpen && this._page !== "main") {
        this._page = "main";
        this.redrawMenu();
      }
    });

    this._panelIcon = new St.Icon({
      icon_name: GENERIC_PANEL_ICON_NAME,
      style_class: "system-status-icon",
    });
    this.add_child(this._panelIcon);

    this.refreshEntries();
  }

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
    // Show the loading row right away: GNOME Shell won't open an empty menu.
    this._lastEntries = null;
    this._lastErrors = [];
    this._draw();
    getBrowserEntries(this._readSettings())
      .then(({ entries, errors }) => {
        if (!this._alive || seq !== this._refreshSeq) return;
        this._lastEntries = entries;
        this._lastErrors = errors;
        this._draw();
      })
      .catch((e: unknown) => logError(e as object, "[browser-hub] refreshEntries failed"));
  }

  /** Redraws from the last scan, without rescanning. */
  redrawMenu(): void {
    if (!this._alive) return;
    this._draw();
  }

  private _draw(): void {
    const { showToolbar, showDefaultBrowserEdit, showDefaultBrowserPanelIcon, showDonutBrowser } =
      this._readToolbarSettings();
    const defaultBrowser = getDefaultBrowser();
    this._updatePanelIcon(showDefaultBrowserPanelIcon, defaultBrowser);

    const drawSeq = ++this._drawSeq;
    // The previous build's pending pauses: it is being replaced.
    cancelPauses();
    fillMenu({
      isLive: () => this._alive && drawSeq === this._drawSeq,
      title: this._title,
      menu: this.menu,
      entries: this._lastEntries,
      errors: this._lastErrors,
      notify: Main.notify,
      onSettings: this._onSettings,
      page: this._page,
      onOpenDefaultBrowserPage: () => {
        this._page = "default-browser";
        this.redrawMenu();
      },
      onOpenDonutPage: () => {
        this._page = "donut";
        this.redrawMenu();
      },
      onBack: () => {
        this._page = "main";
        this.redrawMenu();
      },
      onRefresh: () => {
        // Clear the caches so a browser installed meanwhile shows up.
        clearPkgResolutionCache();
        clearPathPresenceCache();
        clearDesktopIconCache();
        clearDefaultBrowserCache();
        this.refreshEntries();
      },
      defaultBrowser,
      showToolbar,
      showDefaultBrowserEdit,
      onSetDefaultBrowser: (pkg: ResolvedBrowserPkg) => {
        if (!setDefaultBrowser(pkg)) {
          Main.notify(this._title, "Couldn't set that browser as default");
        }
        this.redrawMenu();
      },
      showDonutBrowser,
      donutLaunching: this._donutLaunching,
      onLaunchDonut: (item: ResolvedBrowserItem & { pkg: ResolvedBrowserPkg }) => {
        if (this._donutLaunching) return;
        this._donutLaunching = true;
        this.redrawMenu();
        launchDonutBrowser(item, this._title, Main.notify)
          .catch((e: unknown) => {
            logError(e as object, "[browser-hub] failed to launch Donut browser");
            Main.notify(this._title, "Failed to launch the burner browser");
          })
          .finally(() => {
            this._donutLaunching = false;
            if (!this._alive) return;
            this.redrawMenu();
            this.menu.close();
          });
      },
    }).catch((e: unknown) => logError(e as object, "[browser-hub] fillMenu failed"));
  }

  private _updatePanelIcon(
    showDefaultBrowserPanelIcon: boolean,
    defaultBrowser: DefaultBrowserInfo | null,
  ): void {
    const icon =
      showDefaultBrowserPanelIcon && defaultBrowser && resolveDesktopIcon(defaultBrowser.pkg);
    if (typeof icon === "string") {
      this._panelIcon.set_icon_name(icon);
    } else if (icon) {
      this._panelIcon.set_gicon(icon);
    } else {
      this._panelIcon.set_icon_name(GENERIC_PANEL_ICON_NAME);
    }
  }
}
