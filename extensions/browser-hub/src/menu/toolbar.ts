import St from "gi://St";
import type Gio from "gi://Gio";
import type * as Main from "resource:///org/gnome/shell/ui/main.js";
import {
  PopupMenuItem,
  PopupSeparatorMenuItem,
  PopupSubMenuMenuItem,
} from "resource:///org/gnome/shell/ui/popupMenu.js";
import { Spinner } from "resource:///org/gnome/shell/ui/animation.js";
import { isEmpty } from "@helpers4/array";
import { PackageManager } from "../taxonomy";
import type { ResolvedBrowserItem, ResolvedBrowserPkg } from "../taxonomy";
import type { DefaultBrowserInfo } from "../default-browser";
import { launchBrowser, resolveDesktopIcon } from "../internal";
import { iconProps, makeIconButton, makeIconRow, tooltip } from "./shared";

const DONUT_TOOLTIP = "Open a disposable, anti-fingerprint browser session";
const DONUT_ICON_SIZE = 16;

/**
 * Toolbar button for launching a Donut (disposable, anti-fingerprint)
 * profile. `isLaunching` (owned by the indicator, across redraws — a
 * profile launch can outlive several menu open/close cycles) swaps the
 * icon for a spinner and makes the button inert instead of clickable.
 */
function makeDonutButton(isLaunching: boolean, onLaunch: () => void): St.Button {
  const btn = new St.Button({
    can_focus: true,
    accessible_name: DONUT_TOOLTIP,
    style_class: "button browser-hub-toolbar-btn",
  });
  if (isLaunching) {
    const spinner = new Spinner(DONUT_ICON_SIZE, { animate: true, hideOnStop: false });
    btn.set_child(spinner);
    spinner.play();
    btn.reactive = false;
  } else {
    btn.set_child(new St.Icon({ icon_name: "view-conceal-symbolic", icon_size: DONUT_ICON_SIZE }));
    btn.connect("clicked", onLaunch);
  }
  tooltip(btn, DONUT_TOOLTIP);
  return btn;
}

// Matches the "Browsers" row's own icon size (makeIconButton's call site
// below) so the default-browser button reads as the same kind of control,
// not a smaller text-only one bolted on beside it.
const DEFAULT_BROWSER_ICON_SIZE = 24;

/** Plain, non-expandable default-browser button, shown when showDefaultBrowserEdit is off. */
function buildDefaultBrowserRow(
  name: string,
  icon: Gio.Icon | undefined,
  onLaunch: () => void,
): St.Button {
  const launchBtn = new St.Button({
    can_focus: true,
    accessible_name: name,
    style_class: "button browser-hub-default-browser-btn",
  });
  const content = new St.BoxLayout({ style_class: "browser-hub-default-browser-btn-content" });
  content.add_child(
    new St.Icon({
      ...iconProps(icon ?? "web-browser-symbolic"),
      icon_size: DEFAULT_BROWSER_ICON_SIZE,
    }),
  );
  content.add_child(new St.Label({ text: name }));
  launchBtn.set_child(content);
  tooltip(launchBtn, name);
  launchBtn.connect("clicked", onLaunch);
  return launchBtn;
}

/**
 * Rows for picking a new default browser: one per installed browser,
 * activating onPick with its package.
 */
function buildDefaultBrowserPickerRows(
  browsers: ResolvedBrowserItem[],
  onPick: (pkg: ResolvedBrowserPkg) => void,
): PopupMenuItem[] {
  return (
    browsers
      // Snap excluded: desktopIdFor()'s "<name>_<name>.desktop" guess for Snap
      // is only verified against a couple of browsers, and a wrong guess here
      // feeds straight into setDefaultBrowser() failing silently.
      .filter((b) => b.pkg !== undefined && b.pkg.manager !== PackageManager.Snap)
      .map((b) => {
        const item = new PopupMenuItem(b.label);
        if (b.icon) {
          const iconWidget = new St.Icon({ ...iconProps(b.icon), icon_size: 16 });
          item.insert_child_below(iconWidget, item.label);
        }
        // Filtered above — the pkg is present, this is just narrowing the type.
        const pkg = b.pkg;
        if (pkg) item.connect("activate", () => onPick(pkg));
        return item;
      })
  );
}

