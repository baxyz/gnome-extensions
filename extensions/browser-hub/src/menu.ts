import St from "gi://St";
import type * as Main from "resource:///org/gnome/shell/ui/main.js";
import type { PopupDummyMenu, PopupMenu } from "resource:///org/gnome/shell/ui/popupMenu.js";
import { PopupMenuItem, PopupSeparatorMenuItem } from "resource:///org/gnome/shell/ui/popupMenu.js";
import type { BrowserSpace, ResolvedBrowserEntry, ResolvedBrowserItem } from "./taxonomy";
import type { DefaultBrowserInfo } from "./default-browser";
import { launchBrowser } from "./internal";
import { SPACE_FALLBACK_ICON } from "./icons";

// St.Button.tooltip_text exists at the GObject property level but isn't in @girs types.
function tooltip(btn: St.Button, text: string): void {
  (btn as unknown as { tooltip_text: string }).tooltip_text = text;
}

// Firefox profile theme colors come straight from a SQLite column (see
// firefox-spaces.ts) with no format guarantee. St's CSS engine can't execute
// anything, but a stray `;` could still smuggle in an extra declaration —
// reject anything that isn't a plain color token before it reaches set_style().
function safeCssColor(color: string | undefined): string | undefined {
  if (!color) return undefined;
  // Match hex colors (#rgb, #rrggbb, #rrggbbaa), a full rgb/rgba/hsl/hsla(...)
  // call (no nested parens, so a smuggled ");" can't close early and append
  // more declarations), or a plain named color.
  const validColor =
    /^(#([\da-f]{3}){1,2}|#([\da-f]{4}){1,2}|(rgb|rgba|hsl|hsla)\([^()]*\)|[a-z]+)$/i.test(
      color.trim(),
    );
  // Additionally reject any string containing dangerous CSS characters
  if (!validColor || /[{}\\]/.test(color)) return undefined;
  return color;
}

function makeIconButton(
  label: string,
  iconName: string | undefined,
  iconSize: number,
  onClick: () => void,
  styleClass = "button browser-hub-browser-btn",
): St.Button {
  const btn = new St.Button({ can_focus: true, accessible_name: label, style_class: styleClass });
  btn.set_child(
    iconName ? new St.Icon({ icon_name: iconName, icon_size: iconSize }) : new St.Widget({}),
  );
  tooltip(btn, label);
  btn.connect("clicked", onClick);
  return btn;
}

function makeSpaceGroup(
  spaces: BrowserSpace[],
  title: string,
  notify: typeof Main.notify,
  closeMenu: () => void,
): St.BoxLayout {
  const group = new St.BoxLayout({});
  const btns = spaces.map((space) => {
    const btn = new St.Button({
      can_focus: true,
      accessible_name: space.name,
      style_class: "button browser-hub-space-dot-btn",
    });
    // space.icon is always resolved by fetch time (see src/icons/) — never a
    // raw id, never missing. The neutral fallback renders smaller than a real
    // icon so it reads as a discreet placeholder rather than a bold glyph.
    const iconSize = space.icon === SPACE_FALLBACK_ICON ? 8 : 16;
    btn.set_child(new St.Icon({ icon_name: space.icon, icon_size: iconSize }));
    const bgColor = safeCssColor(space.bgColor);
    const fgColor = safeCssColor(space.fgColor);
    if (bgColor || fgColor) {
      const parts: string[] = [];
      if (bgColor) parts.push(`background-color: ${bgColor}`);
      if (fgColor) parts.push(`color: ${fgColor}`);
      btn.set_style(parts.join("; "));
    }
    tooltip(btn, space.name);
    const cmd = space.command;
    btn.connect("clicked", () => {
      launchBrowser({ command: cmd, title, notify });
      closeMenu();
    });
    return btn;
  });
  const n = btns.length;
  btns.forEach((btn, i) => {
    const mod = n === 1 ? "--solo" : i === 0 ? "--first" : i === n - 1 ? "--last" : "--mid";
    btn.add_style_class_name(`browser-hub-space-dot-btn${mod}`);
    group.add_child(btn);
  });
  return group;
}

function makeDefaultBrowserGroup(
  name: string,
  onLaunch: () => void,
  onChangeDefault: () => void,
  showEdit: boolean,
): St.BoxLayout {
  const group = new St.BoxLayout({ style_class: "browser-hub-btn-group" });

  const launchBtn = new St.Button({
    can_focus: true,
    accessible_name: name,
    label: name,
    style_class: showEdit
      ? "button browser-hub-default-browser-btn"
      : "button browser-hub-default-browser-btn browser-hub-default-browser-btn--solo",
  });
  tooltip(launchBtn, name);
  launchBtn.connect("clicked", onLaunch);
  group.add_child(launchBtn);

  if (showEdit) {
    const changeBtn = new St.Button({
      can_focus: true,
      accessible_name: "Change default browser",
      style_class: "button browser-hub-change-default-btn",
    });
    changeBtn.set_child(new St.Icon({ icon_name: "document-edit-symbolic", icon_size: 12 }));
    tooltip(changeBtn, "Change default browser");
    changeBtn.connect("clicked", onChangeDefault);
    group.add_child(changeBtn);
  }

  return group;
}

function makeIconRow(): PopupMenuItem {
  const row = new PopupMenuItem("", { reactive: false, can_focus: false });
  row.label.hide();
  return row;
}

/**
 * Builds the toolbar row with default browser, spacer, refresh button, and settings button.
 */
