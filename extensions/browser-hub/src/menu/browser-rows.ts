import St from "gi://St";
import type * as Main from "resource:///org/gnome/shell/ui/main.js";
import { PopupMenuItem } from "resource:///org/gnome/shell/ui/popupMenu.js";
import type { BrowserSpace, ResolvedBrowserItem } from "../taxonomy";
import { launchBrowser } from "../internal";
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
export function buildSimpleBrowserRow({
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
