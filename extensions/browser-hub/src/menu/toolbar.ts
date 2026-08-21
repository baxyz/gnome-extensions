import St from "gi://St";
import type * as Main from "resource:///org/gnome/shell/ui/main.js";
import { PopupMenuItem } from "resource:///org/gnome/shell/ui/popupMenu.js";
import { Spinner } from "resource:///org/gnome/shell/ui/animation.js";
import { PackageManager } from "../taxonomy";
import type { ResolvedBrowserItem, ResolvedBrowserPkg } from "../taxonomy";
import type { DefaultBrowserInfo } from "../default-browser";
import {
  getDesktopAppInfo,
  launchBrowser,
  resolveDesktopIcon,
  resolveDesktopId,
} from "../internal";
import { iconProps, makeIconButton, makeIconRow, tooltip } from "./shared";

const CHEVRON_ICON_SIZE = 16;

/**
 * Browsers pickable as a new default, from the "Browsers" row's own items.
 * setDefaultBrowser() needs a real Gio.DesktopAppInfo for the package's
 * desktop ID — resolvePkgUncached() only checks that the binary is on the
 * PATH, so a package can be "installed" here yet have no .desktop file at
 * all. Several ways that happens in practice: Snap's desktopIdFor()
 * "<name>_<name>.desktop" is a guess (confirmed against only a couple of
 * browsers); for Native, a binary can exist without the app being properly
 * installed — e.g. Fedora's epiphany-runtime package (pulled in as a
 * dependency for other apps' "web app" support) puts /usr/bin/epiphany on
 * the PATH but ships no org.gnome.Epiphany.desktop at all; and even a
 * properly installed Native app's desktop ID can just not match
 * "<binary>.desktop" (e.g. Fedora's Firefox RPM ships
 * org.mozilla.firefox.desktop) — resolveDesktopId() falls back to a
 * by-executable search for that case, same as setDefaultBrowser() does.
 * Flatpak is the only manager whose desktop ID is guaranteed to exist by the
 * packaging spec, so it's the only one skipped here. Verify the desktop ID
 * actually resolves before offering the row: setDefaultBrowser() does the
 * exact same lookup, so a resolvable ID here is confirmed to work there too.
 */
export function filterDefaultBrowserPickable(
  browsers: ResolvedBrowserItem[],
): (ResolvedBrowserItem & { pkg: ResolvedBrowserPkg })[] {
  return browsers.filter(
    (b): b is ResolvedBrowserItem & { pkg: ResolvedBrowserPkg } =>
      b.pkg !== undefined &&
      (b.pkg.manager === PackageManager.Flatpak ||
        getDesktopAppInfo(resolveDesktopId(b.pkg)) !== null),
  );
}

/**
 * "Launch default browser" row — clicking it launches, closing the menu.
 * The trailing chevron opens the default-browser picker page instead of
 * expanding a PopupSubMenuMenuItem inline (see menu/shared.ts's sub-page
 * builders for why that changed). Whether this whole row shows at all is
 * decided by the caller (see menu/index.ts) — "show-default-browser-edit"
 * gates the row, not just this chevron.
 */
const DEFAULT_BROWSER_ICON_SIZE = 20;

export function buildDefaultBrowserItem({
  title,
  defaultBrowser,
  onOpenDefaultBrowserPage,
  notify,
  closeMenu,
}: {
  title: string;
  defaultBrowser: DefaultBrowserInfo;
  onOpenDefaultBrowserPage: () => void;
  notify: typeof Main.notify;
  closeMenu: () => void;
}): PopupMenuItem {
  const icon = resolveDesktopIcon(defaultBrowser.pkg);
  const cmd = defaultBrowser.command;

  const menuItem = new PopupMenuItem("Launch default browser");
  tooltip(menuItem, `Launch ${defaultBrowser.name}`);
  const iconWidget = new St.Icon({
    ...iconProps(icon ?? "web-browser-symbolic"),
    icon_size: DEFAULT_BROWSER_ICON_SIZE,
  });
  menuItem.insert_child_below(iconWidget, menuItem.label);
  menuItem.connect("activate", () => {
    launchBrowser({ command: cmd, title, notify });
    closeMenu();
  });

  menuItem.add_child(new St.Widget({ x_expand: true }));
  const editBtn = new St.Button({
    can_focus: true,
    accessible_name: "Change default browser",
    style_class: "button browser-hub-toolbar-btn",
  });
  editBtn.set_child(new St.Icon({ icon_name: "go-next-symbolic", icon_size: CHEVRON_ICON_SIZE }));
  tooltip(editBtn, "Change default browser");
  editBtn.connect("clicked", onOpenDefaultBrowserPage);
  menuItem.add_child(editBtn);

  return menuItem;
}

