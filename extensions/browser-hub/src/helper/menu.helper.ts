import type * as Main from "resource:///org/gnome/shell/ui/main.js";
import type { PopupDummyMenu, PopupMenu } from "resource:///org/gnome/shell/ui/popupMenu.js";
import { PopupMenuItem, PopupSeparatorMenuItem } from "resource:///org/gnome/shell/ui/popupMenu.js";
import type { ResolvedBrowserEntry } from "../types";
import { launchBrowser } from "./runner.helper";

export function fillMenu({
  title,
  menu,
  entries,
  notify,
}: {
  title: string;
  menu: PopupMenu | PopupDummyMenu;
  entries: ResolvedBrowserEntry[];
  notify: typeof Main.notify;
}): void {
  if ("removeAll" in menu) {
    menu.removeAll();
  }

  if (!("addMenuItem" in menu)) {
    return;
  }

  if (entries.length === 0) {
    menu.addMenuItem(new PopupMenuItem("No browsers found", { reactive: false }));
    return;
  }

  for (const entry of entries) {
    menu.addMenuItem(new PopupSeparatorMenuItem(entry.label));
    for (const item of entry.items) {
      const menuItem = new PopupMenuItem(item.label);
      menuItem.connect("activate", () =>
        launchBrowser({ command: item.command, title, notify }),
      );
      menu.addMenuItem(menuItem);
    }
  }
}
