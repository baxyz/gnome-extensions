import Adw from "gi://Adw";
import Gio from "gi://Gio";
import Gtk from "gi://Gtk";
import { ExtensionPreferences } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";
import { SpaceType } from "./types/space-type.enum";
import type { ProfileGroupsMode } from "./helper/digging.helper";

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
      switchRow("Firefox family", "Zen, Firefox, LibreWolf, Floorp…", "show-firefox-family"),
    );
    profilesGroup.add(
      switchRow("Chrome family", "Chromium, Edge, Brave, Falkon…", "show-chrome-family"),
    );
    profilesGroup.add(
      switchRow("Profile-less browsers", "GNOME Web, qutebrowser…", "show-simple-browsers"),
    );

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
        "Zen workspaces",
        "Workspace buttons under each Zen profile",
        SpaceType.ZenWorkspace,
      ),
    );

    const toolbarGroup = new Adw.PreferencesGroup({ title: "Toolbar" });
    toolbarGroup.add(
      switchRow(
        "Show edit button",
        "Display the pencil button next to the default browser name",
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
