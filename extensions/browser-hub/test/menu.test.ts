import { describe, it, expect, vi, beforeEach } from "vitest";

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
class FakeButton extends FakeWidget {}
class FakeBoxLayout extends FakeWidget {}

vi.mock("gi://St", () => ({
  default: {
    Widget: FakeWidget,
    Icon: FakeIcon,
    Button: FakeButton,
    BoxLayout: FakeBoxLayout,
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
  constructor(public text?: string) {
    super();
  }
}

vi.mock("resource:///org/gnome/shell/ui/popupMenu.js", () => ({
  PopupMenuItem: FakePopupMenuItem,
  PopupSeparatorMenuItem: FakePopupSeparatorMenuItem,
}));

const subprocessNew = vi.fn();
vi.mock("gi://Gio", () => ({
  default: {
    Subprocess: { new: subprocessNew },
    SubprocessFlags: { NONE: 0 },
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
const noop = () => {};

beforeEach(() => {
  subprocessNew.mockClear();
  notify.mockClear();
});

describe("fillMenu", () => {
  it("shows 'No browsers found' when entries is empty", () => {
    const menu = makeFakeMenu();
    fillMenu({ title: "t", menu, entries: [], notify, onSettings: noop, onRefresh: noop });

    const separatorAndMessage = menu.items.slice(1); // [0] is the toolbar row
    expect(separatorAndMessage[0]).toBeInstanceOf(FakePopupSeparatorMenuItem);
    expect((separatorAndMessage[1] as FakePopupMenuItem).label.text).toBe("No browsers found");
  });

  it("renders a blank icon slot (not St.Icon) for a profile item with no icon", () => {
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
    expect(iconSlot).toBeInstanceOf(FakeWidget);
    expect(iconSlot).not.toBeInstanceOf(FakeIcon);
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
    const iconSlot = profileItem.children[0] as FakeIcon;
    expect(iconSlot).toBeInstanceOf(FakeIcon);
    expect(iconSlot.props.icon_name).toBe("firefox-symbolic");
  });

  it("applies color.mode 'badge' as fgColor/bgColor on the icon itself (Firefox Profile Groups)", () => {
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
    const iconSlot = profileItem.children[0] as FakeIcon;
    expect(iconSlot.style).toContain("color: #ffffff");
    expect(iconSlot.style).toContain("background-color: #20123a");
    expect(iconSlot.style).toContain("border-radius");
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
    const iconSlot = profileItem.children[0] as FakeIcon;
    expect(iconSlot.style).toBeUndefined(); // no badge on the icon itself
    const dot = profileItem.children.at(-1) as FakeWidget;
    expect(dot.props.style_class).toBe("browser-hub-profile-dot");
    expect(dot.style).toContain("background-color: rgb(17,34,51)");
  });

  it("renders space buttons with a smaller icon size for the neutral fallback dot", () => {
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
    expect((untitledBtn.children[0] as FakeIcon).props.icon_size).toBe(8);
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

  it("shows the edit button only when showDefaultBrowserEdit is true, and launches gnome-control-center applications on click", () => {
    const menuWithEdit = makeFakeMenu();
    fillMenu({
      title: "t",
      menu: menuWithEdit,
      entries: [],
      notify,
      onSettings: noop,
      onRefresh: noop,
      defaultBrowser: { name: "Firefox", command: ["firefox"] },
      showDefaultBrowserEdit: true,
    });
    const toolbar = menuWithEdit.items[0] as FakePopupMenuItem;
    const btnGroup = toolbar.children[0] as FakeBoxLayout;
    expect(btnGroup.children).toHaveLength(2); // launch + edit
    const editBtn = btnGroup.children[1] as FakeButton;
    editBtn.emit("clicked");
    expect(subprocessNew).toHaveBeenCalledWith(["gnome-control-center", "applications"], 0);

    const menuWithoutEdit = makeFakeMenu();
    fillMenu({
      title: "t",
      menu: menuWithoutEdit,
      entries: [],
      notify,
      onSettings: noop,
      onRefresh: noop,
      defaultBrowser: { name: "Firefox", command: ["firefox"] },
      showDefaultBrowserEdit: false,
    });
    const toolbar2 = menuWithoutEdit.items[0] as FakePopupMenuItem;
    const btnGroup2 = toolbar2.children[0] as FakeBoxLayout;
    expect(btnGroup2.children).toHaveLength(1); // launch only
  });
});
