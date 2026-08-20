import Adw from "gi://Adw";
import Gio from "gi://Gio";
import Gtk from "gi://Gtk";
import { ExtensionPreferences } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";
import { SpaceType } from "./taxonomy/space-type.enum";
import { SUB_SETTING_PARENTS } from "./settings-keys";
import type { ProfileGroupsMode } from "./browser";

const PROFILE_GROUP_MODES: ProfileGroupsMode[] = ["profiles", "spaces", "off"];
const PROFILE_GROUP_LABELS = ["Profiles", "Spaces", "Hide"];

export default class BrowserHubPreferences extends ExtensionPreferences {
  async fillPreferencesWindow(window: Adw.PreferencesWindow): Promise<void> {
    const settings = this.getSettings();

    const switchRow = (title: string, subtitle: string, key: string): Adw.SwitchRow => {
      const r = new Adw.SwitchRow({ title, subtitle });
      settings.bind(key, r, "active", Gio.SettingsBindFlags.DEFAULT);
      return r;
    };

    // A sub-setting row's "sensitive" is bound to its parent's own value (see
    // SUB_SETTING_PARENTS in settings-keys.ts) — greyed out and inert
    // whenever the parent switch is off, regardless of which group either
    // row is displayed in.
    const bindToParent = (key: string, row: Adw.SwitchRow): void => {
      settings.bind(SUB_SETTING_PARENTS[key], row, "sensitive", Gio.SettingsBindFlags.GET);
    };

    // -- Panel ------------------------------------------------------------------

    const panelGroup = new Adw.PreferencesGroup({ title: "Panel" });
    panelGroup.add(
      switchRow(
        "Show default browser's icon",
        "Use the default browser's own icon instead of the generic one",
        "show-default-browser-panel-icon",
      ),
    );

    // -- Toolbar --------------------------------------------------------------

    const toolbarGroup = new Adw.PreferencesGroup({ title: "Toolbar" });
    toolbarGroup.add(
      switchRow(
        "Show toolbar",
        "The top section: default browser, disposable browser, Refresh, and Settings",
        "show-toolbar",
      ),
    );
    const editBtnRow = switchRow(
      "Show default browser",
      "The row that launches your default browser, with a button to pick a different one",
      "show-default-browser-edit",
    );
    bindToParent("show-default-browser-edit", editBtnRow);
    toolbarGroup.add(editBtnRow);
    const donutBtnRow = switchRow(
      "Show disposable browser button",
      "Launches a disposable, fingerprint-resistant profile (Firefox family only)",
      "show-donut-browser",
    );
    bindToParent("show-donut-browser", donutBtnRow);
    toolbarGroup.add(donutBtnRow);

    // -- Profiles ---------------------------------------------------------------

    const profilesGroup = new Adw.PreferencesGroup({ title: "Profiles" });
    profilesGroup.add(
      switchRow("Show Firefox family", "Zen, Firefox, LibreWolf, Floorp…", "show-firefox-family"),
    );
    profilesGroup.add(
      switchRow("Show Chrome family", "Chromium, Edge, Brave, Falkon…", "show-chrome-family"),
    );
    const singleProfileRow = switchRow(
      "Show single-profile browsers",
      "Off by default: a browser with only one profile (and no active spaces) is shown only in the Browsers section below",
      "show-single-profile-detail",
    );
    profilesGroup.add(singleProfileRow);

    const profileGroupsGroup = new Adw.PreferencesGroup({ title: "Spaces" });

    const profileGroupsToggles = new Adw.ToggleGroup();
    for (const label of PROFILE_GROUP_LABELS) {
      profileGroupsToggles.add(new Adw.Toggle({ label }));
    }
    profileGroupsToggles.valign = Gtk.Align.CENTER;
    profileGroupsToggles.active = Math.max(
      0,
      PROFILE_GROUP_MODES.indexOf(
        settings.get_string("firefox-profile-groups-mode") as ProfileGroupsMode,
      ),
    );
    profileGroupsToggles.connect("notify::active", () => {
      const mode = PROFILE_GROUP_MODES[profileGroupsToggles.active] ?? "spaces";
      settings.set_string("firefox-profile-groups-mode", mode);
    });
    // ExtensionPreferences.getSettings() returns a cached, extension-lifetime
    // Gio.Settings instance shared across every time this window is opened —
    // without an explicit disconnect, reopening Preferences repeatedly piles
    // up listeners that each close over a since-disposed profileGroupsToggles.
    const profileGroupsModeChangedId = settings.connect(
      "changed::firefox-profile-groups-mode",
      () => {
        const idx = PROFILE_GROUP_MODES.indexOf(
          settings.get_string("firefox-profile-groups-mode") as ProfileGroupsMode,
        );
        profileGroupsToggles.active = Math.max(0, idx);
      },
    );
    window.connect("destroy", () => settings.disconnect(profileGroupsModeChangedId));

    const profileGroupsRow = new Adw.ActionRow({
      title: "Show Firefox profile groups",
      subtitle: "Profiles from Firefox's new in-browser switcher (128+)",
    });
    profileGroupsRow.add_suffix(profileGroupsToggles);
    profileGroupsGroup.add(profileGroupsRow);

    profileGroupsGroup.add(
      switchRow(
        "Show Zen workspaces",
        "Workspace buttons under each Zen profile",
        SpaceType.ZenWorkspaces,
      ),
    );

    // -- Browsers ---------------------------------------------------------------

    const browsersGroup = new Adw.PreferencesGroup({ title: "Browsers" });
    browsersGroup.add(
      switchRow(
        "Show simple browsers",
        "GNOME Web, qutebrowser… listed as single icons",
        "show-simple-browsers",
      ),
    );
    browsersGroup.add(
      switchRow(
        "Show profile browsers",
        "Firefox/Chrome-family browsers listed here too, alongside their section above",
        "show-profiled-browsers",
      ),
    );

    const page = new Adw.PreferencesPage();
    page.add(panelGroup);
    page.add(toolbarGroup);
    page.add(profilesGroup);
    page.add(profileGroupsGroup);
    page.add(browsersGroup);
    window.add(page);
  }
}
