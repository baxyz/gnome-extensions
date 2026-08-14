import GObject from "gi://GObject";
import St from "gi://St";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import { Button } from "resource:///org/gnome/shell/ui/panelMenu.js";
import { getBrowserEntries } from "./browser";
import type { BrowserSettings } from "./browser";
import { fillMenu } from "./menu";
import {
  clearDesktopIconCache,
  clearPathPresenceCache,
  clearPkgResolutionCache,
  resolveDesktopIcon,
} from "./internal";
import { clearDefaultBrowserCache, getDefaultBrowser, setDefaultBrowser } from "./default-browser";
import type { DefaultBrowserInfo } from "./default-browser";
import { launchDonutBrowser } from "./donut-browser";
import type { ResolvedBrowserEntry, ResolvedBrowserItem, ResolvedBrowserPkg } from "./taxonomy";

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
  // Bumped on every refreshEntries() call so a slow, older scan can't clobber
  // the menu after a newer one has already resolved (out-of-order settling).
  private _refreshSeq = 0;
  // Bumped on every _draw() call — fillMenu() builds the Browsers row in
  // staggered batches (see buildSimpleBrowserRow), so a redraw can still be
  // in flight when a newer one starts (two settings changes in quick
  // succession, or a refresh landing mid-redraw). isLive() below lets a
  // superseded build detect that and stop touching a menu a newer _draw()
  // has already cleared and rebuilt.
  private _drawSeq = 0;
  // null: the browser scan hasn't resolved yet (menu shows a loading row).
  private _lastEntries: ResolvedBrowserEntry[] | null = null;
  // Short messages for whatever failed during the last scan (e.g. a specific
  // family, or one browser within the Browsers row) — shown as a banner,
  // not just logged, so a partial failure isn't invisible to the user.
  private _lastErrors: string[] = [];
  private _panelIcon: St.Icon;
  // Guards against a second Donut launch starting while one is already in
  // flight. Deliberately kept here rather than on the toolbar button itself —
  // fillMenu() tears down and rebuilds the whole menu (including that
  // button) on every redraw, so any state living on the button wouldn't
  // survive the redraw() call this same launch triggers.
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

    this._panelIcon = new St.Icon({
      icon_name: GENERIC_PANEL_ICON_NAME,
      style_class: "system-status-icon",
    });
    this.add_child(this._panelIcon);

    this.refreshEntries();
  }

  override destroy(): void {
    this._alive = false;
    super.destroy();
  }

  refreshEntries(): void {
    if (!this._alive) return;
    const seq = ++this._refreshSeq;
    // Shows the loading row immediately — matters both at construction (the
    // menu must never be empty, or GNOME Shell refuses to open it at all)
    // and on a manual refresh, while the new scan is still running.
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

  /** Redraws the menu from the last resolved entries — no filesystem re-scan. */
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
    fillMenu({
      isLive: () => this._alive && drawSeq === this._drawSeq,
      title: this._title,
      menu: this.menu,
      entries: this._lastEntries,
      errors: this._lastErrors,
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
            Main.notify(this._title, "Failed to launch the Donut browser");
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

  // Falls back to the generic icon whenever the setting is off, no default
  // browser is detected, or its .desktop file's icon can't be resolved —
  // resolveDesktopIcon() itself already reflects that same tolerance (see
  // internal/desktop-icon.ts), this just adds the setting as another reason
  // to prefer the generic icon.
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
