import St from "gi://St";
import type * as Main from "resource:///org/gnome/shell/ui/main.js";
import type { PopupDummyMenu, PopupMenu } from "resource:///org/gnome/shell/ui/popupMenu.js";
import { PopupMenuItem, PopupSeparatorMenuItem } from "resource:///org/gnome/shell/ui/popupMenu.js";
import type { ResolvedBrowserEntry } from "../types";
import { launchBrowser } from "./runner.helper";

function makeIconButton(
  label: string,
  iconName: string,
  iconSize: number,
  onClick: () => void,
): St.Button {
  const btn = new St.Button({
    can_focus: true,
    accessible_name: label,
    style_class: "button browser-hub-browser-btn",
  });
  btn.set_child(new St.Icon({ icon_name: iconName, icon_size: iconSize }));
  // tooltip_text is a registered GObject property only on GNOME Shell 47+
  if ("tooltip_text" in btn) {
    (btn as unknown as { tooltip_text: string }).tooltip_text = label;
  }
  btn.connect("clicked", onClick);
  return btn;
}

function makeTextButton(label: string, onClick: () => void): St.Button {
  const btn = new St.Button({
    can_focus: true,
    accessible_name: label,
    label,
    style_class: "button browser-hub-space-btn",
  });
  if ("tooltip_text" in btn) {
    (btn as unknown as { tooltip_text: string }).tooltip_text = label;
  }
  btn.connect("clicked", onClick);
  return btn;
}

function makeIconRow(): PopupMenuItem {
  const row = new PopupMenuItem("", { reactive: false, can_focus: false });
  row.label.hide();
  return row;
}

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
      const row = makeIconRow();
      for (const item of entry.items) {
        const cmd = item.command;
        row.add_child(
          makeIconButton(item.label, item.icon ?? "web-browser-symbolic", 24, () =>
            launchBrowser({ command: cmd, title, notify }),
          ),
        );
      }
      menu.addMenuItem(row);
    } else {
      for (const item of entry.items) {
        if (item.spaces && item.spaces.length > 0) {
          const profileItem = new PopupMenuItem(item.label);
          const profileCmd = item.command;
          profileItem.connect("activate", () =>
            launchBrowser({ command: profileCmd, title, notify }),
          );
          menu.addMenuItem(profileItem);
          const spacesRow = makeIconRow();
          for (const space of item.spaces) {
            const spaceCmd = space.command;
            spacesRow.add_child(
              makeTextButton(space.name, () =>
                launchBrowser({ command: spaceCmd, title, notify }),
              ),
            );
          }
          menu.addMenuItem(spacesRow);
        } else {
          const menuItem = new PopupMenuItem(item.label);
          const cmd = item.command;
          menuItem.connect("activate", () =>
            launchBrowser({ command: cmd, title, notify }),
          );
          menu.addMenuItem(menuItem);
        }
      }
    }
  }
}
