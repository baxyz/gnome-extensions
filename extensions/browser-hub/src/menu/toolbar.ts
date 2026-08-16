import St from "gi://St";
import type * as Main from "resource:///org/gnome/shell/ui/main.js";
import { PopupMenuItem } from "resource:///org/gnome/shell/ui/popupMenu.js";
import { Spinner } from "resource:///org/gnome/shell/ui/animation.js";
import { PackageManager } from "../taxonomy";
import type { ResolvedBrowserItem, ResolvedBrowserPkg } from "../taxonomy";
import type { DefaultBrowserInfo } from "../default-browser";
import { launchBrowser, resolveDesktopIcon } from "../internal";
import { iconProps, makeIconButton, makeIconRow, tooltip } from "./shared";

const CHEVRON_ICON_SIZE = 16;

/**
 * Browsers pickable as a new default, from the "Browsers" row's own items.
 * Snap excluded: desktopIdFor()'s "<name>_<name>.desktop" guess for Snap is
 * only verified against a couple of browsers, and a wrong guess here feeds
 * straight into setDefaultBrowser() failing silently.
 */
export function filterDefaultBrowserPickable(
  browsers: ResolvedBrowserItem[],
): (ResolvedBrowserItem & { pkg: ResolvedBrowserPkg })[] {
  return browsers.filter(
    (b): b is ResolvedBrowserItem & { pkg: ResolvedBrowserPkg } =>
      b.pkg !== undefined && b.pkg.manager !== PackageManager.Snap,
  );
}

/**
 * "Launch default browser" row — clicking it launches, closing the menu.
 * The trailing chevron (only when showDefaultBrowserEdit is on) opens the
 * default-browser picker page instead of expanding a PopupSubMenuMenuItem
 * inline (see menu/shared.ts's sub-page builders for why that changed).
 */
const DEFAULT_BROWSER_ICON_SIZE = 24;

export function buildDefaultBrowserItem({
  title,
  defaultBrowser,
  showDefaultBrowserEdit,
  onOpenDefaultBrowserPage,
  notify,
  closeMenu,
}: {
  title: string;
  defaultBrowser: DefaultBrowserInfo;
  showDefaultBrowserEdit: boolean;
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

  if (showDefaultBrowserEdit) {
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
  }

  return menuItem;
}

const DONUT_ICON_SIZE = 24;
const DONUT_TOOLTIP = "Launch a disposable, anti-fingerprint browser session";

/**
 * "Launch temporary session" row — same shape as buildDefaultBrowserItem
 * above. Returns null when there's no Donut-eligible browser at all (see
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

  const menuItem = new PopupMenuItem("Launch temporary session");
  tooltip(menuItem, DONUT_TOOLTIP);

  if (donutLaunching) {
    const spinner = new Spinner(DONUT_ICON_SIZE, { animate: true, hideOnStop: false });
    spinner.play();
    menuItem.insert_child_below(spinner, menuItem.label);
    menuItem.reactive = false;
  } else {
    const iconWidget = new St.Icon({
      icon_name: "view-conceal-symbolic",
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
    accessible_name: "Choose a different browser for the temporary session",
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
