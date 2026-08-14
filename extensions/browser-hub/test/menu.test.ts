import { describe, it, expect, vi, beforeEach } from "vitest";
import type Gio from "gi://Gio";
import { noop } from "@helpers4/function";
import { PackageManager } from "../src/taxonomy";

const FAKE_DEFAULT_BROWSER_PKG = { manager: PackageManager.Native, binary: "firefox" } as const;

// menu.ts imports { launchBrowser } from "./internal", which loads the
// whole internal/index.ts barrel — including pkg.ts, which imports "gi://GLib"
// at module scope even though nothing in these tests exercises GLib-using
// functions. Needs a stub so the import itself resolves under Node.
vi.mock("gi://GLib", () => ({
  default: {
    get_home_dir: () => "/home/user",
    getenv: () => null,
    find_program_in_path: () => null,
  },
}));

// internal/desktop-icon.ts (transitively imported) also imports
// "gi://GdkPixbuf" to validate .desktop icons before use — irrelevant to
// what this file tests, so a stub that always "succeeds" is enough for the
// module to load under Node.
vi.mock("gi://GdkPixbuf", () => ({
  default: {
    Pixbuf: { new_from_file_at_size: () => ({ get_width: () => 1, get_height: () => 1 }) },
  },
}));

// Safety-net tests for the CURRENT rendering behavior of menu.ts,
// written before the Phase 2 color/icon type rework (see the approved plan).
// Only fillMenu is exported — everything else is driven through it and
// asserted on the resulting fake widget tree, which is what these tests
// treat as "observable behavior".

class FakeWidget {
  children: FakeWidget[] = [];
  style?: string;
  styleClasses: string[] = [];
  handlers: Record<string, (() => void)[]> = {};
  props: Record<string, unknown>;
  constructor(props: Record<string, unknown> = {}) {
    this.props = props;
  }
  add_child(child: FakeWidget): void {
    this.children.push(child);
  }
  set_child(child: FakeWidget): void {
    this.children = [child];
  }
  set_style(s: string): void {
    this.style = s;
  }
  add_style_class_name(c: string): void {
    this.styleClasses.push(c);
  }
  connect(event: string, handler: () => void): void {
    (this.handlers[event] ??= []).push(handler);
  }
  emit(event: string): void {
    this.handlers[event]?.forEach((h) => h());
  }
}
class FakeIcon extends FakeWidget {}
// Real St.Button defaults reactive to true; makeDonutButton's click handler
// (menu.ts) reads it back to guard against double-clicks while busy.
class FakeButton extends FakeWidget {
  reactive = true;
}
class FakeBoxLayout extends FakeWidget {}
class FakeBin extends FakeWidget {}

vi.mock("gi://St", () => ({
  default: {
    Widget: FakeWidget,
    Icon: FakeIcon,
    Button: FakeButton,
    BoxLayout: FakeBoxLayout,
    Bin: FakeBin,
    // Real St.Label takes a GObject-style props object; FakeLabel (below,
    // also reused directly by FakePopupMenuItem) takes a plain string.
    Label: class extends FakeLabel {
      constructor(props: { text: string }) {
        super(props.text);
      }
    },
    IconTheme: class {
      has_icon() {
        return true;
      }
    },
  },
}));

// menu/shared.ts's withBadge() overlays a package-manager badge using
// Clutter.BinLayout — FakeWidget already accepts an arbitrary props object
// (including layout_manager) without validating it, so a minimal stub of
// the two symbols it references is enough.
vi.mock("gi://Clutter", () => ({
  default: {
    BinLayout: class {},
    ActorAlign: { END: "end" },
  },
}));

