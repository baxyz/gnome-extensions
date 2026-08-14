import St from "gi://St";
import Clutter from "gi://Clutter";
import type Gio from "gi://Gio";
import { PopupMenuItem, PopupSeparatorMenuItem } from "resource:///org/gnome/shell/ui/popupMenu.js";
import { Spinner } from "resource:///org/gnome/shell/ui/animation.js";
import { isCssColor } from "@helpers4/guard";
import { PackageManager } from "../taxonomy";

// St.Button.tooltip_text exists at the GObject property level but isn't in @girs types.
export function tooltip(btn: St.Button, text: string): void {
  (btn as unknown as { tooltip_text: string }).tooltip_text = text;
}

// Firefox profile theme colors come straight from a SQLite column (see
// firefox-spaces.ts) with no format guarantee — isCssColor() guards against a
// crafted value smuggling extra declarations into set_style()'s CSS string.
export function safeCssColor(color: string | undefined): string | undefined {
  return isCssColor(color) ? color : undefined;
}

// Firefox Profile Groups avatars and Zen icons are GNOME/Adwaita icon names
// (icon_name); a browser's own icon fetched from its .desktop file (see
// internal/desktop-icon.ts) is a real Gio.Icon (gicon) instead.
export function iconProps(icon: string | Gio.Icon): { icon_name: string } | { gicon: Gio.Icon } {
  return typeof icon === "string" ? { icon_name: icon } : { gicon: icon };
}

// resolveDesktopIcon() ends up undefined fairly often (a wrong desktopId
// guess, or an Icon= name absent from the current theme) — same fallback
// name the default-browser button and panel icon already use elsewhere.
const GENERIC_BROWSER_ICON_NAME = "web-browser-symbolic";

// Package-manager badge, keyed to the CSS classes in stylesheet.css. Native
// has no badge — it's the unmarked default. Deliberately never composited
// into the Gio.Icon itself (a Gio.EmblemedIcon, as an earlier version of
// this code did): that emblem is rendered by St's icon-theme loader at
// whatever fraction of icon_size it internally picks, a size this codebase
// has no way to know or validate in advance — the exact class of crash the
// rest of internal/desktop-icon.ts exists to prevent for the base icon.
// A CSS background-image goes through St's texture cache instead, the same
// mechanism as every other themed background in this stylesheet, not the
// icon-theme loader that's the actual source of the crash.
const BADGE_CSS_CLASSES: Partial<Record<PackageManager, string>> = {
  [PackageManager.Flatpak]: "browser-hub-badge-flatpak",
  [PackageManager.Snap]: "browser-hub-badge-snap",
};

/** Overlays a small package-manager badge in the bottom-right corner of `iconWidget`, when one applies. */
function withBadge(iconWidget: St.Icon, manager: PackageManager | undefined): St.Widget {
  const badgeClass = manager && BADGE_CSS_CLASSES[manager];
  if (!badgeClass) return iconWidget;

  const container = new St.Widget({ layout_manager: new Clutter.BinLayout() });
  container.add_child(iconWidget);
  container.add_child(
    new St.Widget({
      style_class: `browser-hub-badge ${badgeClass}`,
      x_align: Clutter.ActorAlign.END,
      y_align: Clutter.ActorAlign.END,
    }),
  );
  return container;
}

/**
 * `badgeManager` is only meaningful for the "Browsers" row: it's the only
 * place an icon is shown with no visible text label next to it (a tooltip
 * only, see `tooltip()` below) — everywhere else that shows a
 * package-manager-specific icon already has a "(flatpak)"/"(snap)" label
 * suffix doing the same disambiguation, so a badge there would be redundant.
 */
export function makeIconButton(
  label: string,
  icon: string | Gio.Icon | undefined,
  iconSize: number,
  onClick: () => void,
  styleClass = "button browser-hub-browser-btn",
  badgeManager?: PackageManager,
): St.Button {
  const btn = new St.Button({ can_focus: true, accessible_name: label, style_class: styleClass });
  const iconWidget = new St.Icon({
    ...iconProps(icon ?? GENERIC_BROWSER_ICON_NAME),
    icon_size: iconSize,
  });
  btn.set_child(withBadge(iconWidget, badgeManager));
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

/** Placeholder row shown while the browser scan is still running. */
export function buildLoadingRow(): PopupMenuItem {
  const row = new PopupMenuItem("Loading browsers…", { reactive: false });
  const spinner = new Spinner(16, { animate: true, hideOnStop: false });
  spinner.play();
  row.insert_child_below(spinner, row.label);
  return row;
}

/** Short, non-selectable banner for what failed during the last scan — see resolve-all.ts's `errors`. */
export function buildErrorRow(errors: string[]): PopupMenuItem {
  const row = new PopupMenuItem(`Problem: couldn't list ${errors.join(", ")}`, { reactive: false });
  row.label.style_class = "browser-hub-error-label";
  const icon = new St.Icon({ icon_name: "dialog-warning-symbolic", icon_size: 16 });
  row.insert_child_below(icon, row.label);
  return row;
}

/** Shown when fillMenu() truncates rows/icons past MAX_ICONS_PER_PASS. */
export function buildTruncatedRow(hiddenCount: number): PopupMenuItem {
  return new PopupMenuItem(`…and ${hiddenCount} more hidden (see Settings to narrow this down)`, {
    reactive: false,
  });
}

/** Builds a category separator, with the browser's own icon before the label when known. */
export function buildCategorySeparator(
  label: string,
  icon: string | Gio.Icon | undefined,
): PopupSeparatorMenuItem {
  const separator = new PopupSeparatorMenuItem(label);
  if (icon) {
    const iconWidget = new St.Icon({
      ...iconProps(icon),
      icon_size: 16,
      style_class: "browser-hub-category-icon",
    });
    separator.insert_child_below(iconWidget, separator.label);
  }
  return separator;
}
