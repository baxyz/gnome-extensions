import Clutter from "gi://Clutter";
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
  styleClass = "button browser-hub-browser-btn",
): St.Button {
  const btn = new St.Button({
    can_focus: true,
    accessible_name: label,
    style_class: styleClass,
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

function makeSpaceIconButton(label: string, onClick: () => void): St.Button {
  const btn = new St.Button({
    can_focus: true,
    accessible_name: label,
    style_class: "button browser-hub-space-icon-btn",
  });
  btn.set_child(new St.Icon({ icon_name: "circle-symbolic", icon_size: 10 }));
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
  onSettings,
  onRefresh,
}: {
  title: string;
  menu: PopupMenu | PopupDummyMenu;
  entries: ResolvedBrowserEntry[];
  notify: typeof Main.notify;
  onSettings: () => void;
  onRefresh: () => void;
}): void {
  if ("removeAll" in menu) {
    menu.removeAll();
  }

  if (!("addMenuItem" in menu)) {
    return;
  }

  // Top toolbar: refresh + settings, right-aligned
  const toolbar = makeIconRow();
  toolbar.add_child(new St.Widget({ x_expand: true }));
  toolbar.add_child(makeIconButton("Refresh", "view-refresh-symbolic", 16, onRefresh, "button browser-hub-toolbar-btn"));
  toolbar.add_child(
    makeIconButton("Settings", "preferences-system-symbolic", 16, onSettings, "button browser-hub-toolbar-btn"),
  );
  menu.addMenuItem(toolbar);
  menu.addMenuItem(new PopupSeparatorMenuItem());

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
          const profileRow = makeIconRow();
          profileRow.add_child(
            new St.Label({ text: item.label, y_align: Clutter.ActorAlign.CENTER }),
          );
          profileRow.add_child(new St.Widget({ x_expand: true }));
          for (const space of item.spaces) {
            const spaceCmd = space.command;
            profileRow.add_child(
              makeSpaceIconButton(space.name, () =>
                launchBrowser({ command: spaceCmd, title, notify }),
              ),
            );
          }
          profileRow.connect("activate", () =>
            launchBrowser({ command: item.command, title, notify }),
          );
          menu.addMenuItem(profileRow);
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