class FakeLabel extends FakeWidget {
  text: string;
  constructor(text: string) {
    super();
    this.text = text;
  }
  hide(): void {
    this.styleClasses.push("__hidden__");
  }
}
class FakePopupMenuItem extends FakeWidget {
  label: FakeLabel;
  constructor(text: string, _params?: Record<string, unknown>) {
    super();
    this.label = new FakeLabel(text);
  }
  insert_child_below(child: FakeWidget, _sibling: FakeWidget): void {
    this.children.unshift(child);
  }
}
class FakePopupSeparatorMenuItem extends FakeWidget {
  label: FakeLabel;
  constructor(public text?: string) {
    super();
    this.label = new FakeLabel(text ?? "");
  }
  insert_child_below(child: FakeWidget, _sibling: FakeWidget): void {
    this.children.unshift(child);
  }
}
class FakePopupSubMenu {
  items: FakeWidget[] = [];
  addMenuItem(item: FakeWidget): void {
    this.items.push(item);
  }
}
class FakePopupSubMenuMenuItem extends FakeWidget {
  label: FakeLabel;
  icon?: FakeIcon;
  menu: FakePopupSubMenu;
  constructor(text: string, wantIcon?: boolean) {
    super();
    this.label = new FakeLabel(text);
    if (wantIcon) this.icon = new FakeIcon();
    this.menu = new FakePopupSubMenu();
  }
}

vi.mock("resource:///org/gnome/shell/ui/popupMenu.js", () => ({
  PopupMenuItem: FakePopupMenuItem,
  PopupSeparatorMenuItem: FakePopupSeparatorMenuItem,
  PopupSubMenuMenuItem: FakePopupSubMenuMenuItem,
}));

class FakeSpinner extends FakeWidget {
  play(): void {}
  stop(): void {}
  destroy(): void {}
}
vi.mock("resource:///org/gnome/shell/ui/animation.js", () => ({
  Spinner: FakeSpinner,
}));

const subprocessNew = vi.fn();
// menu.ts imports launchBrowser/resolveDesktopIcon from "./internal", the
// barrel that includes gio.ts — its Gio._promisify(Gio.File.prototype, ...)
// call at module scope needs an actual prototype to patch even though
// nothing here exercises the promisified methods themselves.
class FakeGioFile {}

vi.mock("gi://Gio", () => ({
  default: {
    Subprocess: { new: subprocessNew },
    SubprocessFlags: { NONE: 0 },
    File: FakeGioFile,
    _promisify: () => {},
  },
}));

// menu.ts's buildToolbar resolves the default browser's own icon via
// resolveDesktopIcon() — no app matches in this test environment, which
// exercises the same "no icon found" tolerance as a real missing .desktop file.
vi.mock("gi://GioUnix", () => ({
  default: { DesktopAppInfo: { new: () => null } },
}));

const { fillMenu } = await import("../src/menu");

type FakeMenu = {
  items: FakeWidget[];
  removeAll: () => void;
  addMenuItem: (item: FakeWidget) => void;
  close: () => void;
};
function makeFakeMenu(): FakeMenu {
  const items: FakeWidget[] = [];
  return {
    items,
    removeAll: () => {
      items.length = 0;
    },
    addMenuItem: (item: FakeWidget) => items.push(item),
    close: () => {},
  };
}

const notify = vi.fn();

beforeEach(() => {
  subprocessNew.mockClear();
  notify.mockClear();
});