function buildToolbar({
  title,
  defaultBrowser,
  showDefaultBrowserEdit,
  notify,
  onRefresh,
  onSettings,
  closeMenu,
}: {
  title: string;
  defaultBrowser?: DefaultBrowserInfo | null;
  showDefaultBrowserEdit: boolean;
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
        () => {
          launchBrowser({ command: cmd, title, notify });
          closeMenu();
        },
        () => {
          launchBrowser({ command: ["gnome-control-center", "applications"], title, notify });
          closeMenu();
        },
        showDefaultBrowserEdit,
      ),
    );
  }

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

/**
 * Builds a menu item row for simple (profile-less) browsers with icon buttons.
 */
function buildSimpleBrowserRow({
  title,
  items,
  notify,
  closeMenu,
}: {
  title: string;
  items: ResolvedBrowserItem[];
  notify: typeof Main.notify;
  closeMenu: () => void;
}): PopupMenuItem {
  const row = makeIconRow();
  for (const item of items) {
    const cmd = item.command;
    row.add_child(
      makeIconButton(item.label, item.icon, 24, () => {
        launchBrowser({ command: cmd, title, notify });
        closeMenu();
      }),
    );
  }
  return row;
}

/**
 * Builds a profile menu item with icon, color dot, and optional space buttons.
 */
function buildProfileMenuItem({
  item,
  title,
  notify,
  closeMenu,
}: {
  item: ResolvedBrowserItem;
  title: string;
  notify: typeof Main.notify;
  closeMenu: () => void;
}): PopupMenuItem {
  const menuItem = new PopupMenuItem(item.label);
  if (item.isDefault) menuItem.label.add_style_class_name("browser-hub-default");

  // item.icon is only set when the resolver has an avatar/profile
  // concept to resolve at all (Firefox) — Chromium/Falkon profiles
  // have none, so there's nothing to show but a reserved blank slot
  // (keeps labels aligned across entries).
  const iconSlot = item.icon
    ? new St.Icon({
        icon_name: item.icon,
        icon_size: 16,
        style_class: "browser-hub-profile-icon",
      })
    : new St.Widget({ style_class: "browser-hub-profile-icon" });
  // "badge" colors the icon itself (currently Firefox Profile Groups); "dot"
  // renders as its own indicator after the label instead (currently
  // Chromium) — a color is never shown both ways at once.
  if (item.color?.mode === "badge") {
    const iconColor = safeCssColor(item.color.fgColor);
    const iconBg = safeCssColor(item.color.bgColor);
    const iconStyle: string[] = [];
    if (iconColor) iconStyle.push(`color: ${iconColor}`);
    if (iconBg)
      iconStyle.push(`background-color: ${iconBg}`, "border-radius: 999px", "padding: 2px");
    if (iconStyle.length > 0) iconSlot.set_style(`${iconStyle.join("; ")};`);
  }
  menuItem.insert_child_below(iconSlot, menuItem.label);

  const cmd = item.command;
  menuItem.connect("activate", () => launchBrowser({ command: cmd, title, notify }));

  if (item.spaces && item.spaces.length > 0) {
    menuItem.add_child(new St.Widget({ x_expand: true }));
    menuItem.add_child(makeSpaceGroup(item.spaces, title, notify, closeMenu));
  } else if (item.color?.mode === "dot") {
    const bgColor = safeCssColor(item.color.bgColor);
    if (bgColor) {
      const dot = new St.Widget({ style_class: "browser-hub-profile-dot" });
      dot.set_style(`background-color: ${bgColor};`);
      menuItem.add_child(dot);
    }
  }

  return menuItem;
}

/**
 * Builds the complete extension menu: toolbar (default browser, refresh, settings),
 * separators, and all browser entries with their profiles/spaces.
 */
export function fillMenu({
  title,
  menu,
  entries,
  notify,
  onSettings,
  onRefresh,
  defaultBrowser,
  showDefaultBrowserEdit = true,
}: {
  title: string;
  menu: PopupMenu | PopupDummyMenu;
  entries: ResolvedBrowserEntry[];
  notify: typeof Main.notify;
  onSettings: () => void;
  onRefresh: () => void;
  defaultBrowser?: DefaultBrowserInfo | null;
  showDefaultBrowserEdit?: boolean;
}): void {
  if ("removeAll" in menu) {
    menu.removeAll();
  }

  if (!("addMenuItem" in menu)) {
    return;
  }

  const closeMenu = () => (menu as { close(): void }).close();

  // Build and add toolbar
  menu.addMenuItem(
    buildToolbar({
      title,
      defaultBrowser,
      showDefaultBrowserEdit,
      notify,
      onRefresh,
      onSettings,
      closeMenu,
    }),
  );

  // Handle empty state
  if (entries.length === 0) {
    menu.addMenuItem(new PopupSeparatorMenuItem());
    menu.addMenuItem(new PopupMenuItem("No browsers found", { reactive: false }));
    return;
  }

  // Build browser entries
  for (const entry of entries) {
    menu.addMenuItem(new PopupSeparatorMenuItem(entry.label));

    if (entry.group === "simple") {
      // Simple browsers (no profiles) - show as icon buttons in a row
      menu.addMenuItem(buildSimpleBrowserRow({ title, items: entry.items, notify, closeMenu }));
    } else {
      // Firefox/Chromium/Falkon browsers with profiles
      for (const item of entry.items) {
        menu.addMenuItem(buildProfileMenuItem({ item, title, notify, closeMenu }));
      }
    }
  }
}
