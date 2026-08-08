import St from "gi://St";
import type Gio from "gi://Gio";
import { PopupMenuItem, PopupSeparatorMenuItem } from "resource:///org/gnome/shell/ui/popupMenu.js";

// St.Button.tooltip_text exists at the GObject property level but isn't in @girs types.
export function tooltip(btn: St.Button, text: string): void {
  (btn as unknown as { tooltip_text: string }).tooltip_text = text;
}

// Firefox profile theme colors come straight from a SQLite column (see
// firefox-spaces.ts) with no format guarantee. St's CSS engine can't execute
// anything, but a stray `;` could still smuggle in an extra declaration —
// reject anything that isn't a plain color token before it reaches set_style().
export function safeCssColor(color: string | undefined): string | undefined {
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
export function iconProps(icon: string | Gio.Icon): { icon_name: string } | { gicon: Gio.Icon } {
  return typeof icon === "string" ? { icon_name: icon } : { gicon: icon };
}

export function makeIconButton(
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

/** Empty, non-reactive row used to host the toolbar and the "Browsers" quick-launch row. */
export function makeIconRow(): PopupMenuItem {
  const row = new PopupMenuItem("", { reactive: false, can_focus: false });
  row.label.hide();
  return row;
}

/** Builds a category separator, with the browser's own icon before the label when known. */
export function buildCategorySeparator(
  label: string,
  icon: Gio.Icon | undefined,
): PopupSeparatorMenuItem {
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