describe("fillMenu", () => {
  it("shows a loading row (not the empty-state message) when entries is null", async () => {
    const menu = makeFakeMenu();
    await fillMenu({ title: "t", menu, entries: null, notify, onSettings: noop, onRefresh: noop });

    const row = menu.items[1] as FakePopupMenuItem; // [0] toolbar, [1] this row
    expect(row.label.text).toBe("Loading browsers…");
    expect(row.children[0]).toBeInstanceOf(FakeSpinner);
  });

  it("shows a short error banner right after the toolbar when errors is non-empty", async () => {
    const menu = makeFakeMenu();
    await fillMenu({
      title: "t",
      menu,
      entries: [],
      errors: ["Firefox (snap): profiles.ini not found"],
      notify,
      onSettings: noop,
      onRefresh: noop,
    });

    const banner = menu.items[1] as FakePopupMenuItem; // [0] toolbar, [1] this row
    expect(banner.label.text).toBe("Problem: couldn't list Firefox (snap): profiles.ini not found");
    expect(banner.children[0]).toBeInstanceOf(FakeIcon);
  });

  it("shows no banner at all when errors is empty", async () => {
    const menu = makeFakeMenu();
    await fillMenu({ title: "t", menu, entries: [], notify, onSettings: noop, onRefresh: noop });

    // [0] toolbar, [1] straight to the empty-state message — no banner in between.
    expect((menu.items[1] as FakePopupMenuItem).label.text).toBe(
      "Nothing to show — check Settings, or install a browser",
    );
  });

  it("shows an empty-state message with no separator when entries is empty", async () => {
    const menu = makeFakeMenu();
    await fillMenu({ title: "t", menu, entries: [], notify, onSettings: noop, onRefresh: noop });

    const message = menu.items[1]; // [0] is the toolbar row, nothing separates the message from it
    expect(message).not.toBeInstanceOf(FakePopupSeparatorMenuItem);
    expect((message as FakePopupMenuItem).label.text).toBe(
      "Nothing to show — check Settings, or install a browser",
    );
  });

  it("renders an empty St.Bin icon slot (not St.Icon) for a profile item with no icon", async () => {
    const menu = makeFakeMenu();
    await fillMenu({
      title: "t",
      menu,
      entries: [{ label: "Falkon", items: [{ label: "default", command: ["falkon"] }] }],
      notify,
      onSettings: noop,
      onRefresh: noop,
    });

    const profileItem = menu.items[2] as FakePopupMenuItem; // [0] toolbar, [1] separator, [2] item
    const iconSlot = profileItem.children[0];
    expect(iconSlot).toBeInstanceOf(FakeBin);
    expect(iconSlot.children).toHaveLength(0);
  });

  it("puts the 'Browsers' row's icon buttons on a single line when they fit", async () => {
    const menu = makeFakeMenu();
    await fillMenu({
      title: "t",
      menu,
      entries: [
        {
          label: "Browsers",
          group: "simple",
          items: [
            { label: "GNOME Web", command: ["epiphany"] },
            { label: "qutebrowser", command: ["qutebrowser"] },
          ],
        },
      ],
      notify,
      onSettings: noop,
      onRefresh: noop,
    });

    // [0] toolbar, [1] row — no separator: "Browsers" is the menu's only entry.
    const row = menu.items[1] as FakePopupMenuItem;
    const container = row.children[0];
    expect(container.children).toHaveLength(1); // one line, not one child per button
    const line = container.children[0];
    expect(line).toBeInstanceOf(FakeBoxLayout);
    expect(line.children).toHaveLength(2);
  });

  it("overlays a package-manager badge on a Flatpak/Snap browser's icon button, not on a Native one", async () => {
    const menu = makeFakeMenu();
    await fillMenu({
      title: "t",
      menu,
      entries: [
        {
          label: "Browsers",
          group: "simple",
          items: [
            {
              label: "Zen (flatpak)",
              command: ["flatpak", "run", "app.zen_browser.zen"],
              pkg: { manager: PackageManager.Flatpak, appId: "app.zen_browser.zen" },
            },
            {
              label: "Firefox",
              command: ["firefox"],
              pkg: { manager: PackageManager.Native, binary: "firefox" },
            },
          ],
        },
      ],
      notify,
      onSettings: noop,
      onRefresh: noop,
    });

    const row = menu.items[1] as FakePopupMenuItem;
    const line = row.children[0].children[0];
    const [flatpakButton, nativeButton] = line.children as FakeButton[];

    // Flatpak: icon wrapped in a badge container (icon + badge overlay).
    const badgeContainer = flatpakButton.children[0];
    expect(badgeContainer.children).toHaveLength(2);
    expect(badgeContainer.children[0]).toBeInstanceOf(FakeIcon);
    expect(badgeContainer.children[1].props.style_class).toContain("browser-hub-badge-flatpak");

    // Native: no badge, the button's direct child is the plain icon.
    expect(nativeButton.children[0]).toBeInstanceOf(FakeIcon);
  });

  it("wraps the 'Browsers' row's icon buttons onto additional lines past the per-line cap", async () => {
    const menu = makeFakeMenu();
    const items = Array.from({ length: 7 }, (_, i) => ({
      label: `Browser ${i}`,
      command: [`browser${i}`],
    }));
    await fillMenu({
      title: "t",
      menu,
      entries: [{ label: "Browsers", group: "simple", items }],
      notify,
      onSettings: noop,
      onRefresh: noop,
    });

    // [0] toolbar, [1] row — no separator: "Browsers" is the menu's only entry.
    const row = menu.items[1] as FakePopupMenuItem;
    const container = row.children[0];
    expect(container.children).toHaveLength(2); // 6 on the first line, 1 on the second
    expect(container.children[0].children).toHaveLength(6);
    expect(container.children[1].children).toHaveLength(1);
  });

  it("caps the 'Browsers' row at 50 icons and reports the rest as hidden", async () => {
    const menu = makeFakeMenu();
    const items = Array.from({ length: 55 }, (_, i) => ({
      label: `Browser ${i}`,
      command: [`browser${i}`],
    }));
    await fillMenu({
      title: "t",
      menu,
      entries: [{ label: "Browsers", group: "simple", items }],
      notify,
      onSettings: noop,
      onRefresh: noop,
    });

    // [0] toolbar, [1] row (50 icons across lines), [2] truncation banner.
    const row = menu.items[1] as FakePopupMenuItem;
    const container = row.children[0];
    const shown = container.children.reduce((n: number, line) => n + line.children.length, 0);
    expect(shown).toBe(50);
    const banner = menu.items[2] as FakePopupMenuItem;
    expect(banner.label.text).toBe("…and 5 more hidden (see Settings to narrow this down)");
  });

  it("spreads the icon budget across entries, hiding a whole profiled entry once it's exhausted", async () => {
    const menu = makeFakeMenu();
    const simpleItems = Array.from({ length: 48 }, (_, i) => ({
      label: `Browser ${i}`,
      command: [`browser${i}`],
    }));
    const profileItems = [
      { label: "Default", command: ["firefox", "-p", "default"] },
      { label: "Work", command: ["firefox", "-p", "work"] },
      { label: "Personal", command: ["firefox", "-p", "personal"] },
    ];
    await fillMenu({
      title: "t",
      menu,
      entries: [
        { label: "Firefox", items: profileItems },
        { label: "Browsers", group: "simple", items: simpleItems },
      ],
      notify,
      onSettings: noop,
      onRefresh: noop,
    });

    // Firefox gets its full 3 profiles (budget 50 - 3 = 47 left for Browsers),
    // Browsers only fits 47 of its 48 — 1 hidden overall.
    const truncated = menu.items[menu.items.length - 1] as FakePopupMenuItem;
    expect(truncated.label.text).toBe("…and 1 more hidden (see Settings to narrow this down)");
  });

  it("drops the whole 'Browsers' row instead of adding a partial one when isLive turns false mid-build", async () => {
    const menu = makeFakeMenu();
    const items = Array.from({ length: 7 }, (_, i) => ({
      label: `Browser ${i}`,
      command: [`browser${i}`],
    }));
    let live = true;
    // fillMenu awaits a real (short) delay between the Browsers row's lines
    // (see buildSimpleBrowserRow) — flipping `live` right after the call,
    // without awaiting yet, lands in that gap: the first line has already
    // been built synchronously, the second hasn't started.
    const pending = fillMenu({
      title: "t",
      menu,
      entries: [{ label: "Browsers", group: "simple", items }],
      notify,
      onSettings: noop,
      onRefresh: noop,
      isLive: () => live,
    });
    live = false;
    await pending;

    // [0] toolbar only — the Browsers row never made it in, not even the
    // first line that was already built when the build was superseded.
    expect(menu.items).toHaveLength(1);
  });

  it("falls back to a generic icon (not a blank button) for a 'Browsers' row item with no icon", async () => {
    const menu = makeFakeMenu();
    await fillMenu({
      title: "t",
      menu,
      entries: [
        {
          label: "Browsers",
          group: "simple",
          items: [{ label: "Some Browser", command: ["some-browser"] }], // no icon
        },
      ],
      notify,
      onSettings: noop,
      onRefresh: noop,
    });

    const row = menu.items[1] as FakePopupMenuItem; // [0] toolbar, [1] row — no separator
    const line = row.children[0].children[0] as FakeBoxLayout;
    const button = line.children[0] as FakeButton;
    const icon = button.children[0] as FakeIcon;
    expect(icon).toBeInstanceOf(FakeIcon);
    expect(icon.props.icon_name).toBe("web-browser-symbolic");
  });

  it("keeps the category separator for a lone profiled entry, unlike a lone 'Browsers' row", async () => {
    // Sanity check for the narrower condition: a lone *profiled* family
    // entry (group !== "simple") still gets its separator/header even when
    // it's the menu's only entry — only a lone "Browsers" row omits it (see
    // the next test). Its label is the one thing naming which family the
    // profile rows below it belong to, worth keeping even alone.
    const menu = makeFakeMenu();
    await fillMenu({
      title: "t",
      menu,
      entries: [{ label: "Falkon", items: [{ label: "default", command: ["falkon"] }] }],
      notify,
      onSettings: noop,
      onRefresh: noop,
    });

    expect(menu.items[1]).toBeInstanceOf(FakePopupSeparatorMenuItem);
  });

  it("omits the category separator when the 'Browsers' row is the menu's only entry", async () => {
    const menu = makeFakeMenu();
    await fillMenu({
      title: "t",
      menu,
      entries: [
        { label: "Browsers", group: "simple", items: [{ label: "Firefox", command: ["firefox"] }] },
      ],
      notify,
      onSettings: noop,
      onRefresh: noop,
    });

    // [0] toolbar, [1] the row itself — no separator to skip past.
    expect(menu.items).toHaveLength(2);
    expect(menu.items[1]).not.toBeInstanceOf(FakePopupSeparatorMenuItem);
  });

  it("shows the browser's icon before the separator label when the entry has one", async () => {
    const menu = makeFakeMenu();
    const fakeGicon = {} as Gio.Icon;
    await fillMenu({
      title: "t",
      menu,
      entries: [
        {
          label: "Firefox (snap)",
          items: [{ label: "default", command: ["firefox"] }],
          icon: fakeGicon,
        },
      ],
      notify,
      onSettings: noop,
      onRefresh: noop,
    });

    const separator = menu.items[1] as FakePopupSeparatorMenuItem;
    const iconWidget = separator.children[0] as FakeIcon;
    expect(iconWidget).toBeInstanceOf(FakeIcon);
    expect(iconWidget.props.gicon).toBe(fakeGicon);
  });

  it("renders no icon before the separator label when the entry has none", async () => {
    const menu = makeFakeMenu();
    await fillMenu({
      title: "t",
      menu,
      entries: [{ label: "Falkon", items: [{ label: "default", command: ["falkon"] }] }],
      notify,
      onSettings: noop,
      onRefresh: noop,
    });

    const separator = menu.items[1] as FakePopupSeparatorMenuItem;
    expect(separator.children).toHaveLength(0);
  });

  it("renders a real St.Icon for a profile item with an icon", async () => {
    const menu = makeFakeMenu();
    await fillMenu({
      title: "t",
      menu,
      entries: [
        {
          label: "Firefox",
          items: [{ label: "default", command: ["firefox"], icon: "firefox-symbolic" }],
        },
      ],
      notify,
      onSettings: noop,
      onRefresh: noop,
    });

    const profileItem = menu.items[2] as FakePopupMenuItem;
    const iconSlot = profileItem.children[0] as FakeBin;
    expect(iconSlot).toBeInstanceOf(FakeBin);
    const icon = iconSlot.children[0] as FakeIcon;
    expect(icon).toBeInstanceOf(FakeIcon);
    expect(icon.props.icon_name).toBe("firefox-symbolic");
  });

  it("applies color.mode 'badge' fgColor as an icon tint with no fgColor bgColor pill", async () => {
    const menu = makeFakeMenu();
    await fillMenu({
      title: "t",
      menu,
      entries: [
        {
          label: "Firefox",
          items: [
            {
              label: "Work",
              command: ["firefox"],
              icon: "starred-symbolic",
              color: { mode: "badge", fgColor: "#ffffff" },
            },
          ],
        },
      ],
      notify,
      onSettings: noop,
      onRefresh: noop,
    });

    const profileItem = menu.items[2] as FakePopupMenuItem;
    const icon = (profileItem.children[0] as FakeBin).children[0] as FakeIcon;
    expect(icon.style).toBe("color: #ffffff;");
    expect(icon.props.icon_size).toBe(16); // no pill — full size, nothing to shrink for
  });

  it("applies color.mode 'badge' bgColor as a background pill, shrinking the icon so the total footprint matches a plain icon", async () => {
    const menu = makeFakeMenu();
    await fillMenu({
      title: "t",
      menu,
      entries: [
        {
          label: "Firefox",
          items: [
            {
              label: "Work",
              command: ["firefox"],
              icon: "starred-symbolic",
              color: { mode: "badge", fgColor: "#ffffff", bgColor: "#20123a" },
            },
          ],
        },
      ],
      notify,
      onSettings: noop,
      onRefresh: noop,
    });

    const profileItem = menu.items[2] as FakePopupMenuItem;
    const icon = (profileItem.children[0] as FakeBin).children[0] as FakeIcon;
    expect(icon.style).toBe(
      "color: #ffffff; background-color: #20123a; border-radius: 4px; padding: 3px 1px;",
    );
    // 16px plain icon vs 14px icon + 1px horizontal padding each side = 16px total width either way.
    expect(icon.props.icon_size).toBe(14);
  });

  it("renders color.mode 'dot' as a separate indicator, not an icon badge (Chromium)", async () => {
    const menu = makeFakeMenu();
    await fillMenu({
      title: "t",
      menu,
      entries: [
        {
          label: "Chromium",
          items: [
            {
              label: "Default",
              command: ["chromium"],
              icon: "web-browser-symbolic",
              color: { mode: "dot", bgColor: "rgb(17,34,51)" },
            },
          ],
        },
      ],
      notify,
      onSettings: noop,
      onRefresh: noop,
    });

    const profileItem = menu.items[2] as FakePopupMenuItem;
    const icon = (profileItem.children[0] as FakeBin).children[0] as FakeIcon;
    expect(icon.style).toBeUndefined(); // no badge on the icon itself
    const dot = profileItem.children.at(-1) as FakeWidget;
    expect(dot.props.style_class).toBe("browser-hub-profile-dot");
    expect(dot.style).toContain("background-color: rgb(17,34,51)");
  });

  it("renders space buttons with the same icon size for real icons and the neutral fallback dot", async () => {
    const menu = makeFakeMenu();
    await fillMenu({
      title: "t",
      menu,
      entries: [
        {
          label: "Zen",
          items: [
            {
              label: "default",
              command: ["zen-browser"],
              spaces: [
                {
                  name: "Work",
                  command: ["zen-browser", "--zen-workspace", "Work"],
                  icon: "briefcase-symbolic",
                },
                {
                  name: "Untitled",
                  command: ["zen-browser", "--zen-workspace", "Untitled"],
                  icon: "media-record-symbolic",
                },
              ],
            },
          ],
        },
      ],
      notify,
      onSettings: noop,
      onRefresh: noop,
    });

    const profileItem = menu.items[2] as FakePopupMenuItem;
    const spaceGroup = profileItem.children.at(-1) as FakeBoxLayout;
    const [workBtn, untitledBtn] = spaceGroup.children as FakeButton[];
    expect((workBtn.children[0] as FakeIcon).props.icon_size).toBe(16);
    expect((untitledBtn.children[0] as FakeIcon).props.icon_size).toBe(16);
  });

  it("launches the item's command via Gio.Subprocess when a profile menu item is activated", async () => {
    const menu = makeFakeMenu();
    await fillMenu({
      title: "t",
      menu,
      entries: [
        { label: "Firefox", items: [{ label: "default", command: ["firefox", "-P", "default"] }] },
      ],
      notify,
      onSettings: noop,
      onRefresh: noop,
    });

    const profileItem = menu.items[2] as FakePopupMenuItem;
    profileItem.emit("activate");
    expect(subprocessNew).toHaveBeenCalledWith(["firefox", "-P", "default"], 0);
  });

  it("uses a real PopupSubMenuMenuItem for the default browser when showDefaultBrowserEdit is true", async () => {
    const menuWithEdit = makeFakeMenu();
    await fillMenu({
      title: "t",
      menu: menuWithEdit,
      entries: [],
      notify,
      onSettings: noop,
      onRefresh: noop,
      defaultBrowser: { name: "Firefox", command: ["firefox"], pkg: FAKE_DEFAULT_BROWSER_PKG },
      showDefaultBrowserEdit: true,
    });
    const item = menuWithEdit.items[1] as FakePopupSubMenuMenuItem; // [0] toolbar, [1] this row
    expect(item).toBeInstanceOf(FakePopupSubMenuMenuItem);
    expect(item.label.text).toBe("Firefox");
    expect(item.icon).toBeInstanceOf(FakeIcon);
    // No other installed browsers (entries is []) — just the Launch action.
    expect(item.menu.items).toHaveLength(1);
    const launchItem = item.menu.items[0] as FakePopupMenuItem;
    expect(launchItem.label.text).toBe("Launch Firefox");
    launchItem.emit("activate");
    expect(subprocessNew).toHaveBeenCalledWith(["firefox"], 0);
  });

  it("falls back to a plain, non-expandable button when showDefaultBrowserEdit is false", async () => {
    const menu = makeFakeMenu();
    await fillMenu({
      title: "t",
      menu,
      entries: [],
      notify,
      onSettings: noop,
      onRefresh: noop,
      defaultBrowser: { name: "Firefox", command: ["firefox"], pkg: FAKE_DEFAULT_BROWSER_PKG },
      showDefaultBrowserEdit: false,
    });
    const row = menu.items[1] as FakePopupMenuItem; // [0] toolbar, [1] this row
    expect(row).not.toBeInstanceOf(FakePopupSubMenuMenuItem);
    const btnGroup = row.children[0] as FakeButton;
    expect(btnGroup).toBeInstanceOf(FakeButton);
    btnGroup.emit("clicked");
    expect(subprocessNew).toHaveBeenCalledWith(["firefox"], 0);
  });

  it("puts a 'Launch' action plus every other installed browser inside the default-browser submenu", async () => {
    const browsersEntry = {
      label: "Browsers",
      group: "simple" as const,
      items: [
        { label: "Firefox", command: ["firefox"], pkg: FAKE_DEFAULT_BROWSER_PKG },
        { label: "Chromium", command: ["chromium"] }, // no pkg — must be skipped
      ],
    };

    const onSetDefaultBrowser = vi.fn();
    const menu = makeFakeMenu();
    await fillMenu({
      title: "t",
      menu,
      entries: [browsersEntry],
      notify,
      onSettings: noop,
      onRefresh: noop,
      defaultBrowser: { name: "Firefox", command: ["firefox"], pkg: FAKE_DEFAULT_BROWSER_PKG },
      showDefaultBrowserEdit: true,
      onSetDefaultBrowser,
    });
    // [0] the donut/refresh/settings toolbar, [1] the default-browser
    // submenu item, [2] the "Browsers" row itself — no separator, it's the
    // menu's only entry.
    expect(menu.items).toHaveLength(3);

    const item = menu.items[1] as FakePopupSubMenuMenuItem;
    // Launch, separator, Firefox (Chromium skipped — no pkg).
    expect(item.menu.items).toHaveLength(3);
    expect((item.menu.items[0] as FakePopupMenuItem).label.text).toBe("Launch Firefox");
    expect(item.menu.items[1]).toBeInstanceOf(FakePopupSeparatorMenuItem);
    const pickerItem = item.menu.items[2] as FakePopupMenuItem;
    expect(pickerItem.label.text).toBe("Firefox");
    pickerItem.emit("activate");
    expect(onSetDefaultBrowser).toHaveBeenCalledWith(FAKE_DEFAULT_BROWSER_PKG);
  });

  it("shows the Donut button only when showDonutBrowser is on and an eligible browser is installed", async () => {
    const eligibleEntries = [
      {
        label: "Browsers",
        group: "simple" as const,
        items: [{ label: "Firefox", command: ["firefox"], pkg: FAKE_DEFAULT_BROWSER_PKG }],
      },
    ];

    const off = makeFakeMenu();
    await fillMenu({
      title: "t",
      menu: off,
      entries: eligibleEntries,
      notify,
      onSettings: noop,
      onRefresh: noop,
      showDonutBrowser: false,
    });
    const toolbarOff = off.items[0] as FakePopupMenuItem;
    // [spacer] only — no Donut button, no default-browser group (none passed).
    expect(toolbarOff.children).toHaveLength(3); // spacer, Refresh, Settings

    // No eligible browser in `entries` — button stays hidden even though the setting is on.
    const noBrowsers = makeFakeMenu();
    await fillMenu({
      title: "t",
      menu: noBrowsers,
      entries: [],
      notify,
      onSettings: noop,
      onRefresh: noop,
      showDonutBrowser: true,
    });
    const toolbarNoBrowsers = noBrowsers.items[0] as FakePopupMenuItem;
    expect(toolbarNoBrowsers.children).toHaveLength(3);

    const eligible = makeFakeMenu();
    await fillMenu({
      title: "t",
      menu: eligible,
      entries: eligibleEntries,
      notify,
      onSettings: noop,
      onRefresh: noop,
      showDonutBrowser: true,
    });
    const toolbarEligible = eligible.items[0] as FakePopupMenuItem;
    expect(toolbarEligible.children).toHaveLength(4); // + the Donut button
  });

  it("calls onLaunchDonut with the eligible item when the Donut button is clicked", async () => {
    const entries = [
      {
        label: "Browsers",
        group: "simple" as const,
        items: [{ label: "Firefox", command: ["firefox"], pkg: FAKE_DEFAULT_BROWSER_PKG }],
      },
    ];
    const onLaunchDonut = vi.fn();

    const menu = makeFakeMenu();
    await fillMenu({
      title: "t",
      menu,
      entries,
      notify,
      onSettings: noop,
      onRefresh: noop,
      showDonutBrowser: true,
      onLaunchDonut,
    });
    const toolbar = menu.items[0] as FakePopupMenuItem;
    const donutBtn = toolbar.children[1] as FakeButton; // spacer, Donut, Refresh, Settings

    donutBtn.emit("clicked");
    expect(onLaunchDonut).toHaveBeenCalledWith({
      label: "Firefox",
      command: ["firefox"],
      pkg: FAKE_DEFAULT_BROWSER_PKG,
    });
  });

  it("shows a spinner and an inert button when donutLaunching is true", async () => {
    const entries = [
      {
        label: "Browsers",
        group: "simple" as const,
        items: [{ label: "Firefox", command: ["firefox"], pkg: FAKE_DEFAULT_BROWSER_PKG }],
      },
    ];

    const menu = makeFakeMenu();
    await fillMenu({
      title: "t",
      menu,
      entries,
      notify,
      onSettings: noop,
      onRefresh: noop,
      showDonutBrowser: true,
      donutLaunching: true,
    });
    const toolbar = menu.items[0] as FakePopupMenuItem;
    const donutBtn = toolbar.children[1] as FakeButton;

    expect(donutBtn.children[0]).toBeInstanceOf(FakeSpinner);
    expect(donutBtn.reactive).toBe(false);
  });

  it("omits the whole toolbar row when showToolbar is false", async () => {
    const menu = makeFakeMenu();
    await fillMenu({
      title: "t",
      menu,
      entries: [{ label: "Falkon", items: [{ label: "default", command: ["falkon"] }] }],
      notify,
      onSettings: noop,
      onRefresh: noop,
      defaultBrowser: { name: "Firefox", command: ["firefox"], pkg: FAKE_DEFAULT_BROWSER_PKG },
      showToolbar: false,
    });

    // With no toolbar, the first item is straight into the entries: the
    // category separator, not a toolbar row.
    expect(menu.items[0]).toBeInstanceOf(FakePopupSeparatorMenuItem);
  });
});