const DONUT_ICON_SIZE = 20;
const DONUT_TOOLTIP = "Launch a burner, anti-fingerprint browser session";

/**
 * "Launch burner session" row — same shape as buildDefaultBrowserItem
 * above. "Burner" (as in "burner phone"), not "Donut" (this feature's
 * internal code name, meaningless to anyone reading the menu), "temporary"
 * (says nothing about the actual point), or "disposable" (accurate but
 * flatter — "burner" reads instantly as throwaway *and* anonymous).
 * Returns null when there's no Donut-eligible browser at all (see
 * findDonutBrowser) — no point offering a row that can't do anything, same
 * tolerance the old toolbar button had.
 */
export function buildDonutItem({
  donutBrowser,
  donutLaunching,
  onLaunchDonut,
  onOpenDonutPage,
  closeMenu,
}: {
  donutBrowser: (ResolvedBrowserItem & { pkg: ResolvedBrowserPkg }) | null;
  donutLaunching: boolean;
  onLaunchDonut: (item: ResolvedBrowserItem & { pkg: ResolvedBrowserPkg }) => void;
  onOpenDonutPage: () => void;
  closeMenu: () => void;
}): PopupMenuItem | null {
  if (!donutBrowser) return null;

  const menuItem = new PopupMenuItem("Launch burner session");
  tooltip(menuItem, DONUT_TOOLTIP);

  if (donutLaunching) {
    const spinner = new Spinner(DONUT_ICON_SIZE, { animate: true, hideOnStop: false });
    spinner.play();
    menuItem.insert_child_below(spinner, menuItem.label);
    menuItem.reactive = false;
  } else {
    // A masquerade mask, not an eye/eye-slash: this isn't "hide from the
    // browser" (that's what private/incognito mode already is), it's "be
    // someone the browser can't fingerprint" — anonymity, not concealment.
    const iconWidget = new St.Icon({
      icon_name: "view-private-symbolic",
      icon_size: DONUT_ICON_SIZE,
    });
    menuItem.insert_child_below(iconWidget, menuItem.label);
    menuItem.connect("activate", () => {
      onLaunchDonut(donutBrowser);
      closeMenu();
    });
  }

  menuItem.add_child(new St.Widget({ x_expand: true }));
  const moreBtn = new St.Button({
    can_focus: true,
    accessible_name: "Choose a different browser for the burner session",
    style_class: "button browser-hub-toolbar-btn",
    reactive: !donutLaunching,
  });
  moreBtn.set_child(new St.Icon({ icon_name: "go-next-symbolic", icon_size: CHEVRON_ICON_SIZE }));
  tooltip(moreBtn, "Choose a different browser");
  moreBtn.connect("clicked", onOpenDonutPage);
  menuItem.add_child(moreBtn);

  return menuItem;
}

/** Builds the toolbar row: spacer, Refresh, Settings. */
export function buildToolbar({
  onRefresh,
  onSettings,
}: {
  onRefresh: () => void;
  onSettings: () => void;
}): PopupMenuItem {
  const toolbar = makeIconRow();

  toolbar.add_child(new St.Widget({ x_expand: true }));
  toolbar.add_child(
    makeIconButton(
      "Refresh",
      "view-refresh-symbolic",
      16,
      onRefresh,
      "button browser-hub-toolbar-btn",
    ),
  );
  toolbar.add_child(
    makeIconButton(
      "Settings",
      "preferences-system-symbolic",
      16,
      onSettings,
      "button browser-hub-toolbar-btn",
    ),
  );

  return toolbar;
}
