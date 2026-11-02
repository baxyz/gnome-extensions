import St from "gi://St";
import type * as Main from "resource:///org/gnome/shell/ui/main.js";
import { PopupMenuItem } from "resource:///org/gnome/shell/ui/popupMenu.js";
import { Spinner } from "resource:///org/gnome/shell/ui/animation.js";
import { PackageManager } from "../taxonomy";
import type { ResolvedBrowserItem, ResolvedBrowserPkg } from "../taxonomy";
import type { DefaultBrowserInfo } from "../default-browser";
import {
  getDesktopAppInfo,
  launchAppInfo,
  resolveDesktopIcon,
  resolveDesktopId,
} from "../internal";
import { iconProps, makeIconButton, makeIconRow, tooltip } from "./shared";

const CHEVRON_ICON_SIZE = 16;

/**
 * Browsers that can become the default. Only those whose desktop file
 * exists: setDefaultBrowser() needs it, and a binary on the PATH doesn't
 * guarantee one (e.g. Fedora's epiphany-runtime).
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

/** "Launch default browser" row; its chevron opens the picker page. */
const DEFAULT_BROWSER_ICON_SIZE = 16;

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

  const menuItem = new PopupMenuItem("Launch default browser");
  tooltip(menuItem, `Launch ${defaultBrowser.name}`);
  const iconWidget = new St.Icon({
    ...iconProps(icon ?? "web-browser-symbolic"),
    icon_size: DEFAULT_BROWSER_ICON_SIZE,
  });
  menuItem.insert_child_below(iconWidget, menuItem.label);
  menuItem.connect("activate", () => {
    launchAppInfo(defaultBrowser.appInfo, title, notify);
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

const DONUT_ICON_SIZE = 16;
const DONUT_TOOLTIP = "Launch a burner, anti-fingerprint browser session";

/** "Launch burner session" row, or null when no browser supports it. */
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
    // Exists in both Adwaita and Yaru.
    const iconWidget = new St.Icon({
      icon_name: "preferences-system-privacy-symbolic",
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
