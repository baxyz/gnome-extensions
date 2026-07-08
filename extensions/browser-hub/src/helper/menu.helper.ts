import St from "gi://St";
import type * as Main from "resource:///org/gnome/shell/ui/main.js";
import type { PopupDummyMenu, PopupMenu } from "resource:///org/gnome/shell/ui/popupMenu.js";
import { PopupMenuItem, PopupSeparatorMenuItem } from "resource:///org/gnome/shell/ui/popupMenu.js";
import type { BrowserSpace, ResolvedBrowserEntry } from "../types";
import type { DefaultBrowserInfo } from "./default-browser.helper";
import { launchBrowser } from "./internal";

// St.Button.tooltip_text exists at the GObject property level but isn't in @girs types.
function tooltip(btn: St.Button, text: string): void {
  (btn as unknown as { tooltip_text: string }).tooltip_text = text;
}

// Firefox profile theme colors come straight from a SQLite column (see
// firefox-spaces.ts) with no format guarantee. St's CSS engine can't execute
// anything, but a stray `;` could still smuggle in an extra declaration —
// reject anything that isn't a plain color token before it reaches set_style().
function safeCssColor(color: string | undefined): string | undefined {
  return color && /^[^;{}\\\n\r]+$/.test(color) ? color : undefined;
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
    const bgColor = safeCssColor(space.bgColor);
    const fgColor = safeCssColor(space.fgColor);
    if (bgColor || fgColor) {
      const parts: string[] = [];
      if (bgColor) parts.push(`background-color: ${bgColor}`);
      if (fgColor) parts.push(`color: ${fgColor}`);
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

  const closeMenu = () => (menu as { close(): void }).close();

  // Top toolbar: [default browser?] — spacer — refresh — settings
  const toolbar = makeIconRow();
  if (defaultBrowser) {
    const cmd = defaultBrowser.command;
    toolbar.add_child(
      makeDefaultBrowserGroup(
        defaultBrowser.name,
        () => {
          launchBrowser({ command: cmd, title, notify });
          closeMenu();
        },
        () => {
          launchBrowser({ command: ["gnome-control-center", "applications"], title, notify });
          closeMenu();
        },
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

  if (entries.length === 0) {
    menu.addMenuItem(new PopupSeparatorMenuItem());
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
          makeIconButton(item.label, item.icon ?? "web-browser-symbolic", 24, () => {
            launchBrowser({ command: cmd, title, notify });
            closeMenu();
          }),
        );
      }
      menu.addMenuItem(row);
    } else {
      for (const item of entry.items) {
        const menuItem = new PopupMenuItem(item.label);
        if (item.isDefault) menuItem.label.add_style_class_name("browser-hub-default");
        const iconSlot = new St.Label({
          text: item.icon ?? "",
          style_class: "browser-hub-profile-icon",
        });
        menuItem.insert_child_below(iconSlot, menuItem.label);
        const cmd = item.command;
        menuItem.connect("activate", () => launchBrowser({ command: cmd, title, notify }));
        if (item.spaces && item.spaces.length > 0) {
          menuItem.add_child(new St.Widget({ x_expand: true }));
          menuItem.add_child(makeSpaceGroup(item.spaces, title, notify));
        } else if (safeCssColor(item.bgColor)) {
          const dot = new St.Widget({ style_class: "browser-hub-profile-dot" });
          dot.set_style(`background-color: ${item.bgColor};`);
          menuItem.add_child(dot);
        }
        menu.addMenuItem(menuItem);
      }
    }
  }
}
