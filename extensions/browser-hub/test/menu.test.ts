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

vi.mock("resource:///org/gnome/shell/ui/popupMenu.js", () => ({
  PopupMenuItem: FakePopupMenuItem,
  PopupSeparatorMenuItem: FakePopupSeparatorMenuItem,
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
// A class, not a plain object: internal/gio.ts calls Gio._promisify(Gio.File.prototype,
// ...) at module scope on import (menu.ts imports launchBrowser/resolveDesktopIcon
// from "./internal", the barrel that includes gio.ts), which needs an actual
// prototype to patch even though nothing here exercises the promisified
// methods themselves.
class FakeGioFile {}

vi.mock("gi://Gio", () => ({
  default: {
    Subprocess: { new: subprocessNew },
    SubprocessFlags: { NONE: 0 },
    // menu.ts's buildToolbar resolves the default browser's own icon via
    // resolveDesktopIcon() — no app matches in this test environment, which
    // exercises the same "no icon found" tolerance as a real missing .desktop file.
    DesktopAppInfo: { new: () => null },
    File: FakeGioFile,
    _promisify: () => {},
  },
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
  it("shows an empty-state message with no separator when entries is empty", () => {
    const menu = makeFakeMenu();
    fillMenu({ title: "t", menu, entries: [], notify, onSettings: noop, onRefresh: noop });

    const message = menu.items[1]; // [0] is the toolbar row, nothing separates the message from it
    expect(message).not.toBeInstanceOf(FakePopupSeparatorMenuItem);
    expect((message as FakePopupMenuItem).label.text).toBe(
      "Nothing to show — check Settings, or install a browser",
    );
  });

  it("renders an empty St.Bin icon slot (not St.Icon) for a profile item with no icon", () => {
    const menu = makeFakeMenu();
    fillMenu({
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

  it("puts the 'Browsers' row's icon buttons on a single line when they fit", () => {
    const menu = makeFakeMenu();
    fillMenu({
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

    const row = menu.items[2] as FakePopupMenuItem; // [0] toolbar, [1] separator, [2] row
    const container = row.children[0];
    expect(container.children).toHaveLength(1); // one line, not one child per button
    const line = container.children[0];
    expect(line).toBeInstanceOf(FakeBoxLayout);
    expect(line.children).toHaveLength(2);
  });

  it("wraps the 'Browsers' row's icon buttons onto additional lines past the per-line cap", () => {
    const menu = makeFakeMenu();
    const items = Array.from({ length: 7 }, (_, i) => ({
      label: `Browser ${i}`,
      command: [`browser${i}`],
    }));
    fillMenu({
      title: "t",
      menu,
      entries: [{ label: "Browsers", group: "simple", items }],
      notify,
      onSettings: noop,
      onRefresh: noop,
    });

    const row = menu.items[2] as FakePopupMenuItem;
    const container = row.children[0];
    expect(container.children).toHaveLength(2); // 6 on the first line, 1 on the second
    expect(container.children[0].children).toHaveLength(6);
    expect(container.children[1].children).toHaveLength(1);
  });

  it("shows the browser's icon before the separator label when the entry has one", () => {
    const menu = makeFakeMenu();
    const fakeGicon = {} as Gio.Icon;
    fillMenu({
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

  it("renders no icon before the separator label when the entry has none", () => {
    const menu = makeFakeMenu();
    fillMenu({
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

  it("renders a real St.Icon for a profile item with an icon", () => {
    const menu = makeFakeMenu();
    fillMenu({
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

  it("applies color.mode 'badge' fgColor as an icon tint with no fgColor bgColor pill", () => {
    const menu = makeFakeMenu();
    fillMenu({
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

  it("applies color.mode 'badge' bgColor as a background pill, shrinking the icon so the total footprint matches a plain icon", () => {
    const menu = makeFakeMenu();
    fillMenu({
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

  it("renders color.mode 'dot' as a separate indicator, not an icon badge (Chromium)", () => {
    const menu = makeFakeMenu();
    fillMenu({
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

  it("renders space buttons with the same icon size for real icons and the neutral fallback dot", () => {
    const menu = makeFakeMenu();
    fillMenu({
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

  it("launches the item's command via Gio.Subprocess when a profile menu item is activated", () => {
    const menu = makeFakeMenu();
    fillMenu({
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

  it("shows the picker caret only when showDefaultBrowserEdit is true, and toggles the picker on click", () => {
    const onTogglePicker = vi.fn();
    const menuWithEdit = makeFakeMenu();
    fillMenu({
      title: "t",
      menu: menuWithEdit,
      entries: [],
      notify,
      onSettings: noop,
      onRefresh: noop,
      defaultBrowser: { name: "Firefox", command: ["firefox"], pkg: FAKE_DEFAULT_BROWSER_PKG },
      showDefaultBrowserEdit: true,
      onTogglePicker,
    });
    const toolbar = menuWithEdit.items[0] as FakePopupMenuItem;
    const btnGroup = toolbar.children[0] as FakeBoxLayout;
    expect(btnGroup.children).toHaveLength(2); // launch + caret
    const caretBtn = btnGroup.children[1] as FakeButton;
    caretBtn.emit("clicked");
    expect(onTogglePicker).toHaveBeenCalledTimes(1);
    expect(subprocessNew).not.toHaveBeenCalled();

    const menuWithoutEdit = makeFakeMenu();
    fillMenu({
      title: "t",
      menu: menuWithoutEdit,
      entries: [],
      notify,
      onSettings: noop,
      onRefresh: noop,
      defaultBrowser: { name: "Firefox", command: ["firefox"], pkg: FAKE_DEFAULT_BROWSER_PKG },
      showDefaultBrowserEdit: false,
    });
    const toolbar2 = menuWithoutEdit.items[0] as FakePopupMenuItem;
    const btnGroup2 = toolbar2.children[0] as FakeBoxLayout;
    expect(btnGroup2.children).toHaveLength(1); // launch only
  });

  it("expands picker rows (from the 'Browsers' row's items) below the toolbar only when pickerOpen is true", () => {
    const browsersEntry = {
      label: "Browsers",
      group: "simple" as const,
      items: [
        { label: "Firefox", command: ["firefox"], pkg: FAKE_DEFAULT_BROWSER_PKG },
        { label: "Chromium", command: ["chromium"] }, // no pkg — must be skipped
      ],
    };

    const closedMenu = makeFakeMenu();
    fillMenu({
      title: "t",
      menu: closedMenu,
      entries: [browsersEntry],
      notify,
      onSettings: noop,
      onRefresh: noop,
      defaultBrowser: { name: "Firefox", command: ["firefox"], pkg: FAKE_DEFAULT_BROWSER_PKG },
      showDefaultBrowserEdit: true,
      pickerOpen: false,
    });
    // [0] toolbar, [1] category separator, [2] the "Browsers" row itself — no picker rows.
    expect(closedMenu.items).toHaveLength(3);

    const onSetDefaultBrowser = vi.fn();
    const openMenu = makeFakeMenu();
    fillMenu({
      title: "t",
      menu: openMenu,
      entries: [browsersEntry],
      notify,
      onSettings: noop,
      onRefresh: noop,
      defaultBrowser: { name: "Firefox", command: ["firefox"], pkg: FAKE_DEFAULT_BROWSER_PKG },
      showDefaultBrowserEdit: true,
      pickerOpen: true,
      onSetDefaultBrowser,
    });
    // [0] toolbar, [1] picker row (Chromium's pkg-less item is skipped),
    // [2] category separator, [3] the "Browsers" row itself.
    expect(openMenu.items).toHaveLength(4);
    const pickerItem = openMenu.items[1] as FakePopupMenuItem;
    expect(pickerItem.label.text).toBe("Firefox");
    pickerItem.emit("activate");
    expect(onSetDefaultBrowser).toHaveBeenCalledWith(FAKE_DEFAULT_BROWSER_PKG);
  });

  it("shows the Donut button only when showDonutBrowser is on and an eligible browser is installed", () => {
    const eligibleEntries = [
      {
        label: "Browsers",
        group: "simple" as const,
        items: [{ label: "Firefox", command: ["firefox"], pkg: FAKE_DEFAULT_BROWSER_PKG }],
      },
    ];

    const off = makeFakeMenu();
    fillMenu({
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
    fillMenu({
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
    fillMenu({
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

  it("shows a spinner in the Donut button while onLaunchDonut is pending, then restores the icon", async () => {
    const entries = [
      {
        label: "Browsers",
        group: "simple" as const,
        items: [{ label: "Firefox", command: ["firefox"], pkg: FAKE_DEFAULT_BROWSER_PKG }],
      },
    ];
    let resolveLaunch!: () => void;
    const onLaunchDonut = vi.fn(() => new Promise<void>((resolve) => (resolveLaunch = resolve)));

    const menu = makeFakeMenu();
    fillMenu({
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
    expect(donutBtn.children[0]).toBeInstanceOf(FakeSpinner);
    expect(donutBtn.reactive).toBe(false);

    resolveLaunch();
    await Promise.resolve();
    await Promise.resolve();

    expect(donutBtn.children[0]).toBeInstanceOf(FakeIcon);
    expect(donutBtn.reactive).toBe(true);
  });

  it("omits the whole toolbar row when showToolbar is false", () => {
    const menu = makeFakeMenu();
    fillMenu({
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
