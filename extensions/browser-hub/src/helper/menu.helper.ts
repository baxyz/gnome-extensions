import St from "gi://St";
import type * as Main from "resource:///org/gnome/shell/ui/main.js";
import type { PopupDummyMenu, PopupMenu } from "resource:///org/gnome/shell/ui/popupMenu.js";
import { PopupMenuItem, PopupSeparatorMenuItem } from "resource:///org/gnome/shell/ui/popupMenu.js";
import type { ResolvedBrowserEntry } from "../types";
import type { DefaultBrowserInfo } from "./default-browser.helper";
import { launchBrowser } from "./runner.helper";

// tooltip_text is a registered GObject property only on GNOME Shell 47+
function tooltip(btn: St.Button, text: string): void {
  if ("tooltip_text" in btn) (btn as unknown as { tooltip_text: string }).tooltip_text = text;
}

function makeIconButton(
  label: string,
  iconName: string,
  iconSize: number,
  onClick: () => void,
  styleClass = "button browser-hub-browser-btn",
): St.Button {
  const btn = new St.Button({ can_focus: true, accessible_name: label, style_class: styleClass });
  btn.set_child(new St.Icon({ icon_name: iconName, icon_size: iconSize }));
  tooltip(btn, label);
  btn.connect("clicked", onClick);
  return btn;
}

function makeTextButton(label: string, onClick: () => void, isDefault = false): St.Button {
  const btn = new St.Button({
    can_focus: true,
    accessible_name: label,
    label,
    style_class: `button browser-hub-space-btn${isDefault ? " browser-hub-default" : ""}`,
  });
  tooltip(btn, label);
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
  tooltip(btn, label);
  btn.connect("clicked", onClick);
  return btn;
}

function makeDefaultBrowserGroup(
  name: string,
  onLaunch: () => void,
  onChangeDefault: () => void,
): St.BoxLayout {
  const group = new St.BoxLayout({ style_class: "browser-hub-btn-group" });

  const launchBtn = new St.Button({
    can_focus: true,
    accessible_name: name,
    label: name,
    style_class: "button browser-hub-default-browser-btn",
  });
  tooltip(launchBtn, name);
  launchBtn.connect("clicked", onLaunch);

  const changeBtn = new St.Button({
    can_focus: true,
    accessible_name: "Change default browser",
    style_class: "button browser-hub-change-default-btn",
  });
  changeBtn.set_child(new St.Icon({ icon_name: "document-edit-symbolic", icon_size: 12 }));
  tooltip(changeBtn, "Change default browser");
  changeBtn.connect("clicked", onChangeDefault);

  group.add_child(launchBtn);
  group.add_child(changeBtn);
  return group;
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
  defaultBrowser,
}: {
  title: string;
  menu: PopupMenu | PopupDummyMenu;
  entries: ResolvedBrowserEntry[];
  notify: typeof Main.notify;
  onSettings: () => void;
  onRefresh: () => void;
  defaultBrowser?: DefaultBrowserInfo | null;
}): void {
  if ("removeAll" in menu) {
    menu.removeAll();
  }

  if (!("addMenuItem" in menu)) {
    return;
  }

  // Top toolbar: [default browser?] — spacer — refresh — settings
  const toolbar = makeIconRow();
  if (defaultBrowser) {
    const cmd = defaultBrowser.command;
    toolbar.add_child(
      makeDefaultBrowserGroup(
        defaultBrowser.name,
        () => launchBrowser({ command: cmd, title, notify }),
        () => launchBrowser({ command: "gnome-control-center default-apps", title, notify }),
      ),
    );
  }
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
          const cmd = item.command;
          profileRow.add_child(
            makeTextButton(
              item.label,
              () => launchBrowser({ command: cmd, title, notify }),
              item.isDefault,
            ),
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
          menu.addMenuItem(profileRow);
        } else {
          const menuItem = new PopupMenuItem(item.label);
          if (item.isDefault) menuItem.label.add_style_class_name("browser-hub-default");
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
