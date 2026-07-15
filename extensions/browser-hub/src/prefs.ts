import Adw from "gi://Adw";
import Gio from "gi://Gio";
import Gtk from "gi://Gtk";
import { ExtensionPreferences } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";
import { SpaceType } from "./taxonomy/space-type.enum";
import { SUB_SETTING_PARENTS } from "./settings-keys";
import type { ProfileGroupsMode } from "./browser";

const PROFILE_GROUP_MODES: ProfileGroupsMode[] = ["spaces", "profiles", "off"];
const PROFILE_GROUP_LABELS = ["Space buttons", "Individual profiles", "Off"];

export default class BrowserHubPreferences extends ExtensionPreferences {
  async fillPreferencesWindow(window: Adw.PreferencesWindow): Promise<void> {
    const settings = this.getSettings();

    const switchRow = (title: string, subtitle: string, key: string): Adw.SwitchRow => {
      const r = new Adw.SwitchRow({ title, subtitle });
      settings.bind(key, r, "active", Gio.SettingsBindFlags.DEFAULT);
      return r;
    };

    const profilesGroup = new Adw.PreferencesGroup({ title: "Profiles" });
    profilesGroup.add(
      switchRow("Show Firefox family", "Zen, Firefox, LibreWolf, Floorp…", "show-firefox-family"),
    );
    profilesGroup.add(
      switchRow("Show Chrome family", "Chromium, Edge, Brave, Falkon…", "show-chrome-family"),
    );
    profilesGroup.add(
      switchRow(
        "Show simple browsers in the “Browsers” row",
        "GNOME Web, qutebrowser… listed as single icons",
        "show-simple-browsers",
      ),
    );
    profilesGroup.add(
      switchRow(
        "Show profile browsers in the “Browsers” row",
        "Firefox/Chrome-family browsers listed here too, alongside their section above",
        "show-profiled-browsers",
      ),
    );
    const showSingleProfileDetailRow = switchRow(
      "Show single-profile browsers’ section",
      "Off by default: a browser with only one profile (and no active spaces) is shown only in the “Browsers” row above",
      "show-single-profile-detail",
    );
    // Sub-setting of its parent (see SUB_SETTING_PARENTS in settings-keys.ts)
    // — meaningless (and visually greyed out) when the parent switch is off.
    settings.bind(
      SUB_SETTING_PARENTS["show-single-profile-detail"],
      showSingleProfileDetailRow,
      "sensitive",
      Gio.SettingsBindFlags.GET,
    );
    profilesGroup.add(showSingleProfileDetailRow);

    const spacesGroup = new Adw.PreferencesGroup({ title: "Workspaces & Profile Groups" });

    const profileGroupsRow = new Adw.ComboRow({
      title: "Firefox profile groups",
      subtitle:
        "Profiles from Firefox's new in-browser switcher (128+) — separate from the classic Profile Manager",
      model: Gtk.StringList.new(PROFILE_GROUP_LABELS),
      selected: Math.max(
        0,
        PROFILE_GROUP_MODES.indexOf(
          settings.get_string("firefox-profile-groups-mode") as ProfileGroupsMode,
        ),
      ),
    });
    profileGroupsRow.connect("notify::selected", () => {
      const mode = PROFILE_GROUP_MODES[profileGroupsRow.selected] ?? "spaces";
      settings.set_string("firefox-profile-groups-mode", mode);
    });
    // ExtensionPreferences.getSettings() returns a cached, extension-lifetime
    // Gio.Settings instance shared across every time this window is opened —
    // without an explicit disconnect, reopening Preferences repeatedly piles
    // up listeners that each close over a since-disposed profileGroupsRow.
    const profileGroupsModeChangedId = settings.connect(
      "changed::firefox-profile-groups-mode",
      () => {
        const idx = PROFILE_GROUP_MODES.indexOf(
          settings.get_string("firefox-profile-groups-mode") as ProfileGroupsMode,
        );
        profileGroupsRow.selected = Math.max(0, idx);
      },
    );
    window.connect("destroy", () => settings.disconnect(profileGroupsModeChangedId));
    spacesGroup.add(profileGroupsRow);

    spacesGroup.add(
      switchRow(
        "Show Zen workspaces",
        "Workspace buttons under each Zen profile",
        SpaceType.ZenWorkspaces,
      ),
    );

    const toolbarGroup = new Adw.PreferencesGroup({ title: "Toolbar" });
    toolbarGroup.add(
      switchRow(
        "Show “change default browser” button",
        "A pencil icon next to the default browser name that opens Default Applications",
        "show-default-browser-edit",
      ),
    );

    const page = new Adw.PreferencesPage();
    page.add(profilesGroup);
    page.add(spacesGroup);
    page.add(toolbarGroup);
    window.add(page);
  }
}