/**
 * A real GNOME PopupSubMenuMenuItem for the default browser. Clicking the
 * row itself always just opens/closes the submenu — that's what
 * PopupSubMenuMenuItem.activate() does, and it can't be repurposed — so
 * "Launch <name>" is the submenu's first item, followed by a separator and
 * every other installed browser to switch to.
 */
function buildDefaultBrowserSubMenuItem(
  defaultBrowser: DefaultBrowserInfo,
  icon: Gio.Icon | undefined,
  browsers: ResolvedBrowserItem[],
  onLaunch: () => void,
  onSetDefaultBrowser: (pkg: ResolvedBrowserPkg) => void,
  closeMenu: () => void,
): PopupSubMenuMenuItem {
  const item = new PopupSubMenuMenuItem(defaultBrowser.name, true);
  if (item.icon) Object.assign(item.icon, iconProps(icon ?? "web-browser-symbolic"));

  const launchItem = new PopupMenuItem(`Launch ${defaultBrowser.name}`);
  launchItem.connect("activate", () => {
    onLaunch();
    closeMenu();
  });
  item.menu.addMenuItem(launchItem);

  const pickerRows = buildDefaultBrowserPickerRows(browsers, onSetDefaultBrowser);
  if (!isEmpty(pickerRows)) {
    item.menu.addMenuItem(new PopupSeparatorMenuItem());
    for (const row of pickerRows) item.menu.addMenuItem(row);
  }

  return item;
}

/**
 * Builds the default-browser row: a plain launch button, or, when
 * showDefaultBrowserEdit is on, a real expandable PopupSubMenuMenuItem
 * offering "Launch" plus every other installed browser to switch to.
 * PopupSubMenuMenuItem manages its own open/closed state and slide
 * animation as a top-level menu row, so it needs its own row rather than
 * being one child inside buildToolbar's horizontal box below.
 */
export function buildDefaultBrowserItem({
  title,
  defaultBrowser,
  showDefaultBrowserEdit,
  browsers,
  onSetDefaultBrowser,
  notify,
  closeMenu,
}: {
  title: string;
  defaultBrowser: DefaultBrowserInfo;
  showDefaultBrowserEdit: boolean;
  browsers: ResolvedBrowserItem[];
  onSetDefaultBrowser: (pkg: ResolvedBrowserPkg) => void;
  notify: typeof Main.notify;
  closeMenu: () => void;
}): PopupMenuItem | PopupSubMenuMenuItem {
  const cmd = defaultBrowser.command;
  const icon = resolveDesktopIcon(defaultBrowser.pkg);
  const onLaunch = () => launchBrowser({ command: cmd, title, notify });

  if (showDefaultBrowserEdit) {
    return buildDefaultBrowserSubMenuItem(
      defaultBrowser,
      icon,
      browsers,
      onLaunch,
      onSetDefaultBrowser,
      closeMenu,
    );
  }

  // Plain St.Button isn't itself a valid addMenuItem() argument — hosted in
  // the same kind of non-reactive row buildToolbar uses for its own icon row.
  const row = makeIconRow();
  row.add_child(
    buildDefaultBrowserRow(defaultBrowser.name, icon, () => {
      onLaunch();
      closeMenu();
    }),
  );
  return row;
}

/**
 * Builds the toolbar row with spacer, Donut button, refresh button, and
 * settings button — the default browser gets its own row, see
 * buildDefaultBrowserItem above.
 */
export function buildToolbar({
  showDonutButton,
  donutLaunching,
  onLaunchDonut,
  onRefresh,
  onSettings,
}: {
  showDonutButton: boolean;
  donutLaunching: boolean;
  onLaunchDonut: () => void;
  onRefresh: () => void;
  onSettings: () => void;
}): PopupMenuItem {
  const toolbar = makeIconRow();

  toolbar.add_child(new St.Widget({ x_expand: true }));
  // Only shown when a Donut-eligible browser was actually found (see
  // findDonutBrowser) — no point offering a button that can't do anything.
  if (showDonutButton) {
    toolbar.add_child(makeDonutButton(donutLaunching, onLaunchDonut));
  }
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
