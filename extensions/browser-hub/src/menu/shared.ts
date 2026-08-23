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

// Delay before a hovered button's tooltip appears — long enough that
// sweeping the cursor across several icon buttons in the "Browsers" row
// doesn't flash a tooltip for each one on the way to the button actually
// being aimed at.
const TOOLTIP_HOVER_DELAY_MS = 400;
// Gap between the actor's bottom edge and the tooltip label below it.
const TOOLTIP_GAP_PX = 6;

/**
 * St has no built-in tooltip support to hook into — confirmed against a
 * real St.Button's full GObject property list (89 properties, nothing
 * named "tooltip" or similar) and against GNOME Shell's own shipped
 * gresource bundle (no "tooltip" anywhere in its CSS or JS). The previous
 * version of this function set a `tooltip_text` property that doesn't
 * exist on any St type; GJS silently accepts an assignment to an unknown
 * property as an inert plain JS expando, so every tooltip in this
 * extension was a no-op with no error to notice.
 *
 * This hand-rolled version shows a small floating label after a hover
 * delay, styled with GNOME Shell's own "dash-label" class — the Dash's own
 * app-name tooltip, reused here for the same rounded dark pill in both
 * light/dark themes with no CSS of our own to maintain. Added to
 * Main.layoutManager.uiGroup, not as a child of `actor` itself: a popup
 * menu clips its own content to its bounds, which a child tooltip would be
 * clipped by too.
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
      // Guards against the row closing/being destroyed during the delay
      // (e.g. clicking it fires closeMenu() before this timer runs) — an
      // unmapped actor's transformed position/size both read as (0, 0),
      // which used to plant the tooltip in the top-left corner with nothing
      // left alive to ever hide it (leave-event never fires for an actor
      // the pointer isn't over anymore).
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
  // Not "clicked": this runs on both St.Button rows and PopupMenuItem rows
  // (see toolbar.ts), and PopupMenuItem has no "clicked" signal at all — only
  // "activate", which St.Button doesn't have either. "button-press-event" is
  // the one low-level Clutter event both reactive actors emit.
  actor.connect("button-press-event", hide);
  actor.connect("destroy", hide);
  // Belt-and-suspenders alongside the mapped-check above: catches the row
  // becoming unmapped *after* the label is already showing (e.g. the menu
  // closes while a tooltip is up) — leave-event doesn't fire for an actor
  // that's no longer part of the visible scene, so nothing else would.
  actor.connect("notify::mapped", () => {
    if (!actor.mapped) hide();
  });
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

// Package-manager accent, keyed to the CSS classes in stylesheet.css. Native
// has no accent — it's the unmarked default. An earlier version of this
// indicator overlaid a small badge in the icon's corner (first as a
// composited Gio.EmblemedIcon, later as a CSS background-image on a
// BinLayout-positioned sibling widget) — both approaches turned out
// unreliable in practice (invisible, mis-positioned, or hidden behind the
// icon depending on GNOME version/theme). A border on the button itself
// needs none of that overlay/alignment machinery, so it can't drift out of
// position the same way.
const MANAGER_BTN_CSS_CLASSES: Partial<Record<PackageManager, string>> = {
  [PackageManager.Flatpak]: "browser-hub-browser-btn--flatpak",
  [PackageManager.Snap]: "browser-hub-browser-btn--snap",
};

/**
 * `badgeManager` is only meaningful for the "Browsers" row: it's the only
 * place an icon is shown with no visible text label next to it (a tooltip
 * only, see `tooltip()` below) — everywhere else that shows a
 * package-manager-specific icon already has a "(flatpak)"/"(snap)" label
 * suffix doing the same disambiguation, so an accent there would be
 * redundant.
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

// -- Sub-pages (default-browser/Donut pickers) -------------------------------
//
// fillMenu()'s `page` param swaps the whole menu content for one of these
// instead of expanding a PopupSubMenuMenuItem inline: the outer PopupMenu
// has no scroll capability of its own (PopupMenuBase.box is a plain
// St.BoxLayout), so an inline-expanded list can still push everything below
// it off-screen even though GNOME's own PopupSubMenu.actor is itself an
// St.ScrollView. A full swap has nothing below it to push.

/** Back-chevron + title row — the only content above a sub-page's picker list. */
export function buildSubPageHeader(title: string, onBack: () => void): PopupMenuItem {
  const row = makeIconRow();
  const content = new St.BoxLayout({ style_class: "browser-hub-subpage-header" });
  const backBtn = new St.Button({
    can_focus: true,
    accessible_name: "Back",
    style_class: "button browser-hub-toolbar-btn",
    // The button's own padding makes it taller than the label next to it —
    // St.BoxLayout only centers a child when the child asks for it itself.
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

/**
 * One row per pickable browser — icon + label, activating `onPick` with the
 * whole item (not just its pkg): the default-browser page only needs
 * item.pkg, but Donut's onLaunchDonut needs the whole item, so this shape
 * serves both.
 */
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

/**
 * Wraps `rows` in a height-capped, scrollable section instead of letting
 * them grow the menu without bound — same idea as Clipboard Indicator's own
 * scrollable history list: St.ScrollView (overlay_scrollbars so the
 * scrollbar doesn't eat layout width) around a PopupMenuSection, with the
 * actual height cap set in stylesheet.css.
 */
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
