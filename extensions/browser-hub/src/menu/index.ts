import type * as Main from "resource:///org/gnome/shell/ui/main.js";
import type { PopupDummyMenu, PopupMenu } from "resource:///org/gnome/shell/ui/popupMenu.js";
import { PopupMenuItem } from "resource:///org/gnome/shell/ui/popupMenu.js";
import type { ResolvedBrowserEntry, ResolvedBrowserItem, ResolvedBrowserPkg } from "../taxonomy";
import type { DefaultBrowserInfo } from "../default-browser";
import { findDonutBrowser } from "../donut-browser";
import { isEmpty } from "@helpers4/array";
import { noop } from "@helpers4/function";
import { buildCategorySeparator } from "./shared";
import { buildDefaultBrowserPicker, buildToolbar } from "./toolbar";
import { buildProfileMenuItem, buildSimpleBrowserRow } from "./browser-rows";

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
  onTogglePicker = noop,
  onSetDefaultBrowser = noop,
  showDonutBrowser = false,
  onLaunchDonut = () => Promise.resolve(),
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
  showDonutBrowser?: boolean;
  onLaunchDonut?: (item: ResolvedBrowserItem & { pkg: ResolvedBrowserPkg }) => Promise<void>;
}): void {
  if ("removeAll" in menu) {
    menu.removeAll();
  }

  if (!("addMenuItem" in menu)) {
    return;
  }

  const closeMenu = () => (menu as { close(): void }).close();

  // Both the picker and the Donut button act on the same "Browsers" row
  // items the quick-launch icons below are built from — one row per
  // installed browser identity, already carrying pkg.
  const browsers = entries.find((e) => e.group === "simple")?.items ?? [];
  const donutBrowser = showDonutBrowser ? findDonutBrowser(browsers, defaultBrowser ?? null) : null;

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
        showDonutButton: donutBrowser !== null,
        onLaunchDonut: () => onLaunchDonut(donutBrowser!),
        notify,
        onRefresh,
        onSettings,
        closeMenu,
      }),
    );
    // The picker's rows come from the same list — see `browsers` above.
    if (showDefaultBrowserEdit && pickerOpen) {
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
