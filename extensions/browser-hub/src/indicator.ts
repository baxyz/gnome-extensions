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

// this.menu is typed as PopupMenu | PopupDummyMenu — a union whose two
// `connect`/`disconnect` overloads don't unify for an ad-hoc signal name, so
// it's accessed through this minimal cast (same pattern as menu/shared.ts's tooltip()).
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
  // Bumped on every refreshEntries() call so a slow, older scan can't clobber
  // the menu after a newer one has already resolved (out-of-order settling).
  private _refreshSeq = 0;
  // null: the browser scan hasn't resolved yet (menu shows a loading row).
  private _lastEntries: ResolvedBrowserEntry[] | null = null;
  // Short messages for whatever failed during the last scan (e.g. a specific
  // family, or one browser within the Browsers row) — shown as a banner,
  // not just logged, so a partial failure isn't invisible to the user.
  private _lastErrors: string[] = [];
  private _menuOpenStateId: number | null = null;
  private _menuSignals!: MenuSignals;
  private _menuIsOpen = false;
  private _panelIcon: St.Icon;
  // Guards against a second Donut launch starting while one is already in
  // flight. Deliberately kept here rather than on the toolbar button itself —
  // fillMenu() tears down and rebuilds the whole menu (including that
  // button) on every redraw, so any state living on the button wouldn't
  // survive a close/reopen while the launch is still pending.
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

    // getDefaultBrowser() is cached (see default-browser.ts) for the
    // extension's lifetime — otherwise correct, but the OS default-browser
    // association can change externally (gnome-control-center, xdg-settings)
    // between menu opens. Bust the cache on every menu open so the toolbar
    // never shows a default browser that's gone stale since the last time it
    // was shown.
    // Disconnected in this.destroy() below, not via a "destroy" signal
    // handler — that indirection (connect to the signal now, disconnect
    // whenever it happens to fire later) isn't statically traceable back to
    // disable() the way overriding destroy() directly is, which is what
    // GNOME's extension review tooling actually checks for.
    this._menuSignals = this.menu as unknown as MenuSignals;
    this._menuOpenStateId = this._menuSignals.connect("open-state-changed", (_menu, isOpen) => {
      this._menuIsOpen = isOpen;
      if (isOpen) {
        clearDefaultBrowserCache();
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

    fillMenu({
      title: this._title,
      menu: this.menu,
      // Only the real, icon-heavy entries list (~50 browsers) is withheld
      // while the menu is closed — showing a loading row instead — since
      // nothing would be on screen to justify building it. fillMenu() itself
      // stays cheap either way, so there's no need to skip calling it.
      entries: this._menuIsOpen ? this._lastEntries : null,
      errors: this._menuIsOpen ? this._lastErrors : [],
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
    });
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
    if (icon) {
      this._panelIcon.set_gicon(icon);
    } else {
      this._panelIcon.set_icon_name(GENERIC_PANEL_ICON_NAME);
    }
  }
}
