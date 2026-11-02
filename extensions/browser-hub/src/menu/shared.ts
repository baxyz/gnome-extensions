import St from "gi://St";
import Clutter from "gi://Clutter";
import GLib from "gi://GLib";
import type Gio from "gi://Gio";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import {
  PopupMenuItem,
  PopupMenuSection,
  PopupSeparatorMenuItem,
} from "resource:///org/gnome/shell/ui/popupMenu.js";
import { Spinner } from "resource:///org/gnome/shell/ui/animation.js";
import { isCssColor } from "@helpers4/guard";
import { PackageManager } from "../taxonomy";
import type { ResolvedBrowserItem, ResolvedBrowserPkg } from "../taxonomy";

// Long enough not to flash a tooltip while the pointer crosses a row of icons.
const TOOLTIP_HOVER_DELAY_MS = 400;
// Gap between the actor's bottom edge and the tooltip label below it.
const TOOLTIP_GAP_PX = 6;

/**
 * St has no tooltips. This shows a "dash-label" (the Dash's own tooltip
 * style) after a hover delay, added to uiGroup so the menu doesn't clip it.
 */
export function tooltip(actor: St.Widget, text: string): void {
  let label: St.Label | undefined;
  let timeoutId = 0;

  const clearTimer = (): void => {
    if (timeoutId !== 0) {
      GLib.source_remove(timeoutId);
      timeoutId = 0;
    }
  };
  const hide = (): void => {
    clearTimer();
    label?.destroy();
    label = undefined;
  };

  actor.connect("enter-event", () => {
    clearTimer();
    timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, TOOLTIP_HOVER_DELAY_MS, () => {
      timeoutId = 0;
      // The row may have closed during the delay.
      if (!actor.mapped) return GLib.SOURCE_REMOVE;
      label = new St.Label({ style_class: "dash-label", text });
      Main.layoutManager.uiGroup.add_child(label);
      const [x, y] = actor.get_transformed_position();
      const [, height] = actor.get_transformed_size();
      label.set_position(Math.round(x), Math.round(y + height + TOOLTIP_GAP_PX));
      return GLib.SOURCE_REMOVE;
    });
  });
  actor.connect("leave-event", hide);
  // Works on both St.Button and PopupMenuItem, unlike clicked/activate.
  actor.connect("button-press-event", hide);
  actor.connect("destroy", hide);
  // leave-event doesn't fire once the actor is unmapped.
  actor.connect("notify::mapped", () => {
    if (!actor.mapped) hide();
  });
}

// Profile colors come from a SQLite file: never pass an unchecked value to set_style().
export function safeCssColor(color: string | undefined): string | undefined {
  return isCssColor(color) ? color : undefined;
}

export function iconProps(icon: string | Gio.Icon): { icon_name: string } | { gicon: Gio.Icon } {
  return typeof icon === "string" ? { icon_name: icon } : { gicon: icon };
}

const GENERIC_BROWSER_ICON_NAME = "web-browser-symbolic";

// Border accent per package manager (see stylesheet.css). Native has none.
const MANAGER_BTN_CSS_CLASSES: Partial<Record<PackageManager, string>> = {
  [PackageManager.Flatpak]: "browser-hub-browser-btn--flatpak",
  [PackageManager.Snap]: "browser-hub-browser-btn--snap",
};

/**
 * `badgeManager` is for the Browsers row, where icons have no text label.
 * Elsewhere the "(flatpak)"/"(snap)" suffix already says it.
 */
export function makeIconButton(
  label: string,
  icon: string | Gio.Icon | undefined,
  iconSize: number,
  onClick: () => void,
  styleClass = "button browser-hub-browser-btn",
  badgeManager?: PackageManager,
): St.Button {
  const managerClass = badgeManager && MANAGER_BTN_CSS_CLASSES[badgeManager];
  const btn = new St.Button({
    can_focus: true,
    accessible_name: label,
    style_class: managerClass ? `${styleClass} ${managerClass}` : styleClass,
  });
  const iconWidget = new St.Icon({
    ...iconProps(icon ?? GENERIC_BROWSER_ICON_NAME),
    icon_size: iconSize,
  });
  btn.set_child(iconWidget);
  tooltip(btn, label);
  btn.connect("clicked", onClick);
  return btn;
}

/** Empty row that hosts a row of buttons. */
export function makeIconRow(): PopupMenuItem {
  const row = new PopupMenuItem("", { reactive: false, can_focus: false });
  row.label.hide();
  return row;
}

export function buildLoadingRow(): PopupMenuItem {
  const row = new PopupMenuItem("Loading browsers…", { reactive: false });
  const spinner = new Spinner(16, { animate: true, hideOnStop: false });
  spinner.play();
  row.insert_child_below(spinner, row.label);
  return row;
}

export function buildErrorRow(errors: string[]): PopupMenuItem {
  const row = new PopupMenuItem(`Problem: couldn't list ${errors.join(", ")}`, { reactive: false });
  row.label.style_class = "browser-hub-error-label";
  const icon = new St.Icon({ icon_name: "dialog-warning-symbolic", icon_size: 16 });
  row.insert_child_below(icon, row.label);
  return row;
}

export function buildTruncatedRow(hiddenCount: number): PopupMenuItem {
  return new PopupMenuItem(`…and ${hiddenCount} more hidden (see Settings to narrow this down)`, {
    reactive: false,
  });
}

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

// Sub-pages replace the whole menu instead of expanding inline: the
// popup menu doesn't scroll, so a long inline list would push the rest
// off-screen.

export function buildSubPageHeader(title: string, onBack: () => void): PopupMenuItem {
  const row = makeIconRow();
  const content = new St.BoxLayout({ style_class: "browser-hub-subpage-header" });
  const backBtn = new St.Button({
    can_focus: true,
    accessible_name: "Back",
    style_class: "button browser-hub-toolbar-btn",
    y_align: Clutter.ActorAlign.CENTER,
  });
  backBtn.set_child(new St.Icon({ icon_name: "go-previous-symbolic", icon_size: 16 }));
  tooltip(backBtn, "Back");
  backBtn.connect("clicked", onBack);
  content.add_child(backBtn);
  content.add_child(new St.Label({ text: title, y_align: Clutter.ActorAlign.CENTER }));
  row.add_child(content);
  return row;
}

const PICKER_ROW_ICON_SIZE = 16;

export function buildPickerRow(
  item: ResolvedBrowserItem & { pkg: ResolvedBrowserPkg },
  onPick: (item: ResolvedBrowserItem & { pkg: ResolvedBrowserPkg }) => void,
): PopupMenuItem {
  const row = new PopupMenuItem(item.label);
  if (item.icon) {
    const iconWidget = new St.Icon({ ...iconProps(item.icon), icon_size: PICKER_ROW_ICON_SIZE });
    row.insert_child_below(iconWidget, row.label);
  }
  row.connect("activate", () => onPick(item));
  return row;
}

/** Scrollable list; its max height is set in stylesheet.css. */
export function buildScrollablePickerList(rows: PopupMenuItem[]): PopupMenuItem {
  const row = makeIconRow();
  const section = new PopupMenuSection();
  for (const pickerRow of rows) section.addMenuItem(pickerRow);
  const scrollView = new St.ScrollView({
    style_class: "browser-hub-picker-scroll",
    overlay_scrollbars: true,
  });
  scrollView.add_child(section.actor);
  row.add_child(scrollView);
  return row;
}
