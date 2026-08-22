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
 * all. For Native, a binary can exist without the app being properly
 * installed — e.g. Fedora's epiphany-runtime package (pulled in as a
 * dependency for other apps' "web app" support) puts /usr/bin/epiphany on
 * the PATH but ships no org.gnome.Epiphany.desktop at all. And even a
 * properly installed Native/Snap app's desktop ID can just not match the
 * guess (Fedora's Firefox RPM ships org.mozilla.firefox.desktop, not
 * firefox.desktop; Snap's "<name>_<name>.desktop" is itself only confirmed
 * against a couple of browsers) — resolveDesktopId() falls back to a
 * by-executable search for both those cases, same as setDefaultBrowser()
 * does. Flatpak is the only manager whose desktop ID is guaranteed to exist
 * by the packaging spec, so it's the only one with no fallback to fall back
 * to. Verify the desktop ID actually resolves before offering the row:
 * setDefaultBrowser() does the exact same lookup, so a resolvable ID here is
 * confirmed to work there too.
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
  const cmd = defaultBrowser.command;
  const pkg = defaultBrowser.pkg;

  const menuItem = new PopupMenuItem("Launch default browser");
  tooltip(menuItem, `Launch ${defaultBrowser.name}`);
  const iconWidget = new St.Icon({
    ...iconProps(icon ?? "web-browser-symbolic"),
    icon_size: DEFAULT_BROWSER_ICON_SIZE,
  });
  menuItem.insert_child_below(iconWidget, menuItem.label);
  menuItem.connect("activate", () => {
    launchBrowser({ command: cmd, title, notify, pkg });
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
    // Not view-private-symbolic: that name only resolves under Yaru
    // (Ubuntu) — Adwaita (Fedora's default icon theme, and every other
    // distro that doesn't ship Yaru) has no icon under that name at all, so
    // St falls back to a generic "file" placeholder there. GNOME Settings'
    // own Privacy panel icon, confirmed present in both Adwaita and Yaru.
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
