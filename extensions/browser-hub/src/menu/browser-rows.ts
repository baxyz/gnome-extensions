import St from "gi://St";
import type * as Main from "resource:///org/gnome/shell/ui/main.js";
import { PopupMenuItem } from "resource:///org/gnome/shell/ui/popupMenu.js";
import type { BrowserSpace, ResolvedBrowserItem } from "../taxonomy";
import { launch, pause } from "../internal";
import type { Cancellation } from "../internal";
import { chunk } from "@helpers4/array";
import { iconProps, makeIconButton, makeIconRow, safeCssColor, tooltip } from "./shared";

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
    // Same size with or without an icon, so all space buttons have the same width.
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
    const target = space.launch;
    btn.connect("clicked", () => {
      launch(target, title, notify);
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

// Fixed number of buttons per line: Clutter.FlowLayout rendered the row
// empty in GNOME Shell.
const BROWSERS_ROW_ITEMS_PER_LINE = 6;

// Lets the icon loader finish one line before the next starts.
const BROWSERS_ROW_LINE_DELAY_MS = 30;

/**
 * Row of icon buttons for browsers without profiles, built one line at a
 * time: too many icon loads at once can crash GNOME Shell's icon loader.
 * Stops as soon as `isLive` is false (the menu was rebuilt meanwhile).
 */
export async function buildSimpleBrowserRow(
  {
    title,
    items,
    notify,
    closeMenu,
  }: {
    title: string;
    items: ResolvedBrowserItem[];
    notify: typeof Main.notify;
    closeMenu: () => void;
  },
  isLive: () => boolean,
  signal?: Cancellation,
): Promise<PopupMenuItem | null> {
  const row = makeIconRow();
  const container = new St.BoxLayout({
    vertical: true,
    x_expand: true,
    style_class: "browser-hub-browsers-lines",
  });
  const lines = chunk(items, BROWSERS_ROW_ITEMS_PER_LINE);
  for (const [index, lineItems] of lines.entries()) {
    if (!isLive()) return null;
    if (index > 0 && !(await pause(BROWSERS_ROW_LINE_DELAY_MS, signal))) return null;
    const line = new St.BoxLayout({ style_class: "browser-hub-browsers-line" });
    for (const item of lineItems) {
      const target = item.launch;
      line.add_child(
        makeIconButton(
          item.label,
          item.icon,
          24,
          () => {
            launch(target, title, notify);
            closeMenu();
          },
          undefined,
          item.pkg?.manager,
        ),
      );
    }
    container.add_child(line);
  }
  if (!isLive()) return null;
  row.add_child(container);
  return row;
}

const PROFILE_ICON_SIZE = 16;
// The icon shrinks by this much on each side, so a badged icon keeps the
// width of a plain one and labels stay aligned.
const BADGE_PADDING_X = 1;
const BADGE_PADDING_Y = 3;

export function buildProfileMenuItem({
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

  // "badge" tints the icon (fg) on an optional pill (bg); "dot" is shown
  // after the label instead. Needs an icon to tint.
  const badge = item.icon && item.color?.mode === "badge" ? item.color : undefined;
  const badgeBg = badge ? safeCssColor(badge.bgColor) : undefined;
  const iconSize = badgeBg ? PROFILE_ICON_SIZE - BADGE_PADDING_X * 2 : PROFILE_ICON_SIZE;
  // St.Bin keeps its size even when empty, so labels stay aligned without an icon.
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

  const target = item.launch;
  menuItem.connect("activate", () => launch(target, title, notify));

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
