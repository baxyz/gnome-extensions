import type * as Main from "resource:///org/gnome/shell/ui/main.js";
import type { PopupDummyMenu, PopupMenu } from "resource:///org/gnome/shell/ui/popupMenu.js";
import { PopupMenuItem, PopupSeparatorMenuItem } from "resource:///org/gnome/shell/ui/popupMenu.js";
import type { BrowserProfiles } from "./digging.helper";
import { openBrowserProfile } from "./runner.helper";

/**
 * Populate the menu with browser profiles.
 *
 * This method can be used also to refresh the menu.
 * It clears the existing menu items and adds new ones.
 *
 * @param {MenuOptions} options - Options for creating the menu.
 */
export function fillMenu({
  title,
  menu,
  profiles,
  notify,
}: {
  title: string;
  menu: PopupMenu | PopupDummyMenu;
  profiles: Array<BrowserProfiles>;
  notify: typeof Main.notify;
}): void {
  if ("removeAll" in menu) {
    menu.removeAll();
  }

  if ("addMenuItem" in menu) {
    fillProfilesInMenu(menu, profiles, title, notify);
  }
}

/**
 * Fill the menu with browser profiles sections.
 *
 * @param menu - The popup menu to fill.
 * @param profiles - Array of browser profiles.
 * @param title - The extension title (for notifications).
 * @param notify - GNOME Shell notification function.
 */
function fillProfilesInMenu(
  menu: PopupMenu | PopupDummyMenu,
  profiles: Array<BrowserProfiles>,
  title: string,
  notify: typeof Main.notify,
): void {
  if (!("addMenuItem" in menu)) {
    return;
  }

  if (profiles.length === 0) {
    menu.addMenuItem(new PopupMenuItem("No profiles found", { reactive: false }));
    return;
  }

  profiles.forEach((browser) => {
    const section = new PopupSeparatorMenuItem(browser.label);
    menu.addMenuItem(section);

    browser.profiles.forEach((profile) => {
      const item = new PopupMenuItem(profile);
      item.connect("activate", () =>
        openBrowserProfile({
          command: browser.command,
          profile,
          title,
          notify,
        }),
      );
      menu.addMenuItem(item);
    });
  });
}
