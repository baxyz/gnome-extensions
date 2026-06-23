import St from "gi://St";
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

    if (entry.group === "simple") {
      const row = new PopupMenuItem("", { reactive: false, can_focus: false });
      row.label.hide();
      for (const item of entry.items) {
        const btn = new St.Button({
          can_focus: true,
          accessible_name: item.label,
          style_class: "browser-hub-icon-btn",
        });
        btn.set_child(
          new St.Icon({ icon_name: item.icon ?? "web-browser-symbolic", icon_size: 24 }),
        );
        // tooltip_text is available on GNOME Shell 47+
        (btn as unknown as { tooltip_text: string }).tooltip_text = item.label;
        btn.connect("clicked", () => launchBrowser({ command: item.command, title, notify }));
        row.add_child(btn);
      }
      menu.addMenuItem(row);
    } else {
      for (const item of entry.items) {
        if (item.spaces && item.spaces.length > 0) {
          const profileItem = new PopupMenuItem(item.label);
          profileItem.connect("activate", () =>
            launchBrowser({ command: item.command, title, notify }),
          );
          menu.addMenuItem(profileItem);
          // TODO: replace with a mini icon-button bar per workspace alongside the profile item
          for (const space of item.spaces) {
            const menuItem = new PopupMenuItem(`${item.label} · ${space.name}`);
            menuItem.connect("activate", () =>
              launchBrowser({ command: space.command, title, notify }),
            );
            menu.addMenuItem(menuItem);
          }
        } else {
          const menuItem = new PopupMenuItem(item.label);
          menuItem.connect("activate", () =>
            launchBrowser({ command: item.command, title, notify }),
          );
          menu.addMenuItem(menuItem);
        }
      }
    }
  }
}
