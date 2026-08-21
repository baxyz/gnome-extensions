import { describe, it, expect, vi, beforeEach } from "vitest";
import type Gio from "gi://Gio";
import { noop } from "@helpers4/function";
import { PackageManager } from "../src/taxonomy";

const FAKE_DEFAULT_BROWSER_PKG = { manager: PackageManager.Native, binary: "firefox" } as const;

// menu/index.ts imports { launchBrowser } from "./internal", which loads
// the whole internal/index.ts barrel — including pkg.ts, which imports
// "gi://GLib" at module scope even though nothing in these tests exercises
// GLib-using functions. Needs a stub so the import itself resolves under Node.
vi.mock("gi://GLib", () => ({
  default: {
    get_home_dir: () => "/home/user",
    getenv: () => null,
    find_program_in_path: () => null,
    // menu/shared.ts's tooltip() uses these for its hover-delay timer — never
    // actually fired in these tests (nothing simulates an "enter-event"), but
    // the module import itself needs the mock shape to exist.
    timeout_add: () => 0,
    source_remove: () => {},
    PRIORITY_DEFAULT: 0,
    SOURCE_REMOVE: false,
    // findDesktopIdByExecutable()'s fallback (internal/gio.ts), reached from
    // resolveDesktopIcon()/resolveDesktopId() whenever a guessed desktop id
    // doesn't resolve — see desktopAppInfoNew below.
    path_get_basename: (p: string) => p.split("/").filter(Boolean).pop() ?? "",
  },
}));

