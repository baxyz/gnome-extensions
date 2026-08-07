import St from "gi://St";
import type Gio from "gi://Gio";
import type * as Main from "resource:///org/gnome/shell/ui/main.js";
import type { PopupDummyMenu, PopupMenu } from "resource:///org/gnome/shell/ui/popupMenu.js";
import { PopupMenuItem, PopupSeparatorMenuItem } from "resource:///org/gnome/shell/ui/popupMenu.js";
import type {
  BrowserSpace,
  ResolvedBrowserEntry,
  ResolvedBrowserItem,
  ResolvedBrowserPkg,
} from "./taxonomy";
import type { DefaultBrowserInfo } from "./default-browser";
import { launchBrowser, resolveDesktopIcon } from "./internal";
import { chunk, isEmpty } from "@helpers4/array";

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

// Firefox Profile Groups avatars and Zen icons are GNOME/Adwaita icon names
// (icon_name); a browser's own icon fetched from its .desktop file (see
// internal/desktop-icon.ts) is a real Gio.Icon (gicon) instead.
function iconProps(icon: string | Gio.Icon): { icon_name: string } | { gicon: Gio.Icon } {
  return typeof icon === "string" ? { icon_name: icon } : { gicon: icon };
}

function makeIconButton(
  label: string,
  icon: string | Gio.Icon | undefined,
  iconSize: number,
  onClick: () => void,
  styleClass = "button browser-hub-browser-btn",
): St.Button {
  const btn = new St.Button({ can_focus: true, accessible_name: label, style_class: styleClass });
  btn.set_child(
    icon ? new St.Icon({ ...iconProps(icon), icon_size: iconSize }) : new St.Widget({}),
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
    // Same icon_size for the fallback dot and a real icon — a smaller
    // fallback used to read as a "discreet placeholder" but actually just
    // made every space button a different width depending on which spaces
    // had real icons.
    btn.set_child(new St.Icon({ icon_name: space.icon, icon_size: 16 }));
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
function buildDefaultBrowserPicker(
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

function makeIconRow(): PopupMenuItem {
  const row = new PopupMenuItem("", { reactive: false, can_focus: false });
  row.label.hide();
  return row;
}

/** Builds a category separator, with the browser's own icon before the label when known. */
function buildCategorySeparator(label: string, icon: Gio.Icon | undefined): PopupSeparatorMenuItem {
  const separator = new PopupSeparatorMenuItem(label);
  if (icon) {
    const iconWidget = new St.Icon({
      gicon: icon,
      icon_size: 16,
      style_class: "browser-hub-category-icon",
    });
    separator.insert_child_below(iconWidget, separator.label);
  }
  return separator;
}

/**
 * Builds the toolbar row with default browser, spacer, refresh button, and settings button.
 */
function buildToolbar({
  title,
  defaultBrowser,
  showDefaultBrowserEdit,
  pickerOpen,
  onTogglePicker,
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

// Buttons per line in the "Browsers" row before wrapping to a new one. A
// fixed chunk size rather than Clutter.FlowLayout's automatic width-based
// reflow (tried first: with 6-7+ installed browsers the flat row grew wider
// than the popup) — FlowLayout's width-for-height negotiation turned out to
// render the whole row empty under real GNOME Shell despite resolving items
// correctly, a failure mode the mocked test suite couldn't catch since it
// stubs Clutter.FlowLayout with a no-op class rather than exercising
// Clutter's real layout engine. Chosen low enough to fit a typical popup
// width at this button's actual size (24px icon + 8px padding each side).
const BROWSERS_ROW_ITEMS_PER_LINE = 6;

/** Builds a menu item row for simple (profile-less) browsers with icon buttons. */
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
  const container = new St.BoxLayout({
    vertical: true,
    x_expand: true,
    style_class: "browser-hub-browsers-lines",
  });
  for (const lineItems of chunk(items, BROWSERS_ROW_ITEMS_PER_LINE)) {
    const line = new St.BoxLayout({ style_class: "browser-hub-browsers-line" });
    for (const item of lineItems) {
      const cmd = item.command;
      line.add_child(
        makeIconButton(item.label, item.icon, 24, () => {
          launchBrowser({ command: cmd, title, notify });
          closeMenu();
        }),
      );
    }
    container.add_child(line);
  }
  row.add_child(container);
  return row;
}

const PROFILE_ICON_SIZE = 16;
// Horizontal padding on the badge's background pill. The icon is shrunk by
// exactly this much on each side (see buildProfileMenuItem) so the pill's
// total WIDTH still matches a plain, unbadged icon's width — this is the
// axis that has to line up for every row's label to stay aligned. Vertical
// padding doesn't affect alignment, so it's free to be more generous and is
// kept separate on purpose.
const BADGE_PADDING_X = 1;
const BADGE_PADDING_Y = 3;

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

  // "badge" tints the icon via its fg color and, when a bg color is also
  // known, adds a colored pill behind it (never the reverse — bgColor alone
  // would tint the icon glyph with what's meant to be a background hue,
  // illegible on a dark popup); "dot" renders as its own indicator after the
  // label instead (currently Chromium) — a color is never shown both ways at
  // once. Only meaningful when there's an actual icon to tint — item.icon is
  // undefined for profiles that carry a color but no mappable avatar (see
  // resolve-icon.ts), and the color is dropped for those rather than shown
  // some other way, for now. Computed once so the icon-size shrink below and
  // the style applied further down can never disagree about whether this
  // item actually gets a badge.
  const badge = item.icon && item.color?.mode === "badge" ? item.color : undefined;
  const badgeBg = badge ? safeCssColor(badge.bgColor) : undefined;
  const iconSize = badgeBg ? PROFILE_ICON_SIZE - BADGE_PADDING_X * 2 : PROFILE_ICON_SIZE;
  // St.Bin, not St.Icon/St.Widget directly: a Bin is built to always occupy
  // its own configured size regardless of its child (or lack of one), which
  // a bare St.Widget doesn't reliably do for an empty placeholder — that gap
  // was the source of a previous width mismatch between this blank slot and
  // an actual icon next to it. item.icon is undefined only when neither an
  // avatar nor the browser's own .desktop icon could be resolved — nothing
  // to show but a reserved blank slot (keeps labels aligned across entries).
  const iconSlot = new St.Bin({ style_class: "browser-hub-profile-icon" });
  if (item.icon) {
    const icon = new St.Icon({ ...iconProps(item.icon), icon_size: iconSize });
    if (badge) {
      const fg = safeCssColor(badge.fgColor);
      const style: string[] = [];
      if (fg) style.push(`color: ${fg}`);
      if (badgeBg)
        style.push(
          `background-color: ${badgeBg}`,
          "border-radius: 4px",
          `padding: ${BADGE_PADDING_Y}px ${BADGE_PADDING_X}px`,
        );
      if (style.length > 0) icon.set_style(`${style.join("; ")};`);
    }
    iconSlot.set_child(icon);
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
  showToolbar = true,
  showDefaultBrowserEdit = true,
  pickerOpen = false,
  onTogglePicker = () => {},
  onSetDefaultBrowser = () => {},
}: {
  title: string;
  menu: PopupMenu | PopupDummyMenu;
  entries: ResolvedBrowserEntry[];
  notify: typeof Main.notify;
  onSettings: () => void;
  onRefresh: () => void;
  defaultBrowser?: DefaultBrowserInfo | null;
  showToolbar?: boolean;
  showDefaultBrowserEdit?: boolean;
  /** Whether the default-browser picker (opened via the toolbar's caret) is currently expanded. */
  pickerOpen?: boolean;
  onTogglePicker?: () => void;
  onSetDefaultBrowser?: (pkg: ResolvedBrowserPkg) => void;
}): void {
  if ("removeAll" in menu) {
    menu.removeAll();
  }

  if (!("addMenuItem" in menu)) {
    return;
  }

  const closeMenu = () => (menu as { close(): void }).close();

  // Off, this hides the whole row — including Refresh and Settings, so
  // there's no in-menu way back into preferences (the GNOME Extensions app
  // still works). A deliberate tradeoff, not an oversight.
  if (showToolbar) {
    menu.addMenuItem(
      buildToolbar({
        title,
        defaultBrowser,
        showDefaultBrowserEdit,
        pickerOpen,
        onTogglePicker,
        notify,
        onRefresh,
        onSettings,
        closeMenu,
      }),
    );
    // The picker's own rows come from the same "Browsers" row entry the
    // quick-launch icons below are built from — same one-per-identity list,
    // just rendered as text rows instead of icon buttons here.
    if (showDefaultBrowserEdit && pickerOpen) {
      const browsers = entries.find((e) => e.group === "simple")?.items ?? [];
      for (const item of buildDefaultBrowserPicker(browsers, onSetDefaultBrowser)) {
        menu.addMenuItem(item);
      }
    }
  }

  // Handle empty state. No separator above this — there's nothing here to
  // separate the message from (the toolbar's own buttons already read as
  // distinct content), unlike the labeled separator before each real entry
  // group further down.
  if (isEmpty(entries)) {
    // Every toggle disabled in Settings is a far more likely cause of this
    // than a genuine absence of any installed browser — lead with that.
    menu.addMenuItem(
      new PopupMenuItem("Nothing to show — check Settings, or install a browser", {
        reactive: false,
      }),
    );
    return;
  }

  // Build browser entries
  for (const entry of entries) {
    menu.addMenuItem(buildCategorySeparator(entry.label, entry.icon));

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
