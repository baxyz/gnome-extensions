import St from "gi://St";
import type * as Main from "resource:///org/gnome/shell/ui/main.js";
import type { PopupDummyMenu, PopupMenu } from "resource:///org/gnome/shell/ui/popupMenu.js";
import { PopupMenuItem, PopupSeparatorMenuItem } from "resource:///org/gnome/shell/ui/popupMenu.js";
import type { BrowserSpace, ResolvedBrowserEntry } from "../types";
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

function makeSpaceGroup(
  spaces: BrowserSpace[],
  title: string,
  notify: typeof Main.notify,
): St.BoxLayout {
  const group = new St.BoxLayout({});
  const btns = spaces.map((space) => {
    const displayIcon = space.icon && space.icon.length <= 4 ? space.icon : "•";
    const btn = new St.Button({
      can_focus: true,
      accessible_name: space.name,
      label: displayIcon,
      style_class: "button browser-hub-space-dot-btn",
    });
    if (space.bgColor || space.fgColor) {
      const parts: string[] = [];
      if (space.bgColor) parts.push(`background-color: ${space.bgColor}`);
      if (space.fgColor) parts.push(`color: ${space.fgColor}`);
      btn.set_style(parts.join("; "));
    }
    tooltip(btn, space.name);
    const cmd = space.command;
    btn.connect("clicked", () => launchBrowser({ command: cmd, title, notify }));
    return btn;
  });
  const n = btns.length;
  btns.forEach((btn, i) => {
    const mod = n === 1 ? "--solo" : i === 0 ? "--first" : i === n - 1 ? "--last" : "--mid";
    btn.add_style_class_name(`browser-hub-space-dot-btn${mod}`);
    group.add_child(btn);
  });
  return group;
}

function makeDefaultBrowserGroup(
  name: string,
  onLaunch: () => void,
  onChangeDefault: () => void,
  showEdit: boolean,
): St.BoxLayout {
  const group = new St.BoxLayout({ style_class: "browser-hub-btn-group" });

  const launchBtn = new St.Button({
    can_focus: true,
    accessible_name: name,
    label: name,
    style_class: showEdit
      ? "button browser-hub-default-browser-btn"
      : "button browser-hub-default-browser-btn browser-hub-default-browser-btn--solo",
  });
  tooltip(launchBtn, name);
  launchBtn.connect("clicked", onLaunch);
  group.add_child(launchBtn);

  if (showEdit) {
    const changeBtn = new St.Button({
      can_focus: true,
      accessible_name: "Change default browser",
      style_class: "button browser-hub-change-default-btn",
    });
    changeBtn.set_child(new St.Icon({ icon_name: "document-edit-symbolic", icon_size: 12 }));
    tooltip(changeBtn, "Change default browser");
    changeBtn.connect("clicked", onChangeDefault);
    group.add_child(changeBtn);
  }

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
  showDefaultBrowserEdit = true,
}: {
  title: string;
  menu: PopupMenu | PopupDummyMenu;
  entries: ResolvedBrowserEntry[];
  notify: typeof Main.notify;
  onSettings: () => void;
  onRefresh: () => void;
  defaultBrowser?: DefaultBrowserInfo | null;
  showDefaultBrowserEdit?: boolean;
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
        () => launchBrowser({ command: "gio open settings:///default-apps", title, notify }),
        showDefaultBrowserEdit,
      ),
    );
  }
  toolbar.add_child(new St.Widget({ x_expand: true }));
  toolbar.add_child(
    makeIconButton(
      "Refresh",
      "view-refresh-symbolic",
      16,
      onRefresh,
      "button browser-hub-toolbar-btn",
    ),
  );
  toolbar.add_child(
    makeIconButton(
      "Settings",
      "preferences-system-symbolic",
      16,
      onSettings,
      "button browser-hub-toolbar-btn",
    ),
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
          const menuItem = new PopupMenuItem(item.label);
          if (item.isDefault) menuItem.label.add_style_class_name("browser-hub-default");
          const cmd = item.command;
          menuItem.connect("activate", () => launchBrowser({ command: cmd, title, notify }));
          menuItem.add_child(new St.Widget({ x_expand: true }));
          menuItem.add_child(makeSpaceGroup(item.spaces, title, notify));
          menu.addMenuItem(menuItem);
        } else {
          const menuItem = new PopupMenuItem(item.label);
          if (item.isDefault) menuItem.label.add_style_class_name("browser-hub-default");
          if (item.bgColor) {
            const dot = new St.Widget({ style_class: "browser-hub-profile-dot" });
            dot.set_style(`background-color: ${item.bgColor};`);
            menuItem.add_child(dot);
          }
          const cmd = item.command;
          menuItem.connect("activate", () => launchBrowser({ command: cmd, title, notify }));
          menu.addMenuItem(menuItem);
        }
      }
    }
  }
}
