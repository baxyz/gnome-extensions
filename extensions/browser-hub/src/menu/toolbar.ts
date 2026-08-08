import St from "gi://St";
import type Gio from "gi://Gio";
import type * as Main from "resource:///org/gnome/shell/ui/main.js";
import { PopupMenuItem } from "resource:///org/gnome/shell/ui/popupMenu.js";
import { Spinner } from "resource:///org/gnome/shell/ui/animation.js";
import type { ResolvedBrowserItem, ResolvedBrowserPkg } from "../taxonomy";
import type { DefaultBrowserInfo } from "../default-browser";
import { launchBrowser, resolveDesktopIcon } from "../internal";
import { iconProps, makeIconButton, makeIconRow, tooltip } from "./shared";

const DONUT_TOOLTIP = "Open a disposable, anti-fingerprint browser session";
const DONUT_ICON_SIZE = 16;

/**
 * Toolbar button for launching a Donut (disposable, anti-fingerprint)
 * profile. Shows a spinner in place of its icon while onLaunch's async
 * profile creation is in flight, so a slow disk doesn't leave the click
 * looking like it did nothing — restoring the icon (or just leaving the
 * button be, if fillMenu's removeAll() already tore this row down in the
 * meantime) once it settles.
 */
function makeDonutButton(onLaunch: () => Promise<void>, closeMenu: () => void): St.Button {
  const btn = new St.Button({
    can_focus: true,
    accessible_name: DONUT_TOOLTIP,
    style_class: "button browser-hub-toolbar-btn",
  });
  const icon = new St.Icon({ icon_name: "view-conceal-symbolic", icon_size: DONUT_ICON_SIZE });
  btn.set_child(icon);
  tooltip(btn, DONUT_TOOLTIP);
  btn.connect("clicked", () => {
    if (!btn.reactive) return;
    btn.reactive = false;
    const spinner = new Spinner(DONUT_ICON_SIZE, { animate: true, hideOnStop: false });
    btn.set_child(spinner);
    spinner.play();
    onLaunch()
      .catch((e: unknown) => logError(e as object, "[browser-hub] failed to launch Donut browser"))
      .finally(() => {
        try {
          spinner.stop();
          spinner.destroy();
          btn.set_child(icon);
          btn.reactive = true;
        } catch {
          // Menu was rebuilt while the profile creation was still pending —
          // this button no longer exists, nothing left to restore.
        }
        closeMenu();
      });
  });
  return btn;
}

// Matches the "Browsers" row's own icon size (makeIconButton's call site
// below) so the default-browser button reads as the same kind of control,
// not a smaller text-only one bolted on beside it.
const DEFAULT_BROWSER_ICON_SIZE = 24;

function makeDefaultBrowserGroup(
  name: string,
  icon: Gio.Icon | undefined,
  onLaunch: () => void,
  onTogglePicker: () => void,
  showPicker: boolean,
  pickerOpen: boolean,
): St.BoxLayout {
  const group = new St.BoxLayout({ style_class: "browser-hub-btn-group" });

  const launchBtn = new St.Button({
    can_focus: true,
    accessible_name: name,
    style_class: showPicker
      ? "button browser-hub-default-browser-btn"
      : "button browser-hub-default-browser-btn browser-hub-default-browser-btn--solo",
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
  group.add_child(launchBtn);

  if (showPicker) {
    const pickerBtn = new St.Button({
      can_focus: true,
      accessible_name: "Choose default browser",
      style_class: "button browser-hub-change-default-btn",
    });
    // pan-down/pan-up (not the "open"/"checked" pseudo-classes real
    // PopupSubMenuMenuItem arrows use) since this isn't a real PopupSubMenu —
    // see buildDefaultBrowserPicker's own comment for why.
    pickerBtn.set_child(
      new St.Icon({
        icon_name: pickerOpen ? "pan-up-symbolic" : "pan-down-symbolic",
        icon_size: 12,
      }),
    );
    tooltip(pickerBtn, "Choose default browser");
    pickerBtn.connect("clicked", onTogglePicker);
    group.add_child(pickerBtn);
  }

  return group;
}

/**
 * Rows for picking a new default browser, shown directly under the toolbar
 * when its caret is toggled open. A real PopupSubMenu (the class backing
 * GNOME Shell's own expandable submenus, e.g. PopupSubMenuMenuItem) would
 * give this a slide animation for free, but it re-parents its actor onto
 * the *top-level* menu via _setParent — awkward to splice in for just one
 * row of a non-submenu toolbar item without risking breaking that item's own
 * layout. Plain conditional PopupMenuItems, added/removed by fillMenu's
 * existing removeAll()-and-rebuild on every redraw, get the same "list
 * appears right under the toolbar" result with no animation, for much less
 * risk of mis-wiring internals nothing here can visually test.
 */
export function buildDefaultBrowserPicker(
  browsers: ResolvedBrowserItem[],
  onPick: (pkg: ResolvedBrowserPkg) => void,
): PopupMenuItem[] {
  return browsers
    .filter((b) => b.pkg !== undefined)
    .map((b) => {
      const item = new PopupMenuItem(b.label);
      item.add_style_class_name("browser-hub-default-browser-picker-item");
      if (b.icon) {
        const iconWidget = new St.Icon({ ...iconProps(b.icon), icon_size: 16 });
        item.insert_child_below(iconWidget, item.label);
      }
      // Filtered above — the pkg is present, this is just narrowing the type.
      const pkg = b.pkg;
      if (pkg) item.connect("activate", () => onPick(pkg));
      return item;
    });
}

/**
 * Builds the toolbar row with default browser, spacer, refresh button, and settings button.
 */
export function buildToolbar({
  title,
  defaultBrowser,
  showDefaultBrowserEdit,
  pickerOpen,
  onTogglePicker,
  showDonutButton,
  onLaunchDonut,
  notify,
  onRefresh,
  onSettings,
  closeMenu,
}: {
  title: string;
  defaultBrowser?: DefaultBrowserInfo | null;
  showDefaultBrowserEdit: boolean;
  pickerOpen: boolean;
  onTogglePicker: () => void;
  showDonutButton: boolean;
  onLaunchDonut: () => Promise<void>;
  notify: typeof Main.notify;
  onRefresh: () => void;
  onSettings: () => void;
  closeMenu: () => void;
}): PopupMenuItem {
  const toolbar = makeIconRow();

  if (defaultBrowser) {
    const cmd = defaultBrowser.command;
    toolbar.add_child(
      makeDefaultBrowserGroup(
        defaultBrowser.name,
        resolveDesktopIcon(defaultBrowser.pkg),
        () => {
          launchBrowser({ command: cmd, title, notify });
          closeMenu();
        },
        onTogglePicker,
        showDefaultBrowserEdit,
        pickerOpen,
      ),
    );
  }

  toolbar.add_child(new St.Widget({ x_expand: true }));
  // Only shown when a Donut-eligible browser was actually found (see
  // findDonutBrowser) — no point offering a button that can't do anything.
  if (showDonutButton) {
    toolbar.add_child(makeDonutButton(onLaunchDonut, closeMenu));
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