// menu/shared.ts's tooltip() adds its floating label to Main.layoutManager's
// uiGroup instead of as a child of the hovered button, so it isn't clipped
// by the popup menu's own bounds — see tooltip()'s own comment.
vi.mock("resource:///org/gnome/shell/ui/main.js", () => ({
  layoutManager: { uiGroup: { add_child: () => {} } },
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

// Only fillMenu (menu/index.ts) is exported — everything else in menu/ is
// driven through it and asserted on the resulting fake widget tree, which
// is what these tests treat as "observable behavior".

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
  set_child_above_sibling(child: FakeWidget, _sibling: FakeWidget | null): void {
    this.children = [...this.children.filter((c) => c !== child), child];
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
// Real St.Button defaults reactive to true; the burner-session row's click
// handler (menu/toolbar.ts's buildDonutItem) reads it back to guard against
// double-clicks while busy.
class FakeButton extends FakeWidget {
  reactive = true;
}
class FakeBoxLayout extends FakeWidget {}
class FakeBin extends FakeWidget {}
class FakeScrollView extends FakeWidget {}

vi.mock("gi://St", () => ({
  default: {
    Widget: FakeWidget,
    Icon: FakeIcon,
    Button: FakeButton,
    BoxLayout: FakeBoxLayout,
    Bin: FakeBin,
    ScrollView: FakeScrollView,
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
// PopupMenuSection is "transparent" in the real API — addMenuItem() just
// adds the item as a child of its own .actor, which is what
// buildScrollablePickerList() wraps in an St.ScrollView.
class FakePopupMenuSection {
  actor = new FakeBoxLayout();
  addMenuItem(item: FakeWidget): void {
    this.actor.add_child(item);
  }
}

vi.mock("resource:///org/gnome/shell/ui/popupMenu.js", () => ({
  PopupMenuItem: FakePopupMenuItem,
  PopupMenuSection: FakePopupMenuSection,
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
// menu/toolbar.ts imports launchBrowser/resolveDesktopIcon from
// "./internal", the barrel that includes gio.ts — its
// Gio._promisify(Gio.File.prototype, ...) call at module scope needs an
// actual prototype to patch even though nothing here exercises the
// promisified methods themselves.
class FakeGioFile {}

// findDesktopIdByExecutable()'s fallback source (internal/gio.ts) — empty by
// default so the fallback always comes up empty, same as the plain
// desktopAppInfoNew-based guess it follows; overridden per-test where the
// fallback itself is what's under test (see filterDefaultBrowserPickable below).
const appInfoGetAll = vi.fn(
  (): {
    get_id(): string;
    get_executable(): string | null;
    get_commandline(): string | null;
  }[] => [],
);
vi.mock("gi://Gio", () => ({
  default: {
    Subprocess: { new: subprocessNew },
    SubprocessFlags: { NONE: 0 },
    File: FakeGioFile,
    _promisify: () => {},
    AppInfo: { get_all: () => appInfoGetAll() },
  },
}));

// menu/toolbar.ts's buildDefaultBrowserItem resolves the default browser's
// own icon via resolveDesktopIcon() — no app matches in this test environment, which
// exercises the same "no icon found" tolerance as a real missing .desktop
// file. Also drives filterDefaultBrowserPickable's Snap-guess verification
// below (see desktopAppInfoNew) — default "no app resolves" is the common
// case for every test that doesn't care about that specific behavior.
const desktopAppInfoNew = vi.fn((_id: string): unknown => null);
vi.mock("gi://GioUnix", () => ({
  default: { DesktopAppInfo: { new: (id: string) => desktopAppInfoNew(id) } },
}));

const { fillMenu } = await import("../src/menu");
const { filterDefaultBrowserPickable } = await import("../src/menu/toolbar");
const { clearDesktopIconCache } = await import("../src/internal");

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
  desktopAppInfoNew.mockClear();
  desktopAppInfoNew.mockReturnValue(null);
  appInfoGetAll.mockClear();
  appInfoGetAll.mockReturnValue([]);
  // internal/gio.ts caches the Gio.AppInfo.get_all() scan itself (not just
  // the per-binary result) — bust it too, or a later test's different
  // appInfoGetAll return value would never be seen.
  clearDesktopIconCache();
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

  it("shows the default-browser row, with its trailing Edit button, when showDefaultBrowserEdit is true", async () => {
    const onOpenDefaultBrowserPage = vi.fn();
    const menu = makeFakeMenu();
    await fillMenu({
      title: "t",
      menu,
      entries: [],
      notify,
      onSettings: noop,
      onRefresh: noop,
      defaultBrowser: { name: "Firefox", command: ["firefox"], pkg: FAKE_DEFAULT_BROWSER_PKG },
      showDefaultBrowserEdit: true,
      onOpenDefaultBrowserPage,
    });
    const row = menu.items[1] as FakePopupMenuItem; // [0] toolbar, [1] this row
    expect(row.label.text).toBe("Launch default browser");
    expect(row.children[0]).toBeInstanceOf(FakeIcon);

    const editBtn = row.children.at(-1) as FakeButton;
    editBtn.emit("clicked");
    expect(onOpenDefaultBrowserPage).toHaveBeenCalled();

    // The row itself still launches when clicked.
    row.emit("activate");
    expect(subprocessNew).toHaveBeenCalledWith(["firefox"], 0);
  });

  it("omits the whole default-browser row — not just its Edit button — when showDefaultBrowserEdit is false", async () => {
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
    expect(
      menu.items.some(
        (item) => (item as FakePopupMenuItem).label?.text === "Launch default browser",
      ),
    ).toBe(false);
  });

  it("default-browser page lists every pickable browser; picking one sets it as default and returns to main", async () => {
    desktopAppInfoNew.mockReturnValue({});
    const browsersEntry = {
      label: "Browsers",
      group: "simple" as const,
      items: [
        { label: "Firefox", command: ["firefox"], pkg: FAKE_DEFAULT_BROWSER_PKG },
        { label: "Chromium", command: ["chromium"] }, // no pkg — must be skipped
      ],
    };
    const onSetDefaultBrowser = vi.fn();
    const onBack = vi.fn();
    const menu = makeFakeMenu();
    await fillMenu({
      title: "t",
      menu,
      entries: [browsersEntry],
      notify,
      onSettings: noop,
      onRefresh: noop,
      page: "default-browser",
      onSetDefaultBrowser,
      onBack,
    });

    // [0] back header, [1] the scrollable picker list — no toolbar, no
    // default-browser/Donut rows on a sub-page.
    expect(menu.items).toHaveLength(2);

    const header = menu.items[0] as FakePopupMenuItem;
    const headerContent = header.children[0] as FakeBoxLayout;
    const backBtn = headerContent.children[0] as FakeButton;
    const titleLabel = headerContent.children[1] as FakeLabel;
    expect(titleLabel.text).toBe("Change default browser");
    backBtn.emit("clicked");
    expect(onBack).toHaveBeenCalledTimes(1);

    const listRow = menu.items[1] as FakePopupMenuItem;
    const scrollView = listRow.children[0] as FakeScrollView;
    const sectionBox = scrollView.children[0] as FakeBoxLayout;
    // Chromium skipped — no pkg.
    expect(sectionBox.children).toHaveLength(1);
    const pickerItem = sectionBox.children[0] as FakePopupMenuItem;
    expect(pickerItem.label.text).toBe("Firefox");

    pickerItem.emit("activate");
    // onBack fires again (once from the header click above, once from picking).
    expect(onBack).toHaveBeenCalledTimes(2);
    expect(onSetDefaultBrowser).toHaveBeenCalledWith(FAKE_DEFAULT_BROWSER_PKG);
  });

  it("shows the Donut row only when showDonutBrowser is on and an eligible browser is installed", async () => {
    const eligibleEntries = [
      {
        label: "Browsers",
        group: "simple" as const,
        items: [{ label: "Firefox", command: ["firefox"], pkg: FAKE_DEFAULT_BROWSER_PKG }],
      },
    ];
    const hasDonutRow = (menu: FakeMenu) =>
      menu.items.some(
        (item) => (item as FakePopupMenuItem).label?.text === "Launch burner session",
      );

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
    expect(hasDonutRow(off)).toBe(false);

    // No eligible browser in `entries` — row stays hidden even though the setting is on.
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
    expect(hasDonutRow(noBrowsers)).toBe(false);

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
    expect(hasDonutRow(eligible)).toBe(true);
  });

  it("calls onLaunchDonut with the eligible item when the Donut row is clicked", async () => {
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
    const donutRow = menu.items.find(
      (item) => (item as FakePopupMenuItem).label?.text === "Launch burner session",
    ) as FakePopupMenuItem;

    donutRow.emit("activate");
    expect(onLaunchDonut).toHaveBeenCalledWith({
      label: "Firefox",
      command: ["firefox"],
      pkg: FAKE_DEFAULT_BROWSER_PKG,
    });
  });

  it("shows a spinner and makes the row inert when donutLaunching is true", async () => {
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
    const donutRow = menu.items.find(
      (item) => (item as FakePopupMenuItem).label?.text === "Launch burner session",
    ) as FakePopupMenuItem & { reactive: boolean };

    expect(donutRow.children[0]).toBeInstanceOf(FakeSpinner);
    expect(donutRow.reactive).toBe(false);
  });

  it("opening the Donut page and picking a browser returns to main before launching", async () => {
    const entries = [
      {
        label: "Browsers",
        group: "simple" as const,
        items: [
          { label: "Firefox", command: ["firefox"], pkg: FAKE_DEFAULT_BROWSER_PKG },
          {
            label: "Zen (flatpak)",
            command: ["flatpak", "run", "app.zen_browser.zen"],
            pkg: { manager: PackageManager.Flatpak, appId: "app.zen_browser.zen" },
          },
        ],
      },
    ];
    const onLaunchDonut = vi.fn();
    const onBack = vi.fn();
    const menu = makeFakeMenu();
    await fillMenu({
      title: "t",
      menu,
      entries,
      notify,
      onSettings: noop,
      onRefresh: noop,
      page: "donut",
      onLaunchDonut,
      onBack,
    });

    const header = menu.items[0] as FakePopupMenuItem;
    const headerContent = header.children[0] as FakeBoxLayout;
    const titleLabel = headerContent.children[1] as FakeLabel;
    expect(titleLabel.text).toBe("Choose a browser for the burner session");

    const listRow = menu.items[1] as FakePopupMenuItem;
    const scrollView = listRow.children[0] as FakeScrollView;
    const sectionBox = scrollView.children[0] as FakeBoxLayout;
    // Firefox (Native) and Zen (Flatpak) both eligible — neither is Snap.
    expect(sectionBox.children).toHaveLength(2);

    const zenRow = sectionBox.children[1] as FakePopupMenuItem;
    zenRow.emit("activate");
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onLaunchDonut).toHaveBeenCalledWith(entries[0].items[1]);
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

describe("filterDefaultBrowserPickable", () => {
  const SNAP_PKG = { manager: PackageManager.Snap, name: "opera" } as const;
  const FLATPAK_PKG = { manager: PackageManager.Flatpak, appId: "app.zen_browser.zen" } as const;

  it("includes a Snap browser once its guessed desktop ID actually resolves", () => {
    desktopAppInfoNew.mockReturnValue({});

    const result = filterDefaultBrowserPickable([{ label: "Opera", command: [], pkg: SNAP_PKG }]);

    expect(result).toHaveLength(1);
    expect(desktopAppInfoNew).toHaveBeenCalledWith("opera_opera.desktop");
  });

  it("excludes a Snap browser whose guessed desktop ID doesn't resolve to anything", () => {
    desktopAppInfoNew.mockReturnValue(null);

    const result = filterDefaultBrowserPickable([{ label: "Opera", command: [], pkg: SNAP_PKG }]);

    expect(result).toHaveLength(0);
  });

  it("includes a Native browser whose desktop ID resolves", () => {
    desktopAppInfoNew.mockReturnValue({});

    const result = filterDefaultBrowserPickable([
      { label: "Firefox", command: [], pkg: FAKE_DEFAULT_BROWSER_PKG },
    ]);

    expect(result).toHaveLength(1);
    expect(desktopAppInfoNew).toHaveBeenCalledWith("firefox.desktop");
  });

  it("excludes a Native browser whose binary is on PATH but has no .desktop file (e.g. Fedora's epiphany-runtime)", () => {
    desktopAppInfoNew.mockReturnValue(null);

    const result = filterDefaultBrowserPickable([
      {
        label: "Epiphany",
        command: [],
        pkg: { manager: PackageManager.Native, binary: "epiphany" },
      },
    ]);

    expect(result).toHaveLength(0);
  });

  it("includes a Native browser whose guessed desktop ID is wrong but a by-executable search finds the real one (e.g. Fedora's Firefox RPM: org.mozilla.firefox.desktop, not firefox.desktop)", () => {
    // A binary name not used by any other test in this file — desktop-icon.ts's
    // by-executable cache is module-scoped and never cleared here, so reusing
    // "firefox" would risk hitting another test's cached (unrelated) result.
    const pkg = { manager: PackageManager.Native, binary: "rpm-firefox" } as const;
    desktopAppInfoNew.mockImplementation((id: string) =>
      id === "org.mozilla.firefox.desktop" ? {} : null,
    );
    appInfoGetAll.mockReturnValue([
      {
        get_id: () => "org.mozilla.firefox.desktop",
        get_executable: () => "rpm-firefox",
        get_commandline: () => "rpm-firefox %u",
      },
    ]);

    const result = filterDefaultBrowserPickable([{ label: "Firefox", command: [], pkg }]);

    expect(result).toHaveLength(1);
    expect(desktopAppInfoNew).toHaveBeenCalledWith("rpm-firefox.desktop");
    expect(desktopAppInfoNew).toHaveBeenCalledWith("org.mozilla.firefox.desktop");
  });

  it("never bothers checking a Flatpak's desktop ID — the spec guarantees it exists", () => {
    const result = filterDefaultBrowserPickable([{ label: "Zen", command: [], pkg: FLATPAK_PKG }]);

    expect(result).toHaveLength(1);
    expect(desktopAppInfoNew).not.toHaveBeenCalled();
  });
});
